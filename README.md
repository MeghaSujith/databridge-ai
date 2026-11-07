# DataBridge AI – Intelligent Enterprise Data Integration Platform

> An AI-powered enterprise data integration and ETL platform built with React 19, FastAPI, Pandas, and Google Gemini API (with deterministic offline fallback).

---

## 1. Executive Summary & Problem Statement

Modern organizations frequently struggle with data silos across legacy databases, enterprise resource planning systems (such as SAP or Oracle), customer relationship management tools (such as Salesforce), HR systems (such as Workday), and operational flat files. Every department maintains its own naming conventions (`employee_id` vs `staff_code`), data hygiene challenges (duplicate records, missing values, inconsistent casing), and distinct schemas.

*(Note: Systems such as SAP, Oracle, Salesforce, and Workday represent typical enterprise source silos whose exported datasets in CSV, Excel, or JSON format can be ingested into DataBridge AI; direct native API connectors for these platforms are planned for future releases.)*

**DataBridge AI** delivers a unified, intelligent integration workflow:
1. **AI-Powered Schema Mapping:** Semantic similarity analysis using Google Gemini or deterministic pattern matching to auto-align columns with confidence ratings and reasoning.
2. **Natural Language Pipeline Generation:** Users express ETL requirements in conversational English; the AI generates a structured, safe, multi-step transformation plan.
3. **Data Quality Profiling Engine:** Automated multi-dimensional data profiling (completeness, uniqueness, validity scoring, regex email format validation, and string length inconsistency checking).
4. **Visual Transformation Studio:** Live preview and execution of 8 core enterprise transformations using Pandas.
5. **Job Audit Trail & Execution History:** Complete historical log of execution time, records in/out, duplicates removed, and multi-format exports (CSV, Excel XLSX, JSON).

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React 19 Frontend (Vite 8 + Tailwind v4)             │
│   IBM Enterprise Aesthetic (Dark Navy Sidebar, Blue Accents, Plex Sans)│
│                                                                        │
│  [Overview]  [Data Sources]  [Schema Mapping]  [Transform Studio]      │
│  [Data Quality]  [Integration History]  [Platform Settings]            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (/api proxy)
┌───────────────────────────────────▼────────────────────────────────────┐
│                        FastAPI Backend (Python)                        │
│                                                                        │
│   Dataset Management   Schema Analyzer   AI Planner   Transform Engine │
│   Quality Profiler     History & Audit   Export Service (XLSX/CSV/JSON)│
└───────────────┬───────────────────────────────┬────────────────────────┘
                │                               │
       ┌────────▼────────┐             ┌────────▼────────┐
       │  Pandas Engine  │             │   AI Service    │
       │  Vectorized ETL │             │  Google Gemini  │
       │  Quality Rules  │             │   REST API +    │
       └────────┬────────┘             │  Deterministic  │
                │                      │    Fallback     │
       ┌────────▼────────┐             └─────────────────┘
       │     SQLite      │
       │  (SQLAlchemy)   │
       └─────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Details | Role |
|---|---|---|---|
| **Frontend Framework** | React 19 (`^19.3.1`), Vite 8 (`^8.3.6`) | React Single-Page Application | Responsive user interface |
| **Styling & Theme** | Tailwind CSS v4 (`^4.3.4`), IBM Plex Sans | Carbon-inspired enterprise SaaS aesthetic | Consistent design system |
| **Data Visualization** | Recharts (`^3.10.1`) | SVG-based charting | Integration activity and quality charts |
| **Iconography** | Lucide React (`^1.70.0`) | Icon component library | System navigation and status icons |
| **Backend Framework** | FastAPI (`0.115.6`), Uvicorn (`0.32.1`) | Python 3.10+ (tested on 3.14) | Asynchronous REST API |
| **Data Engine** | Pandas (`>=2.2.3`), NumPy (`>=2.1.0`) | Vectorized processing | In-memory joins, filtering, imputations |
| **Database** | SQLite via SQLAlchemy (`>=2.0.36`) | Relational persistence | Dataset metadata and job execution records |
| **Primary AI Model** | Google Gemini API (`gemini-3.1-flash-lite`) | Google Generative Language API | Semantic schema mapping & pipeline planning |
| **AI Fallback Cascade** | Flash-Lite cascade / Groq (`llama3-8b-8192`) | Automatic model rotation | Resilient AI inference |
| **Offline Fallback** | Deterministic Regex & Synonym Graph | Local rule-based engine | Enables core ETL operations without API keys |
| **Export Engines** | XlsxWriter (`>=3.2.0`), OpenPyXL (`>=3.1.2`) | Binary and formatted output | Multi-format exports (CSV, XLSX, JSON) |

