# DataBridge AI – Intelligent Enterprise Data Integration Platform

> A production-ready, AI-powered enterprise data integration and ETL platform built with React, FastAPI, Pandas, and Google Gemini API (with deterministic fallback).

---

## 1. Executive Summary & Problem Statement

Large enterprises struggle with data silos across legacy databases, ERP systems (SAP, Oracle), CRM instances (Salesforce), HR systems (Workday), and operational flat files. Every department maintains its own naming conventions (`employee_id` vs `staff_code`), data quality issues (duplicates, missing values, inconsistent casing), and schemas.

**DataBridge AI** delivers a unified, intelligent integration workflow:
1. **AI-Powered Schema Mapping:** Semantic similarity analysis using Google Gemini or deterministic pattern matching to auto-align columns with confidence ratings and reasoning.
2. **Natural Language Pipeline Generation:** Users express ETL requirements in conversational English; the AI generates a structured, safe, multi-step transformation plan.
3. **Data Quality Engine:** Automated multi-dimensional data profiling (completeness, uniqueness, validity, email format verification, anomaly detection).
4. **Visual Transformation Studio:** Live preview and execution of 8 core enterprise transformations using Pandas.
5. **Auditing & Enterprise Lineage:** Complete historical log of execution time, records in/out, duplicates removed, and multi-format exports (CSV, Excel XLSX, JSON).

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React 18 Frontend (Vite + Tailwind)                  │
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

| Layer | Technology | Role |
|---|---|---|
| **Frontend Framework** | React 18, Vite 6 | Fast single-page enterprise web application |
| **Styling & Theme** | Tailwind CSS v4, IBM Plex Sans | Carbon/IBM-inspired enterprise SaaS aesthetic |
| **Data Visualization** | Recharts | Integration activity charts, quality distribution rings |
| **Iconography** | Lucide React | Consistent enterprise icons |
| **Backend Framework** | FastAPI (Python 3.10+) | High-performance asynchronous REST API |
| **Data Engine** | Pandas 2.x/3.x, NumPy | Vectorized ETL, in-memory merges, imputations |
| **Database** | SQLite via SQLAlchemy 2.0 | Persistent dataset metadata and integration jobs |
| **AI Integration** | Google Gemini API (gemini-1.5-flash) | Schema semantic matching & natural language planning |
| **Fallback Engine** | Regex & domain synonym graphs | Guarantees 100% platform availability offline |
| **Excel Export** | XlsxWriter, OpenPyXL | Binary spreadsheet generation |

---

## 4. Key Features

### 4.1. Enterprise Dashboard
- Real-time aggregate KPIs derived directly from SQLite: total datasets, successful integrations, processed records, duplicates purged, average quality score.
- Integration activity trend chart and quality distribution breakdown.
- Recent integration jobs table with live status badges and direct navigation.

### 4.2. Data Source Management & Ingestion
- Ingestion of CSV, Excel (.xlsx), and JSON files up to 50 MB.
- Instant profiling upon upload: row/col count, column dtypes, missing cell counts, duplicate row counts.
- Interactive 10-row dataset preview table with column metadata chips.
- One-click sample dataset import (`employees.csv`, `payroll.csv`, `departments.csv`) with realistic enterprise flaws.

### 4.3. AI-Powered Schema Mapping
- Compares schema between any two datasets.
- Suggests column pairs with confidence scores (0–100%) and plain-English semantic explanations.
- Editable mapping table: accept, reject, or override any suggested target column.
- Configurable join keys and join types (INNER, LEFT, RIGHT, OUTER) with real-time merged preview.
- Clear visual indicator distinguishing **Live Gemini AI** suggestions from **Deterministic Fallback Engine** results.

### 4.4. Natural Language Data Integration
- Conversational prompt interface: *"Combine employee and payroll datasets using employee ID, remove duplicates, and fill missing salaries."*
- Generates a structured transformation plan with approved steps before execution.
- Safe predefined execution primitives — strictly prevents arbitrary code execution or SQL injection.

### 4.5. Transformation Studio
- 8 production-ready transformation operations:
  - `join`: INNER, LEFT, RIGHT, OUTER joins on specified keys
  - `deduplicate`: Exact or subset-based duplicate row removal
  - `fill_missing`: Imputation strategies (numeric mean/median, text replacement, drop)
  - `rename`: Column renaming dictionary mapping
  - `filter`: Relational comparisons (`==`, `!=`, `>`, `<`, `contains`)
  - `sort`: Ascending or descending multi-column sort
  - `standardize`: Text casing normalization (`lower`, `upper`, `title`)
  - `type_convert`: Safe cast to integer, float, string, datetime
- Live preview showing before/after record counts and rows removed.
- Full execution with execution duration timing in milliseconds.

### 4.6. Data Quality Engine
- Multi-dimensional data health assessment:
  - **Completeness:** Cell population percentage
  - **Uniqueness:** Duplication ratio
  - **Validity:** Composite 0–100 quality score
- Column-level inspection: missing counts, unique values, regex-based invalid email detection, format inconsistency detection.

