import os
import uuid
import json
import time
import io
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import pandas as pd
import numpy as np
import httpx
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, JSON
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
load_dotenv(Path(__file__).parent / ".env")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./databridge.db")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./outputs"))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
ALLOWED_EXTENSIONS = {"csv", "xlsx", "json"}
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DatasetModel(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String)
    original_filename = Column(String)
    file_path = Column(String)
    rows = Column(Integer)
    columns = Column(Integer)
    column_info = Column(Text)   # JSON
    missing_values = Column(Integer)
    duplicate_rows = Column(Integer)
    file_size_kb = Column(Float)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class IntegrationModel(Base):
    __tablename__ = "integrations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    source_dataset_ids = Column(Text)   # JSON list
    source_dataset_names = Column(Text) # JSON list
    transformation_plan = Column(Text)  # JSON
    status = Column(String, default="pending")
    records_input = Column(Integer, default=0)
    records_output = Column(Integer, default=0)
    duplicates_removed = Column(Integer, default=0)
    missing_handled = Column(Integer, default=0)
    quality_score = Column(Float, default=0.0)
    output_file_path = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    processing_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# AI helpers
# ---------------------------------------------------------------------------
def _call_ai(prompt: str) -> Optional[str]:
    """Call configured AI provider. Returns text or None."""
    provider = os.getenv("AI_PROVIDER", "gemini").lower()
    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key and api_key != "your_gemini_api_key_here":
            # Direct REST call to Google Gemini API
            for model_name in ["gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-2.5-flash"]:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.2}
                    }
                    r = httpx.post(url, json=payload, timeout=25.0)
                    if r.status_code == 200:
                        data = r.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"]
                    print(f"[AI] Gemini ({model_name}) returned HTTP {r.status_code}: {r.text[:200]}")
                except Exception as e:
                    print(f"[AI] Gemini ({model_name}) error: {e}")

    if provider == "groq" or True:   # fallback chain
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key and api_key != "your_groq_api_key_here":
            try:
                headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": "llama3-8b-8192",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                }
                r = httpx.post("https://api.groq.com/openai/v1/chat/completions",
                               headers=headers, json=payload, timeout=20.0)
                if r.status_code == 200:
                    return r.json()["choices"][0]["message"]["content"]
                print(f"[AI] Groq returned HTTP {r.status_code}: {r.text[:200]}")
            except Exception as e:
                print(f"[AI] Groq error: {e}")
    return None   # triggers fallback


# ---------------------------------------------------------------------------
# Schema mapping (deterministic fallback)
# ---------------------------------------------------------------------------
GENERIC_STOPWORDS = {"col", "column", "val", "value", "field", "data", "info", "record", "item"}

def _similarity_score(a: str, b: str) -> float:
    a_clean, b_clean = a.lower().replace("_", " ").strip(), b.lower().replace("_", " ").strip()
    if a_clean == b_clean:
        return 1.0

    # Common domain synonyms (e.g. employee_id <-> staff_code, dept <-> department_name)
    synonyms = [
        {"id", "code", "num", "number", "key", "identifier", "ref", "staff", "employee"},
        {"name", "fullname", "full_name", "firstname", "lastname", "title"},
        {"dept", "department", "division", "team", "group", "branch"},
        {"salary", "pay", "wage", "compensation", "income", "earnings", "annual_salary"},
        {"email", "mail", "emailaddress"},
        {"phone", "mobile", "tel", "telephone"},
        {"date", "dob", "birthdate", "created", "updated", "hire_date"},
        {"address", "location", "city", "state", "country"},
    ]
    for grp in synonyms:
        a_hit = any(w in a_clean.split() or w == a_clean for w in grp)
        b_hit = any(w in b_clean.split() or w == b_clean for w in grp)
        if a_hit and b_hit:
            return 0.95 if any(w in a_clean and w in b_clean for w in grp) else 0.85

    # Informative token overlap (excluding generic stopwords)
    tokens_a = set(a_clean.split()) - GENERIC_STOPWORDS
    tokens_b = set(b_clean.split()) - GENERIC_STOPWORDS
    if tokens_a and tokens_b and (tokens_a & tokens_b):
        return 0.8

    # Meaningful substring match
    if (len(a_clean) > 3 and a_clean in b_clean and a_clean not in GENERIC_STOPWORDS) or \
       (len(b_clean) > 3 and b_clean in a_clean and b_clean not in GENERIC_STOPWORDS):
        return 0.7

    return 0.0