---

## 4. Key Features

### 4.1. Enterprise Dashboard
- Real-time aggregate KPIs derived directly from SQLite: total datasets, successful integrations, processed records, duplicates purged, average quality score.
- Integration activity trend chart and quality distribution breakdown.
- Recent integration jobs table with live status badges and direct navigation.

### 4.2. Data Source Management & Ingestion
- Ingestion of CSV, Excel (.xlsx), and JSON files up to 50 MB (configurable).
- Instant profiling upon upload: row/col count, column dtypes, missing cell counts, duplicate row counts.
- Interactive 10-row dataset preview table with column metadata chips.
- One-click sample dataset import (`employees.csv`, `payroll.csv`, `departments.csv`) with realistic enterprise data flaws.

### 4.3. AI-Powered Schema Mapping
- Compares schema between any two uploaded datasets.
- Suggests column pairs with confidence scores (0–100%) and plain-English semantic explanations.
- Editable mapping table: accept, reject, or override any suggested target column.
- Configurable join keys and join types (INNER, LEFT, RIGHT, OUTER) with real-time merged preview.
- Clear visual indicator distinguishing **Live Gemini AI** suggestions from **Deterministic Fallback Engine** results.

### 4.4. Natural Language Data Integration
- Conversational prompt interface: *"Combine employee and payroll datasets using employee ID, remove duplicates, and fill missing salaries."*
- Generates a structured transformation plan with approved steps before execution.
- Safe predefined execution primitives — strictly prevents arbitrary code execution or SQL injection.

### 4.5. Transformation Studio
- 8 core transformation operations:
  - `join`: INNER, LEFT, RIGHT, OUTER joins on specified keys (`left_key`, `right_key`, `join_type`)
  - `deduplicate`: Exact or subset-based duplicate row removal (`subset`)
  - `fill_missing`: Imputation strategies (`mean`, `median`, `drop`, `mean_or_unknown`)
  - `rename`: Column renaming dictionary mapping (`columns`)
  - `filter`: Relational comparisons (`eq`, `ne`, `gt`, `lt`, `contains`)
  - `sort`: Ascending or descending sort on a specified column (`column`, `ascending`)
  - `standardize`: Text casing normalization (`lower`, `upper`, `title`)
  - `type_convert`: Safe cast to integer, float, string, datetime (`to_type`)
- Live preview showing before/after record counts and rows removed.
- Full execution with execution duration timing in milliseconds.

### 4.6. Data Quality Profiling Engine
- Multi-dimensional data health assessment:
  - **Completeness:** Cell population percentage across the dataset
  - **Uniqueness:** Non-duplicate row ratio
  - **Validity:** Composite 0–100 quality score based on null and duplicate rates
- Column-level inspection: missing counts, unique values, regex-based invalid email detection, and string length inconsistency checking.

### 4.7. Integration History & Export
- Persistent audit trail for every executed integration job stored in SQLite.
- Expandable job details: input/output counts, duplicates removed, processing duration, transformation steps.
- Embedded output preview table showing first 10 rows of final integrated data.
- One-click export to **CSV**, **Excel (.xlsx)**, or **JSON**.

---

## 5. Security & Reliability