### 4.7. Integration History & Export
- Persistent audit trail for every executed integration job.
- Expandable job details: input/output counts, duplicates removed, processing duration, transformation steps.
- Embedded output preview table showing first 10 rows of final integrated data.
- One-click export to **CSV**, **Excel (.xlsx)**, or **JSON**.

---

## 5. Security & Reliability

1. **Path Traversal Prevention:** Uploaded files are renamed using secure random UUIDs (`{uuid}.{ext}`). User-supplied filenames are never used as filesystem paths.
2. **Strict MIME & Extension Whitelist:** Only `.csv`, `.xlsx`, and `.json` extensions are accepted.
3. **Payload Size Guard:** Configurable upload ceiling (default 50 MB) checked before reading into memory.
4. **No Arbitrary Code Execution:** AI returns structured JSON parameters mapped to safe, vetted Pandas methods. No `eval()`, `exec()`, or raw SQL is executed.
5. **Environment Variable Protection:** API keys reside exclusively in backend environment configurations (`backend/.env`) and are never leaked to frontend code or client network payloads.
6. **Graceful Fallback:** The platform remains 100% functional without an AI API key.

---

## 6. Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or pnpm

### 1. Clone & Navigate
```powershell
cd c:\Users\MEGHA\databridge-ai
```

### 2. Backend Setup
```powershell
cd backend
pip install -r requirements.txt
copy .env.example .env
```

*(Optional)* Open `backend/.env` to configure your Google Gemini API key:
```ini
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
```
> **Note:** If left empty, the application runs automatically in Deterministic Fallback Mode with 100% functionality.

### 3. Frontend Setup
```powershell
cd ..\frontend
npm install
```

---

## 7. Running the Application

### Option A: Using Startup Scripts
- **Start Backend:** Run `start-backend.bat` (runs on `http://localhost:8000`)
- **Start Frontend:** Run `start-frontend.bat` (runs on `http://localhost:5173`)

### Option B: Manual Terminal Execution
**Terminal 1 (Backend):**
```powershell
cd c:\Users\MEGHA\databridge-ai\backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 (Frontend):**
```powershell
cd c:\Users\MEGHA\databridge-ai\frontend
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

The platform includes two automated test suites:

### 1. Full 20-Test Backend Integration Suite
Tests the complete end-to-end integration across a live Uvicorn server, HTTPX, SQLite, Pandas, and file streaming:
```powershell
cd c:\Users\MEGHA\databridge-ai\backend
python test_integration.py
```
**Results:** `Total: 20 | Passed: 20 | Failed: 0 (100% Pass Rate)`

### 2. AI & Deterministic Fallback Unit Suite
Tests similarity scoring, synonym graphs, fallback plan generation, and Gemini response parsing:
```powershell
cd c:\Users\MEGHA\databridge-ai\backend
python test_ai_integration.py
```
**Results:** `All AI & Fallback tests passed.`

### 3. Production Frontend Bundle Check
```powershell
cd c:\Users\MEGHA\databridge-ai\frontend
npm run build
```
**Results:** `Built in ~3s with 0 errors.`

---

## 10. End-to-End Interview Demonstration Sequence

Follow this 5-minute demonstration script during technical interviews:

1. **Dashboard Walkthrough (Overview Tab):**
   - Show live metrics: Total Datasets, Integrations, Records Processed, Duplicates Detected, Quality Score.
   - Point out the real-time activity chart and quality distribution pie chart.
2. **Instant Ingestion (Data Sources Tab):**
   - Click **"Load"** next to `employees.csv` and `payroll.csv` in the Sample Datasets card.
   - Show automatic profiling: 1 duplicate detected in `employees.csv`, missing values in `payroll.csv`.
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
   - Click **"Preview"** to see before (11 rows) vs after (8 rows) counts.
   - Enter Job Name: *"Q4 Enterprise Payroll Consolidation"* and click **"Execute Integration"**.
5. **Quality Verification (Data Quality Tab):**
   - Select `payroll.csv` to highlight detected issues (missing salaries, casing inconsistencies).
   - Show how the cleaned output achieves a higher quality score.
6. **Audit & Multi-Format Export (Integration History Tab):**
   - Expand the newly completed job to inspect the full step log and output preview.
   - Click **.XLSX**, **.CSV**, or **.JSON** to download the clean, integrated dataset.
7. **Platform Reliability (Settings Tab):**
   - Click **"Test AI Connection"** to demonstrate transparent live status reporting (Gemini AI active vs Deterministic Fallback active).

---

## 11. Limitations & Future Enhancements

- **Current Limitations:**
  - Database backend defaults to SQLite for portable, zero-configuration local execution.
  - Large file processing (>500 MB) is constrained by server RAM due to in-memory Pandas dataframes.
- **Planned Enhancements:**
  - PostgreSQL / Snowflake / BigQuery native connector support with connection pooling.
  - Distributed chunked processing via Polars or Apache Arrow.
  - Role-Based Access Control (RBAC) and OAuth2/SAML authentication.
  - Cron-based scheduled background integration jobs with email alerts.