def _deterministic_schema_mapping(cols_a: List[str], cols_b: List[str]) -> List[dict]:
    mappings = []
    used_b = set()
    for ca in cols_a:
        best_score, best_cb = 0.0, None
        for cb in cols_b:
            if cb in used_b:
                continue
            s = _similarity_score(ca, cb)
            if s > best_score:
                best_score, best_cb = s, cb
        if best_cb and best_score >= 0.6:
            reason_map = {
                1.0: "Exact match — identical column names.",
                0.8: "High confidence — shared tokens in column names.",
                0.7: "Likely match — one column name contains the other.",
                0.6: "Semantic match — both columns belong to the same concept group (e.g. ID, name, salary).",
            }
            mappings.append({
                "source_column": ca,
                "target_column": best_cb,
                "confidence": best_score,
                "reason": reason_map.get(best_score, "Pattern-based similarity match."),
                "ai_generated": False,
            })
            used_b.add(best_cb)
    return mappings


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------
def _read_dataset(file_path: str) -> pd.DataFrame:
    p = Path(file_path)
    if p.suffix == ".csv":
        return pd.read_csv(p)
    elif p.suffix == ".xlsx":
        return pd.read_excel(p)
    elif p.suffix == ".json":
        return pd.read_json(p)
    raise ValueError(f"Unsupported file type: {p.suffix}")


def _profile_df(df: pd.DataFrame) -> dict:
    col_info = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        missing = int(df[col].isna().sum())
        unique = int(df[col].nunique())
        sample = [str(v) for v in df[col].dropna().head(5).tolist()]
        col_info.append({
            "name": col,
            "dtype": dtype,
            "missing": missing,
            "unique": unique,
            "sample": sample,
        })
    return {
        "rows": len(df),
        "columns": len(df.columns),
        "column_info": col_info,
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
    }


def _quality_score(df: pd.DataFrame) -> float:
    total_cells = df.shape[0] * df.shape[1]
    if total_cells == 0:
        return 100.0
    missing = df.isna().sum().sum()
    dupes = df.duplicated().sum()
    penalty = (missing / total_cells) * 60 + (dupes / max(len(df), 1)) * 40
    return round(max(0.0, 100.0 - penalty), 1)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create sample data on startup
    _create_sample_data()
    yield