1. **Path Traversal Prevention:** Uploaded files are renamed using secure random UUIDs (`{uuid}.{ext}`). User-supplied filenames are stored solely as database metadata and are never used as filesystem paths.
2. **Strict File Extension Whitelist:** Only `.csv`, `.xlsx`, and `.json` extensions are accepted.
3. **Payload Size Guard:** Configurable upload ceiling (default 50 MB via `MAX_FILE_SIZE_MB`) validated before reading content into memory.
4. **No Arbitrary Code Execution:** AI returns structured JSON parameters mapped to vetted Python/Pandas functions in `_apply_operations`. No `eval()`, `exec()`, or raw SQL is executed.
5. **Environment Variable Protection:** API keys reside exclusively in backend environment configurations (`backend/.env`) and are never exposed to frontend code or client network payloads.
6. **Deterministic Offline Fallback:** When no Gemini API key is configured or when the API is unreachable, the system automatically uses rule-based heuristic planning and semantic synonym matching, allowing core workflows to execute locally without external API dependencies.

---

## 6. Installation & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.10 - 3.14)
- Node.js 18+ (tested on Node.js 20+)
- npm or pnpm

### 1. Clone & Navigate
```bash
git clone https://github.com/MeghaSujith/databridge-ai.git
cd databridge-ai
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
copy .env.example .env     # On Linux/macOS: cp .env.example .env
```

*(Optional)* Open `backend/.env` to configure your Google Gemini API key:
```ini
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Note:** If left with the placeholder value, the application runs automatically in Deterministic Fallback Mode with local pattern matching and heuristic planning.

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

---

## 7. Running the Application

### Option A: Using Startup Scripts (Windows)
- **Start Backend:** Run `start-backend.bat` (runs FastAPI on `http://localhost:8000`)
- **Start Frontend:** Run `start-frontend.bat` (runs Vite dev server on `http://localhost:5173`)

### Option B: Manual Terminal Execution

**Terminal 1 (Backend):**
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Open your browser to: **http://localhost:5173**

---

## 8. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & active AI provider info |
| `GET` | `/api/ai/status` | Connection check for Gemini API & fallback engine |
| `GET` | `/api/overview/stats` | Aggregate dashboard metrics and trend charts |
| `POST` | `/api/datasets/upload` | Multipart file upload (CSV, XLSX, JSON) |
| `GET` | `/api/datasets` | List all uploaded datasets with profiling |
| `GET` | `/api/datasets/{id}/preview` | Preview first N rows of a dataset |
| `DELETE` | `/api/datasets/{id}` | Delete a dataset and its backing file |
| `GET` | `/api/samples` | List downloadable sample datasets |
| `GET` | `/api/datasets/{id}/sample` | Stream download sample CSV |
| `POST` | `/api/datasets/load-sample/{id}` | Instant one-click sample dataset import |
| `POST` | `/api/schema/analyze` | AI & deterministic schema matching analysis |
| `POST` | `/api/schema/map` | Preview join between two datasets |
| `POST` | `/api/ai/plan` | Generate structured pipeline from natural language |
| `POST` | `/api/transform/preview` | Preview transformation pipeline result |
| `POST` | `/api/transform/execute` | Execute pipeline, store record, output file |
| `GET` | `/api/integrations` | List integration history jobs |
| `GET` | `/api/integrations/{id}` | Get integration details, steps, and output preview |
| `GET` | `/api/integrations/{id}/export` | Export result as `csv`, `xlsx`, or `json` |
| `GET` | `/api/quality/{dataset_id}` | Detailed multi-dimensional data quality report |

---

## 9. Verification & Test Suite

The platform includes automated verification test suites:

### 1. 20-Test Backend Integration Suite
Tests end-to-end integration across Uvicorn, HTTPX, SQLite, Pandas, and file streaming:
```bash
cd backend
python test_integration.py
```
**Results:** `Total: 20 | Passed: 20 | Failed: 0 (100% Pass Rate)`

