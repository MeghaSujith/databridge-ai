import os
import sys
import time
import json
import io
import threading
from pathlib import Path
import httpx
import uvicorn
import pandas as pd
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
from main import app, SessionLocal, DatasetModel, IntegrationModel, _create_sample_data

PORT = 8010
BASE_URL = f"http://127.0.0.1:{PORT}"

def run_tests():
    print("=" * 80)
    print("DATABRIDGE AI - COMPREHENSIVE END-TO-END APPLICATION TESTING")
    print(f"Server Target: {BASE_URL}")
    print("=" * 80)

    # 1. Start Server Instance 1
    config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="error")
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    ready = False
    for _ in range(30):
        try:
            r = httpx.get(f"{BASE_URL}/api/health", timeout=1.0)
            if r.status_code == 200:
                ready = True
                break
        except Exception:
            time.sleep(0.2)
    assert ready, "Failed to start server"
    print("✓ Backend Server Instance 1 started.")

    client = httpx.Client(base_url=BASE_URL, timeout=40.0)

    try:
        # ---------------------------------------------------------------------
        # TEST A: UPLOADS - CSV, XLSX, AND JSON
        # ---------------------------------------------------------------------
        print("\n[TEST A] Multi-Format Ingestion: CSV, XLSX, and JSON")
        
        # 1. CSV Upload
        _create_sample_data()
        csv_path = Path(__file__).parent / "uploads" / "samples" / "employees.csv"
        with open(csv_path, "rb") as f:
            res_csv = client.post("/api/datasets/upload", files={"file": ("employees.csv", f, "text/csv")})
        assert res_csv.status_code == 200
        emp_id = res_csv.json()["id"]
        print(f"  ✓ CSV Ingestion: ID={emp_id[:8]}..., rows={res_csv.json()['rows']}, cols={res_csv.json()['columns']}")

        # 2. XLSX Upload
        xlsx_buf = io.BytesIO()
        df_payroll = pd.read_csv(Path(__file__).parent / "uploads" / "samples" / "payroll.csv")
        with pd.ExcelWriter(xlsx_buf, engine="xlsxwriter") as writer:
            df_payroll.to_excel(writer, index=False)
        xlsx_buf.seek(0)
        res_xlsx = client.post("/api/datasets/upload", files={"file": ("payroll.xlsx", xlsx_buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        assert res_xlsx.status_code == 200
        pay_id = res_xlsx.json()["id"]
        print(f"  ✓ XLSX Ingestion: ID={pay_id[:8]}..., rows={res_xlsx.json()['rows']}, cols={res_xlsx.json()['columns']}")

        # 3. JSON Upload
        dept_data = [
            {"dept_code": "D001", "dept_name": "Engineering", "budget": 500000},
            {"dept_code": "D002", "dept_name": "Marketing", "budget": 250000},
            {"dept_code": "D003", "dept_name": "HR", "budget": 150000},
            {"dept_code": "D004", "dept_name": "Finance", "budget": 350000}
        ]
        json_bytes = json.dumps(dept_data).encode("utf-8")
        res_json = client.post("/api/datasets/upload", files={"file": ("departments.json", json_bytes, "application/json")})
        assert res_json.status_code == 200
        dept_id = res_json.json()["id"]
        print(f"  ✓ JSON Ingestion: ID={dept_id[:8]}..., rows={res_json.json()['rows']}, cols={res_json.json()['columns']}")

        # ---------------------------------------------------------------------
        # TEST B: SCHEMA MAPPING & JOIN-KEY SELECTION
        # ---------------------------------------------------------------------
        print("\n[TEST B] Schema Mapping & Join-Key Verification")
        res_map = client.post("/api/schema/analyze", json={"dataset_a_id": emp_id, "dataset_b_id": pay_id})
        assert res_map.status_code == 200
        m_data = res_map.json()
        print(f"  ✓ Schema mapping returned {len(m_data['mappings'])} mappings (ai_generated={m_data['ai_generated']})")
        for m in m_data["mappings"]:
            print(f"    • {m['source_column']} <-> {m['target_column']} (Confidence: {m['confidence']})")

        # ---------------------------------------------------------------------
        # TEST C: JOIN VARIATIONS - INNER, LEFT, RIGHT, OUTER
        # ---------------------------------------------------------------------
        print("\n[TEST C] Join Variations: INNER, LEFT, RIGHT, OUTER")
        for jt in ["inner", "left", "right", "outer"]:
            res_jt = client.post("/api/schema/map", json={
                "dataset_a_id": emp_id,
                "dataset_b_id": pay_id,
                "mappings": [
                    {"source_column": "employee_id", "target_column": "staff_code"},
                    {"source_column": "department", "target_column": "department_name"}
                ],
                "join_key_a": "employee_id",
                "join_key_b": "staff_code",
                "join_type": jt
            })
            assert res_jt.status_code == 200, f"Join {jt} failed"
            jt_res = res_jt.json()
            print(f"  ✓ {jt.upper()} JOIN: output={jt_res['total_rows']} rows, cols={len(jt_res['columns'])}")

        # ---------------------------------------------------------------------
        # TEST D: ALL 8 TRANSFORMATION OPERATIONS
        # ---------------------------------------------------------------------
        print("\n[TEST D] Testing All 8 Transformation Operations")
        all_ops = [
            {"step": 1, "operation": "join", "params": {"join_type": "left", "left_key": "employee_id", "right_key": "staff_code"}},
            {"step": 2, "operation": "deduplicate", "params": {}},
            {"step": 3, "operation": "fill_missing", "params": {"strategy": "mean_or_unknown"}},
            {"step": 4, "operation": "rename", "params": {"columns": {"employee_name": "full_name_clean"}}},
            {"step": 5, "operation": "standardize", "params": {"column": "department", "mode": "upper"}},
            {"step": 6, "operation": "sort", "params": {"column": "employee_id", "ascending": False}},
            {"step": 7, "operation": "filter", "params": {"column": "department", "operator": "contains", "value": "ENG"}},
            {"step": 8, "operation": "type_convert", "params": {"column": "employee_id", "to_type": "str"}}
        ]
        
        # Preview
        res_prev = client.post("/api/transform/preview", json={
            "dataset_a_id": emp_id,
            "dataset_b_id": pay_id,
            "operations": all_ops,
            "join_key_a": "employee_id",
            "join_key_b": "staff_code",
            "join_type": "left"
        })
        assert res_prev.status_code == 200, res_prev.text
        prev_data = res_prev.json()
        print(f"  ✓ 8-Step Pipeline Preview: Before={prev_data['before_rows']}, After={prev_data['after_rows']}")

        # Execution
        res_exec = client.post("/api/transform/execute", json={
            "name": "E2E 8-Step Master Pipeline Test",
            "dataset_a_id": emp_id,
            "dataset_b_id": pay_id,
            "operations": all_ops,
            "join_key_a": "employee_id",
            "join_key_b": "staff_code",
            "join_type": "left"
        })
        assert res_exec.status_code == 200, res_exec.text
        exec_data = res_exec.json()
        job_id = exec_data["id"]
        print(f"  ✓ 8-Step Pipeline Executed: Job ID={job_id[:8]}..., Quality Score={exec_data['quality_score']}%, Time={exec_data['processing_time_ms']}ms")

        # ---------------------------------------------------------------------
        # TEST E: VALIDATION OF EXPORTED FILES (CSV, XLSX, JSON)
        # ---------------------------------------------------------------------
        print("\n[TEST E] Deep Validation of Exported Files (CSV, XLSX, JSON)")
        
        # 1. Validate CSV Export
        r_csv = client.get(f"/api/integrations/{job_id}/export?fmt=csv")
        assert r_csv.status_code == 200
        df_csv = pd.read_csv(io.StringIO(r_csv.text))
        assert len(df_csv) == exec_data["records_output"]
        assert "full_name_clean" in df_csv.columns
        print(f"  ✓ CSV Export Validated: {len(df_csv)} rows, {len(df_csv.columns)} columns verified.")

        # 2. Validate JSON Export
        r_json = client.get(f"/api/integrations/{job_id}/export?fmt=json")
        assert r_json.status_code == 200
        records = json.loads(r_json.text)
        assert len(records) == exec_data["records_output"]
        assert "full_name_clean" in records[0]
        print(f"  ✓ JSON Export Validated: {len(records)} JSON records parsed and verified.")

        # 3. Validate XLSX Export
        r_xlsx = client.get(f"/api/integrations/{job_id}/export?fmt=xlsx")
        assert r_xlsx.status_code == 200
        df_xlsx = pd.read_excel(io.BytesIO(r_xlsx.content))
        assert len(df_xlsx) == exec_data["records_output"]
        assert "full_name_clean" in df_xlsx.columns
        print(f"  ✓ XLSX Export Validated: Binary Excel read back successfully, {len(df_xlsx)} rows verified.")

        # ---------------------------------------------------------------------
        # TEST F: ERROR HANDLING & EDGE CASES
        # ---------------------------------------------------------------------
        print("\n[TEST F] Error Handling & Security Edge Cases")
        
        # 1. Unsupported File Extension (.txt)
        r_err1 = client.post("/api/datasets/upload", files={"file": ("notes.txt", b"Hello", "text/plain")})
        assert r_err1.status_code == 400
        print(f"  ✓ Rejected unsupported file extension (.txt): HTTP 400 - {r_err1.json()['detail']}")

        # 2. Corrupt / Empty File (0 bytes)
        r_err2 = client.post("/api/datasets/upload", files={"file": ("empty.csv", b"", "text/csv")})
        assert r_err2.status_code in (400, 422)
        print(f"  ✓ Rejected empty 0-byte file: HTTP {r_err2.status_code} - {r_err2.json()['detail']}")

        # 3. Non-existent dataset ID
        r_err3 = client.get("/api/datasets/non-existent-uuid-12345/preview")
        assert r_err3.status_code == 404
        print(f"  ✓ Non-existent dataset ID handled: HTTP 404 - {r_err3.json()['detail']}")

        # 4. Invalid join key in transformation
        r_err4 = client.post("/api/schema/map", json={
            "dataset_a_id": emp_id,
            "dataset_b_id": pay_id,
            "mappings": [],
            "join_key_a": "invalid_column_name",
            "join_key_b": "staff_code",
            "join_type": "inner"
        })
        assert r_err4.status_code == 400
        print(f"  ✓ Invalid join key rejected: HTTP 400 - {r_err4.json()['detail']}")

    finally:
        client.close()
        server.should_exit = True
        server_thread.join(timeout=3)
        print("\n✓ Backend Server Instance 1 stopped.")

    # -------------------------------------------------------------------------
    # TEST G: PERSISTENCE VERIFICATION AFTER BACKEND RESTART
    # -------------------------------------------------------------------------
    print("\n[TEST G] Persistence Verification: Restarting Backend...")
    server2 = uvicorn.Server(config)
    server_thread2 = threading.Thread(target=server2.run, daemon=True)
    server_thread2.start()

    time.sleep(1.5)
    client2 = httpx.Client(base_url=BASE_URL, timeout=20.0)

    try:
        # Check datasets persisted
        r_ds = client2.get("/api/datasets")
        assert r_ds.status_code == 200
        ds_list = r_ds.json()
        assert len(ds_list) >= 3
        print(f"  ✓ Datasets Persisted after Restart: Found {len(ds_list)} datasets in SQLite.")

        # Check integration history persisted
        r_jobs = client2.get("/api/integrations")
        assert r_jobs.status_code == 200
        jobs_list = r_jobs.json()
        assert any(j["id"] == job_id for j in jobs_list)
        print(f"  ✓ Integration History Persisted after Restart: Found Job ID {job_id[:8]}... in SQLite.")

        # Verify details and output file can still be read
        r_detail = client2.get(f"/api/integrations/{job_id}")
        assert r_detail.status_code == 200
        d = r_detail.json()
        assert d["name"] == "E2E 8-Step Master Pipeline Test"
        assert len(d["output_preview"]) > 0
        print(f"  ✓ Integration output file and preview retained after restart.")
        
    finally:
        client2.close()
        server2.should_exit = True
        server_thread2.join(timeout=3)
        print("✓ Backend Server Instance 2 stopped.")

    print("\n" + "=" * 80)
    print("🎉 ALL END-TO-END APPLICATION TESTS PASSED WITH 100% SUCCESS RATE!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()