app = FastAPI(title="DataBridge AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _create_sample_data():
    samples_dir = UPLOAD_DIR / "samples"
    samples_dir.mkdir(exist_ok=True)

    employees_path = samples_dir / "employees.csv"
    if not employees_path.exists():
        employees_csv = """employee_id,employee_name,department,hire_date,email,phone
E001,Alice Johnson,Engineering,2021-03-15,alice.johnson@company.com,555-1001
E002,Bob Smith,Marketing,2020-07-22,bob.smith@company.com,555-1002
E003,Carol White,Engineering,2022-01-10,carol.white@company.com,555-1003
E004,David Brown,HR,2019-11-05,david.brown@company.com,555-1004
E005,Eva Martinez,Finance,2021-08-30,eva.martinez@company.com,555-1005
E002,Bob Smith,Marketing,2020-07-22,bob.smith@company.com,555-1002
E006,Frank Lee,Engineering,2023-02-14,,555-1006
E007,Grace Kim,Marketing,2022-09-01,grace.kim@company.com,
E008,Henry Davis,Finance,2020-12-20,henry.davis@company.com,555-1008
E009,Iris Chen,HR,2021-05-17,iris.chen@company.com,555-1009
E010,Jack Wilson,Engineering,2023-06-01,jack.wilson@company.com,555-1010
"""
        employees_path.write_text(employees_csv)

    payroll_path = samples_dir / "payroll.csv"
    if not payroll_path.exists():
        payroll_csv = """staff_code,full_name,department_name,annual_salary,bonus,tax_rate
E001,Alice Johnson,Engineering,95000,5000,0.28
E002,Bob Smith,Marketing,72000,3000,0.24
E003,carol white,Engineering,88000,4500,0.26
E004,David Brown,Human Resources,,2000,0.22
E005,Eva Martinez,Finance,105000,6000,0.30
E007,Grace Kim,MARKETING,68000,2500,0.22
E008,Henry Davis,Finance,92000,4800,0.27
E009,Iris Chen,Human Resources,78000,3500,0.24
E011,Laura Adams,Engineering,91000,4700,0.27
E012,Mike Turner,Finance,,3200,0.26
"""
        payroll_path.write_text(payroll_csv)

    departments_path = samples_dir / "departments.csv"
    if not departments_path.exists():
        departments_csv = """dept_code,department_name,manager_name,budget,location
D001,Engineering,Alice Johnson,500000,New York
D002,Marketing,Bob Smith,250000,Chicago
D003,HR,David Brown,150000,Austin
D004,Finance,Eva Martinez,350000,San Francisco
D005,Operations,Tom Hayes,200000,Boston
"""
        departments_path.write_text(departments_csv)


# ===========================================================================
# Routes: Datasets
# ===========================================================================

@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: .{ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(400, f"File too large ({size_mb:.1f} MB). Max allowed: {MAX_FILE_SIZE_MB} MB")

    dataset_id = str(uuid.uuid4())
    safe_name = f"{dataset_id}.{ext}"
    file_path = UPLOAD_DIR / safe_name
    file_path.write_bytes(content)

    try:
        df = _read_dataset(str(file_path))
        if len(df.columns) == 0:
            raise ValueError("Uploaded file contains no columns or readable data.")
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(422, f"Could not parse file: {e}")

    profile = _profile_df(df)

    db = SessionLocal()
    try:
        ds = DatasetModel(
            id=dataset_id,
            filename=safe_name,
            original_filename=file.filename,
            file_path=str(file_path),
            rows=profile["rows"],
            columns=profile["columns"],
            column_info=json.dumps(profile["column_info"]),
            missing_values=profile["missing_values"],
            duplicate_rows=profile["duplicate_rows"],
            file_size_kb=round(len(content) / 1024, 2),
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)
    finally:
        db.close()

    return {
        "id": dataset_id,
        "filename": file.filename,
        "rows": profile["rows"],
        "columns": profile["columns"],
        "column_info": profile["column_info"],
        "missing_values": profile["missing_values"],
        "duplicate_rows": profile["duplicate_rows"],
        "file_size_kb": round(len(content) / 1024, 2),
        "uploaded_at": datetime.utcnow().isoformat(),
    }


@app.get("/api/datasets")
def list_datasets():
    db = SessionLocal()
    try:
        rows = db.query(DatasetModel).order_by(DatasetModel.uploaded_at.desc()).all()
        return [
            {
                "id": r.id,
                "filename": r.original_filename,
                "rows": r.rows,
                "columns": r.columns,
                "column_info": json.loads(r.column_info) if r.column_info else [],
                "missing_values": r.missing_values,
                "duplicate_rows": r.duplicate_rows,
                "file_size_kb": r.file_size_kb,
                "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
            }
            for r in rows
        ]
    finally:
        db.close()


@app.get("/api/datasets/{dataset_id}/preview")
def preview_dataset(dataset_id: str, rows: int = 10):
    db = SessionLocal()
    try:
        ds = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
        if not ds:
            raise HTTPException(404, "Dataset not found")
        df = _read_dataset(ds.file_path)
        preview = df.head(rows).replace({np.nan: None}).to_dict(orient="records")
        return {
            "id": dataset_id,
            "filename": ds.original_filename,
            "columns": list(df.columns),
            "preview": preview,
            "total_rows": len(df),
        }
    finally:
        db.close()


@app.get("/api/datasets/{dataset_id}/sample")
def download_sample(dataset_id: str):
    # handles pre-built sample files referenced by special IDs
    samples = {
        "sample-employees": UPLOAD_DIR / "samples" / "employees.csv",
        "sample-payroll": UPLOAD_DIR / "samples" / "payroll.csv",
        "sample-departments": UPLOAD_DIR / "samples" / "departments.csv",
    }
    path = samples.get(dataset_id)
    if path and path.exists():
        content = path.read_bytes()
        return StreamingResponse(
            io.BytesIO(content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={path.name}"},
        )
    raise HTTPException(404, "Sample not found")


@app.post("/api/datasets/load-sample/{sample_id}")
def load_sample_dataset(sample_id: str):
    samples = {
        "sample-employees": ("employees.csv", UPLOAD_DIR / "samples" / "employees.csv"),
        "sample-payroll": ("payroll.csv", UPLOAD_DIR / "samples" / "payroll.csv"),
        "sample-departments": ("departments.csv", UPLOAD_DIR / "samples" / "departments.csv"),
    }
    item = samples.get(sample_id)
    if not item or not item[1].exists():
        raise HTTPException(404, "Sample not found")

    orig_name, src_path = item
    content = src_path.read_bytes()
    dataset_id = str(uuid.uuid4())
    safe_name = f"{dataset_id}.csv"
    dest_path = UPLOAD_DIR / safe_name
    dest_path.write_bytes(content)

    df = _read_dataset(str(dest_path))
    profile = _profile_df(df)

    db = SessionLocal()
    try:
        ds = DatasetModel(
            id=dataset_id,
            filename=safe_name,
            original_filename=orig_name,
            file_path=str(dest_path),
            rows=profile["rows"],
            columns=profile["columns"],
            column_info=json.dumps(profile["column_info"]),
            missing_values=profile["missing_values"],
            duplicate_rows=profile["duplicate_rows"],
            file_size_kb=round(len(content) / 1024, 2),
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)
    finally:
        db.close()

    return {
        "id": dataset_id,
        "filename": orig_name,
        "rows": profile["rows"],
        "columns": profile["columns"],
        "column_info": profile["column_info"],
        "missing_values": profile["missing_values"],
        "duplicate_rows": profile["duplicate_rows"],
        "file_size_kb": round(len(content) / 1024, 2),
        "uploaded_at": datetime.utcnow().isoformat(),
    }


@app.get("/api/samples")
def list_samples():
    return [
        {"id": "sample-employees", "name": "employees.csv", "description": "Employee records with some duplicates and missing emails"},
        {"id": "sample-payroll", "name": "payroll.csv", "description": "Payroll data with missing salaries and name inconsistencies"},
        {"id": "sample-departments", "name": "departments.csv", "description": "Department hierarchy with budgets and locations"},
    ]


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: str):
    db = SessionLocal()
    try:
        ds = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
        if not ds:
            raise HTTPException(404, "Dataset not found")
        Path(ds.file_path).unlink(missing_ok=True)
        db.delete(ds)
        db.commit()
        return {"message": "Dataset deleted"}
    finally:
        db.close()


# ===========================================================================
# Routes: Schema Analysis
# ===========================================================================

class SchemaAnalyzeRequest(BaseModel):
    dataset_a_id: str
    dataset_b_id: str


@app.post("/api/schema/analyze")
def analyze_schema(req: SchemaAnalyzeRequest):
    db = SessionLocal()
    try:
        ds_a = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_a_id).first()
        ds_b = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_b_id).first()
        if not ds_a or not ds_b:
            raise HTTPException(404, "One or both datasets not found")

        cols_a = json.loads(ds_a.column_info)
        cols_b = json.loads(ds_b.column_info)
        names_a = [c["name"] for c in cols_a]
        names_b = [c["name"] for c in cols_b]
    finally:
        db.close()

    # Try AI
    ai_text = None
    prompt = f"""You are a data integration expert. Analyze these two dataset schemas and suggest column mappings.

Dataset A columns: {names_a}
Dataset B columns: {names_b}

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{{
  "mappings": [
    {{
      "source_column": "column_from_A",
      "target_column": "column_from_B",
      "confidence": 0.95,
      "reason": "explanation"
    }}
  ],
  "join_recommendation": "which columns to use for joining",
  "notes": "any important observations"
}}"""

    ai_text = _call_ai(prompt)
    ai_generated = False
    mappings = []
    join_rec = ""
    notes = ""

    if ai_text:
        try:
            # strip markdown fences if present
            cleaned = re.sub(r"```(?:json)?", "", ai_text).strip().strip("`").strip()
            parsed = json.loads(cleaned)
            raw_mappings = parsed.get("mappings", [])
            # validate columns exist
            for m in raw_mappings:
                if m.get("source_column") in names_a and m.get("target_column") in names_b:
                    mappings.append({
                        "source_column": m["source_column"],
                        "target_column": m["target_column"],
                        "confidence": float(m.get("confidence", 0.7)),
                        "reason": m.get("reason", "AI suggested match"),
                        "ai_generated": True,
                    })
            join_rec = parsed.get("join_recommendation", "")
            notes = parsed.get("notes", "")
            ai_generated = True
        except Exception as e:
            print(f"[Schema] AI parse error: {e}")

    if not mappings:
        mappings = _deterministic_schema_mapping(names_a, names_b)
        join_rec = "Use the highest-confidence column pair as the join key."
        notes = "Mappings generated using deterministic pattern matching (AI unavailable or returned invalid data)."

    return {
        "dataset_a": {"id": req.dataset_a_id, "columns": names_a},
        "dataset_b": {"id": req.dataset_b_id, "columns": names_b},
        "mappings": mappings,
        "join_recommendation": join_rec,
        "notes": notes,
        "ai_generated": ai_generated,
    }