### 2. AI & Deterministic Fallback Unit Suite
Tests similarity scoring, synonym graphs, fallback plan generation, and Gemini response parsing:
```bash
cd backend
python test_ai_integration.py
```
**Results:** `All similarity, mapping, fallback status, and plan tests passed.`

### 3. Comprehensive End-to-End Application Suite
Tests multi-format ingestion (CSV, XLSX, JSON), all 8 transformation operations, join variations (INNER, LEFT, RIGHT, OUTER), export parsing, and SQLite persistence across server restarts:
```bash
cd backend
python final_e2e_verification.py
```
**Results:** `All end-to-end multi-format and persistence tests passed.`

### 4. Production Frontend Bundle Check
```bash
cd frontend
npm run build
```
**Results:** `Built in ~2.7s with 0 errors.`

---

## 10. End-to-End Interview Demonstration Sequence

Follow this 5-minute demonstration script during technical interviews:

1. **Dashboard Walkthrough (Overview Tab):**
   - Show live aggregate metrics: Total Datasets, Integrations, Records Processed, Duplicates Detected, Quality Score.
   - Highlight the real-time activity chart and quality distribution pie chart.
2. **Instant Ingestion (Data Sources Tab):**
   - Click **"Load"** next to `employees.csv` (11 rows, contains 1 duplicate) and `payroll.csv` (10 rows, contains missing salaries).
   - Show automatic profiling: duplicate detection in `employees.csv` and missing cell detection in `payroll.csv`.
   - Expand the preview accordion to inspect the first 10 rows and column data types.
3. **AI Schema Mapping (Schema Mapping Tab):**
   - Select Dataset A (`employees.csv`) and Dataset B (`payroll.csv`).
   - Click **"Analyze Schema with AI"**.
   - Show auto-discovered mappings: `employee_id ↔ staff_code` (85%+ confidence) and `department ↔ department_name` (95%+ confidence).
   - Point out the confidence meter and plain-English semantic reason.
   - Configure an **INNER JOIN** and click **"Preview Merged Dataset"** to display combined records.
4. **Natural Language Pipeline (Transformation Studio Tab):**
   - Switch to the **AI-Assisted Planning** tab.
   - Enter: *"Combine employee and payroll datasets using employee ID, remove duplicates, and fill missing salary values."*
   - Click **"Generate Transformation Plan"**.
   - Review the generated 4-step pipeline: Join → Deduplicate → Fill Missing → Standardize.
   - Click **"Preview"** to see before (11 rows) vs after (8 rows) record counts.
   - Enter Job Name: *"Q4 Enterprise Payroll Consolidation"* and click **"Execute Integration"**.
5. **Quality Verification (Data Quality Tab):**
   - Select `payroll.csv` to highlight detected issues (missing salaries, casing inconsistencies).
   - Show how the cleaned output achieves a higher quality score.
6. **Audit & Multi-Format Export (Integration History Tab):**
   - Expand the newly completed job to inspect the full step log and output preview.
   - Click **.XLSX**, **.CSV**, or **.JSON** to download the clean, integrated dataset.
7. **Platform Reliability (Settings Tab):**
   - Click **"Test AI Connection"** to demonstrate transparent status reporting (Gemini AI active vs Deterministic Fallback active).

---

## 11. Limitations & Future Enhancements

- **Current Limitations:**
  - Ingestion currently operates on uploaded flat files (CSV, XLSX, JSON); direct database connection drivers are not yet built.
  - Large file processing (>500 MB) is constrained by available RAM due to in-memory Pandas dataframes.
  - Database backend uses SQLite for portable, zero-configuration local execution.
- **Planned Enhancements:**
  - PostgreSQL / Snowflake / BigQuery native connectors with connection pooling.
  - Distributed chunked processing via Polars or Apache Arrow.
  - Role-Based Access Control (RBAC) and OAuth2/SAML enterprise authentication.
  - Cron-based scheduled background integration jobs with email alerts.