class SchemaMappingRequest(BaseModel):
    dataset_a_id: str
    dataset_b_id: str
    mappings: List[Dict[str, Any]]
    join_key_a: str
    join_key_b: str
    join_type: str = "inner"


@app.post("/api/schema/map")
def apply_schema_mapping(req: SchemaMappingRequest):
    db = SessionLocal()
    try:
        ds_a = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_a_id).first()
        ds_b = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_b_id).first()
        if not ds_a or not ds_b:
            raise HTTPException(404, "One or both datasets not found")
        df_a = _read_dataset(ds_a.file_path)
        df_b = _read_dataset(ds_b.file_path)
        name_a = ds_a.original_filename
        name_b = ds_b.original_filename
    finally:
        db.close()

    # validate join keys
    if req.join_key_a not in df_a.columns:
        raise HTTPException(400, f"Column '{req.join_key_a}' not found in {name_a}")
    if req.join_key_b not in df_b.columns:
        raise HTTPException(400, f"Column '{req.join_key_b}' not found in {name_b}")

    # Rename B columns per mapping for preview
    rename_map = {m["target_column"]: m["source_column"] for m in req.mappings
                  if m.get("target_column") in df_b.columns and m.get("source_column") not in df_b.columns}
    df_b_renamed = df_b.rename(columns=rename_map)
    join_key_b_renamed = rename_map.get(req.join_key_b, req.join_key_b)

    jt = req.join_type.lower()
    if jt not in ("inner", "left", "right", "outer"):
        jt = "inner"
    merged = pd.merge(df_a, df_b_renamed, left_on=req.join_key_a, right_on=join_key_b_renamed, how=jt, suffixes=("_a", "_b"))

    preview = merged.head(10).replace({np.nan: None}).to_dict(orient="records")
    return {
        "preview": preview,
        "columns": list(merged.columns),
        "total_rows": len(merged),
        "join_type": jt,
    }


# ===========================================================================
# Routes: AI Plan
# ===========================================================================

class AIPlanRequest(BaseModel):
    instruction: str
    dataset_ids: List[str]


@app.post("/api/ai/plan")
def ai_plan(req: AIPlanRequest):
    db = SessionLocal()
    try:
        datasets_info = []
        for did in req.dataset_ids:
            ds = db.query(DatasetModel).filter(DatasetModel.id == did).first()
            if ds:
                cols = [c["name"] for c in json.loads(ds.column_info)]
                datasets_info.append({"name": ds.original_filename, "id": did, "columns": cols})
    finally:
        db.close()

    if not datasets_info:
        raise HTTPException(404, "No datasets found")

    prompt = f"""You are a data integration AI. The user wants to perform a data operation.

User instruction: "{req.instruction}"

Available datasets:
{json.dumps(datasets_info, indent=2)}

Create a structured transformation plan. Return ONLY valid JSON:
{{
  "summary": "brief description of what will be done",
  "steps": [
    {{
      "step": 1,
      "operation": "join|deduplicate|fill_missing|rename|filter|sort|type_convert|standardize",
      "description": "human-readable description",
      "params": {{}}
    }}
  ],
  "join_key_recommendation": "column name to join on (if applicable)",
  "warnings": ["list of potential issues"]
}}

Only use operations from: join, deduplicate, fill_missing, rename, filter, sort, type_convert, standardize"""

    ai_text = _call_ai(prompt)
    plan = None

    if ai_text:
        try:
            cleaned = re.sub(r"```(?:json)?", "", ai_text).strip().strip("`").strip()
            plan = json.loads(cleaned)
        except Exception as e:
            print(f"[AI Plan] parse error: {e}")

    if not plan:
        # deterministic fallback plan
        instruction_lower = req.instruction.lower()
        steps = []
        step_num = 1

        if len(datasets_info) > 1 and any(w in instruction_lower for w in ["combine", "join", "merge", "integrate"]):
            steps.append({
                "step": step_num, "operation": "join",
                "description": f"Join {datasets_info[0]['name']} with {datasets_info[1]['name']} on matching ID column",
                "params": {"join_type": "inner", "dataset_a_id": datasets_info[0]["id"],
                           "dataset_b_id": datasets_info[1]["id"] if len(datasets_info) > 1 else ""}
            })
            step_num += 1

        if any(w in instruction_lower for w in ["duplicate", "dedup", "unique"]):
            steps.append({"step": step_num, "operation": "deduplicate",
                          "description": "Remove duplicate records", "params": {}})
            step_num += 1

        if any(w in instruction_lower for w in ["missing", "null", "empty", "fill"]):
            steps.append({"step": step_num, "operation": "fill_missing",
                          "description": "Handle missing values by filling with appropriate defaults", "params": {"strategy": "mean_or_unknown"}})
            step_num += 1

        if not steps:
            steps.append({"step": 1, "operation": "deduplicate",
                          "description": "Remove duplicate records from dataset", "params": {}})
            steps.append({"step": 2, "operation": "fill_missing",
                          "description": "Handle missing values", "params": {"strategy": "mean_or_unknown"}})

        plan = {
            "summary": f"Automated plan for: {req.instruction}",
            "steps": steps,
            "join_key_recommendation": "id or code column",
            "warnings": ["Plan generated using rule-based fallback (AI unavailable). Please review before execution."],
            "ai_generated": False,
        }
    else:
        plan["ai_generated"] = True

    return {"plan": plan, "datasets": datasets_info}


# ===========================================================================
# Routes: Transform Preview & Execute
# ===========================================================================

class TransformPreviewRequest(BaseModel):
    dataset_a_id: str
    dataset_b_id: Optional[str] = None
    operations: List[Dict[str, Any]]
    join_key_a: Optional[str] = None
    join_key_b: Optional[str] = None
    join_type: str = "inner"


def _apply_operations(df: pd.DataFrame, df_b: Optional[pd.DataFrame],
                      operations: List[dict], join_key_a: str, join_key_b: str, join_type: str) -> pd.DataFrame:
    result = df.copy()

    for op in operations:
        op_type = op.get("operation", "").lower()
        params = op.get("params", {})

        if op_type == "join" and df_b is not None:
            jt = params.get("join_type", join_type).lower()
            lk = params.get("left_key", join_key_a)
            rk = params.get("right_key", join_key_b)
            if lk in result.columns and rk in df_b.columns:
                result = pd.merge(result, df_b, left_on=lk, right_on=rk, how=jt, suffixes=("_a", "_b"))

        elif op_type == "deduplicate":
            subset = params.get("subset", None)
            result = result.drop_duplicates(subset=subset)

        elif op_type == "fill_missing":
            strategy = params.get("strategy", "mean_or_unknown")
            for col in result.columns:
                if result[col].isna().any():
                    if strategy == "drop":
                        result = result.dropna(subset=[col])
                    elif strategy == "mean" and pd.api.types.is_numeric_dtype(result[col]):
                        result[col] = result[col].fillna(result[col].mean())
                    elif strategy == "median" and pd.api.types.is_numeric_dtype(result[col]):
                        result[col] = result[col].fillna(result[col].median())
                    else:
                        # mean_or_unknown
                        if pd.api.types.is_numeric_dtype(result[col]):
                            result[col] = result[col].fillna(result[col].mean())
                        else:
                            result[col] = result[col].fillna("Unknown")

        elif op_type == "rename":
            rename_map = params.get("columns", {})
            result = result.rename(columns=rename_map)

        elif op_type == "filter":
            col = params.get("column")
            operator = params.get("operator", "eq")
            value = params.get("value")
            if col and col in result.columns and value is not None:
                if operator == "eq":
                    result = result[result[col] == value]
                elif operator == "ne":
                    result = result[result[col] != value]
                elif operator == "gt":
                    result = result[result[col] > value]
                elif operator == "lt":
                    result = result[result[col] < value]
                elif operator == "contains":
                    result = result[result[col].astype(str).str.contains(str(value), na=False)]

        elif op_type == "sort":
            col = params.get("column")
            ascending = params.get("ascending", True)
            if col and col in result.columns:
                result = result.sort_values(col, ascending=ascending)

        elif op_type == "standardize":
            col = params.get("column")
            mode = params.get("mode", "lower")
            if col and col in result.columns:
                if mode == "lower":
                    result[col] = result[col].astype(str).str.lower().str.strip()
                elif mode == "upper":
                    result[col] = result[col].astype(str).str.upper().str.strip()
                elif mode == "title":
                    result[col] = result[col].astype(str).str.title().str.strip()

        elif op_type == "type_convert":
            col = params.get("column")
            to_type = params.get("to_type", "str")
            if col and col in result.columns:
                try:
                    if to_type in ("int", "integer"):
                        result[col] = pd.to_numeric(result[col], errors="coerce").astype("Int64")
                    elif to_type == "float":
                        result[col] = pd.to_numeric(result[col], errors="coerce")
                    elif to_type in ("str", "string"):
                        result[col] = result[col].astype(str)
                    elif to_type == "datetime":
                        result[col] = pd.to_datetime(result[col], errors="coerce")
                except Exception:
                    pass

    return result


@app.post("/api/transform/preview")
def transform_preview(req: TransformPreviewRequest):
    db = SessionLocal()
    try:
        ds_a = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_a_id).first()
        if not ds_a:
            raise HTTPException(404, "Primary dataset not found")
        df_a = _read_dataset(ds_a.file_path)
        df_b = None
        if req.dataset_b_id:
            ds_b = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_b_id).first()
            if ds_b:
                df_b = _read_dataset(ds_b.file_path)
    finally:
        db.close()

    before_rows = len(df_a)
    try:
        result = _apply_operations(df_a, df_b, req.operations,
                                   req.join_key_a or "", req.join_key_b or "", req.join_type)
    except Exception as e:
        raise HTTPException(422, f"Transformation error: {e}")

    return {
        "preview": result.head(10).replace({np.nan: None}).to_dict(orient="records"),
        "columns": list(result.columns),
        "before_rows": before_rows,
        "after_rows": len(result),
        "rows_removed": before_rows - len(result),
    }


class TransformExecuteRequest(BaseModel):
    name: str
    dataset_a_id: str
    dataset_b_id: Optional[str] = None
    operations: List[Dict[str, Any]]
    join_key_a: Optional[str] = None
    join_key_b: Optional[str] = None
    join_type: str = "inner"


@app.post("/api/transform/execute")
def transform_execute(req: TransformExecuteRequest):
    db = SessionLocal()
    try:
        ds_a = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_a_id).first()
        if not ds_a:
            raise HTTPException(404, "Primary dataset not found")
        df_a = _read_dataset(ds_a.file_path)
        name_a = ds_a.original_filename
        df_b = None
        name_b = None
        if req.dataset_b_id:
            ds_b = db.query(DatasetModel).filter(DatasetModel.id == req.dataset_b_id).first()
            if ds_b:
                df_b = _read_dataset(ds_b.file_path)
                name_b = ds_b.original_filename
    finally:
        db.close()

    start_time = time.time()
    before_rows = len(df_a)
    duplicates_before = int(df_a.duplicated().sum())
    missing_before = int(df_a.isna().sum().sum())

    try:
        result = _apply_operations(df_a, df_b, req.operations,
                                   req.join_key_a or "", req.join_key_b or "", req.join_type)
    except Exception as e:
        raise HTTPException(422, f"Transformation error: {e}")

    elapsed_ms = int((time.time() - start_time) * 1000)
    after_rows = len(result)
    duplicates_removed = duplicates_before - int(result.duplicated().sum())
    missing_handled = missing_before - int(result.isna().sum().sum())
    qs = _quality_score(result)

    # Save output
    job_id = str(uuid.uuid4())
    out_path = OUTPUT_DIR / f"{job_id}.csv"
    result.to_csv(out_path, index=False)

    # Store integration record
    db2 = SessionLocal()
    try:
        ids = [req.dataset_a_id] + ([req.dataset_b_id] if req.dataset_b_id else [])
        names = [name_a] + ([name_b] if name_b else [])
        job = IntegrationModel(
            id=job_id,
            name=req.name,
            source_dataset_ids=json.dumps(ids),
            source_dataset_names=json.dumps(names),
            transformation_plan=json.dumps(req.operations),
            status="completed",
            records_input=before_rows,
            records_output=after_rows,
            duplicates_removed=max(0, duplicates_removed),
            missing_handled=max(0, missing_handled),
            quality_score=qs,
            output_file_path=str(out_path),
            processing_time_ms=elapsed_ms,
            completed_at=datetime.utcnow(),
        )
        db2.add(job)
        db2.commit()
        db2.refresh(job)
    finally:
        db2.close()

    return {
        "id": job_id,
        "name": req.name,
        "status": "completed",
        "records_input": before_rows,
        "records_output": after_rows,
        "duplicates_removed": max(0, duplicates_removed),
        "missing_handled": max(0, missing_handled),
        "quality_score": qs,
        "processing_time_ms": elapsed_ms,
        "preview": result.head(10).replace({np.nan: None}).to_dict(orient="records"),
        "columns": list(result.columns),
    }


# ===========================================================================
# Routes: Integrations / History
# ===========================================================================

@app.get("/api/integrations")
def list_integrations():
    db = SessionLocal()
    try:
        rows = db.query(IntegrationModel).order_by(IntegrationModel.created_at.desc()).all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "source_dataset_names": json.loads(r.source_dataset_names or "[]"),
                "status": r.status,
                "records_input": r.records_input,
                "records_output": r.records_output,
                "duplicates_removed": r.duplicates_removed,
                "missing_handled": r.missing_handled,
                "quality_score": r.quality_score,
                "processing_time_ms": r.processing_time_ms,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in rows
        ]
    finally:
        db.close()


@app.get("/api/integrations/{integration_id}")
def get_integration(integration_id: str):
    db = SessionLocal()
    try:
        r = db.query(IntegrationModel).filter(IntegrationModel.id == integration_id).first()
        if not r:
            raise HTTPException(404, "Integration not found")

        output_preview = []
        output_columns = []
        if r.output_file_path and Path(r.output_file_path).exists():
            try:
                out_df = pd.read_csv(r.output_file_path)
                output_preview = out_df.head(10).replace({np.nan: None}).to_dict(orient="records")
                output_columns = list(out_df.columns)
            except Exception:
                pass

        return {
            "id": r.id,
            "name": r.name,
            "source_dataset_ids": json.loads(r.source_dataset_ids or "[]"),
            "source_dataset_names": json.loads(r.source_dataset_names or "[]"),
            "transformation_plan": json.loads(r.transformation_plan or "[]"),
            "status": r.status,
            "records_input": r.records_input,
            "records_output": r.records_output,
            "duplicates_removed": r.duplicates_removed,
            "missing_handled": r.missing_handled,
            "quality_score": r.quality_score,
            "output_file_path": r.output_file_path,
            "output_preview": output_preview,
            "output_columns": output_columns,
            "error_message": r.error_message,
            "processing_time_ms": r.processing_time_ms,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
    finally:
        db.close()


@app.get("/api/integrations/{integration_id}/export")
def export_integration(integration_id: str, fmt: str = "csv"):
    db = SessionLocal()
    try:
        r = db.query(IntegrationModel).filter(IntegrationModel.id == integration_id).first()
        if not r:
            raise HTTPException(404, "Integration not found")
        if not r.output_file_path or not Path(r.output_file_path).exists():
            raise HTTPException(404, "Output file not available")
        df = pd.read_csv(r.output_file_path)
    finally:
        db.close()

    buf = io.BytesIO()
    if fmt == "xlsx":
        with pd.ExcelWriter(buf, engine="xlsxwriter") as writer:
            df.to_excel(writer, index=False)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": f"attachment; filename=integration_{integration_id}.xlsx"})
    elif fmt == "json":
        content = df.to_json(orient="records", indent=2)
        return StreamingResponse(io.StringIO(content), media_type="application/json",
                                 headers={"Content-Disposition": f"attachment; filename=integration_{integration_id}.json"})
    else:
        content = df.to_csv(index=False)
        return StreamingResponse(io.StringIO(content), media_type="text/csv",
                                 headers={"Content-Disposition": f"attachment; filename=integration_{integration_id}.csv"})


# ===========================================================================
# Routes: Data Quality
# ===========================================================================

@app.get("/api/quality/{dataset_id}")
def data_quality(dataset_id: str):
    db = SessionLocal()
    try:
        ds = db.query(DatasetModel).filter(DatasetModel.id == dataset_id).first()
        if not ds:
            raise HTTPException(404, "Dataset not found")
        df = _read_dataset(ds.file_path)
    finally:
        db.close()

    total = len(df)
    duplicate_count = int(df.duplicated().sum())
    missing_count = int(df.isna().sum().sum())
    empty_cols = [c for c in df.columns if df[c].isna().all()]

    # column-level quality
    col_quality = []
    for col in df.columns:
        missing = int(df[col].isna().sum())
        unique = int(df[col].nunique())
        completeness = round((1 - missing / max(total, 1)) * 100, 1)
        # email check
        invalid_emails = 0
        if "email" in col.lower() and df[col].dtype == object:
            email_pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
            valid_mask = df[col].dropna().str.match(email_pattern)
            invalid_emails = int((~valid_mask).sum())

        # format consistency for string cols
        inconsistent_formats = 0
        if df[col].dtype == object and not df[col].isna().all():
            lengths = df[col].dropna().str.len()
            if lengths.std() > lengths.mean() * 0.5:
                inconsistent_formats = int((lengths < lengths.mean() * 0.3).sum())

        issues = []
        if missing > 0:
            issues.append(f"{missing} missing value(s)")
        if invalid_emails > 0:
            issues.append(f"{invalid_emails} invalid email(s)")
        if inconsistent_formats > 0:
            issues.append(f"Inconsistent format in {inconsistent_formats} record(s)")

        col_quality.append({
            "column": col,
            "dtype": str(df[col].dtype),
            "missing": missing,
            "unique": unique,
            "completeness": completeness,
            "invalid_emails": invalid_emails,
            "inconsistent_formats": inconsistent_formats,
            "issues": issues,
        })

    qs = _quality_score(df)
    valid_records = total - duplicate_count
    invalid_records = missing_count + duplicate_count

    return {
        "dataset_id": dataset_id,
        "total_records": total,
        "valid_records": max(0, valid_records),
        "invalid_records": min(invalid_records, total),
        "duplicate_count": duplicate_count,
        "missing_value_count": missing_count,
        "empty_columns": empty_cols,
        "quality_score": qs,
        "column_quality": col_quality,
        "summary": {
            "completeness": round((1 - missing_count / max(total * len(df.columns), 1)) * 100, 1),
            "uniqueness": round((1 - duplicate_count / max(total, 1)) * 100, 1),
            "validity": qs,
        }
    }


# ===========================================================================
# Routes: Overview / Stats
# ===========================================================================

@app.get("/api/overview/stats")
def overview_stats():
    db = SessionLocal()
    try:
        total_datasets = db.query(DatasetModel).count()
        integrations = db.query(IntegrationModel).all()
        total_integrations = len(integrations)
        successful = sum(1 for i in integrations if i.status == "completed")
        failed = sum(1 for i in integrations if i.status == "failed")
        total_records = sum(i.records_output or 0 for i in integrations)
        total_dupes = sum(i.duplicates_removed or 0 for i in integrations)
        avg_quality = round(
            sum(i.quality_score or 0 for i in integrations) / max(len(integrations), 1), 1
        )

        # activity for last 7 days
        from collections import defaultdict
        activity = defaultdict(int)
        for i in integrations:
            if i.created_at:
                day = i.created_at.strftime("%Y-%m-%d")
                activity[day] += 1

        # quality distribution
        quality_dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
        for i in integrations:
            qs = i.quality_score or 0
            if qs >= 90:
                quality_dist["excellent"] += 1
            elif qs >= 75:
                quality_dist["good"] += 1
            elif qs >= 50:
                quality_dist["fair"] += 1
            else:
                quality_dist["poor"] += 1

        recent_jobs = []
        for i in sorted(integrations, key=lambda x: x.created_at or datetime.min, reverse=True)[:5]:
            recent_jobs.append({
                "id": i.id,
                "name": i.name,
                "status": i.status,
                "records_output": i.records_output,
                "quality_score": i.quality_score,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            })

        return {
            "total_datasets": total_datasets,
            "total_integrations": total_integrations,
            "successful_integrations": successful,
            "failed_integrations": failed,
            "total_records_processed": total_records,
            "total_duplicates_detected": total_dupes,
            "average_quality_score": avg_quality,
            "activity_by_day": dict(sorted(activity.items())[-7:]),
            "quality_distribution": quality_dist,
            "recent_jobs": recent_jobs,
        }
    finally:
        db.close()


@app.get("/api/ai/status")
def ai_status():
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    gemini_set = bool(gemini_key and gemini_key != "your_gemini_api_key_here")
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_set = bool(groq_key and groq_key != "your_groq_api_key_here")

    test_result = _call_ai("Respond with 'OK' if you can read this.")
    if test_result:
        return {
            "ai_active": True,
            "provider": os.getenv("AI_PROVIDER", "gemini").lower(),
            "status": "connected",
            "gemini_key_configured": gemini_set,
            "groq_key_configured": groq_set,
            "message": f"Successfully connected to {os.getenv('AI_PROVIDER', 'gemini').capitalize()} AI API.",
        }
    else:
        return {
            "ai_active": False,
            "provider": "deterministic_fallback",
            "status": "fallback_active",
            "gemini_key_configured": gemini_set,
            "groq_key_configured": groq_set,
            "message": "Deterministic rule-based fallback engine is active. Set a valid GEMINI_API_KEY in backend/.env to enable live AI.",
        }


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0", "ai_provider": AI_PROVIDER}
