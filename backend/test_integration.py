import os
import sys
import time
import json
import io
import threading
import httpx
import uvicorn
import pandas as pd
from main import app, _create_sample_data

PORT = 8008
BASE_URL = f"http://127.0.0.1:{PORT}"

passed_count = 0
failed_count = 0
test_results = []

def record_test(name: str, passed: bool, duration_ms: float, details: str = ""):
    global passed_count, failed_count
    if passed:
        passed_count += 1
        print(f"  [PASS] {name} ({duration_ms:.1f}ms) {details}")
    else:
        failed_count += 1
        print(f"  [FAIL] {name} ({duration_ms:.1f}ms) {details}")
    test_results.append({
        "name": name,
        "passed": passed,
        "duration_ms": duration_ms,
        "details": details
    })

def run_all_tests():
    global passed_count, failed_count
    print("=" * 70)
    print("DATABRIDGE AI - END-TO-END INTEGRATION TEST SUITE")
    print(f"Target: Real Uvicorn server on {BASE_URL}")
    print("=" * 70)

    # Start Real Uvicorn Server in a Daemon Thread
    config = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="error")
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    # Wait for server to become healthy
    ready = False
    for _ in range(60):
        try:
            r = httpx.get(f"{BASE_URL}/api/health", timeout=1.0)
            if r.status_code == 200:
                ready = True
                break
        except Exception:
            time.sleep(0.2)

    if not ready:
        print("ERROR: Uvicorn server failed to start within timeout.")
        sys.exit(1)

    print("\n✓ Uvicorn server is live and accepting requests.\n")

    client = httpx.Client(base_url=BASE_URL, timeout=60.0)

    emp_id = None
    pay_id = None
    job_id = None

    try:
        # ---------------------------------------------------------
        # TEST 1: Sample Data Verification
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            _create_sample_data()
            samples_dir = os.path.join(".", "uploads", "samples")
            emp_sample = os.path.join(samples_dir, "employees.csv")
            pay_sample = os.path.join(samples_dir, "payroll.json")
            dept_sample = os.path.join(samples_dir, "departments.csv")
            assert os.path.exists(emp_sample), "employees.csv missing"
            assert os.path.exists(pay_sample), "payroll.json missing"
            assert os.path.exists(dept_sample), "departments.csv missing"
            df_emp = pd.read_csv(emp_sample)
            assert len(df_emp) > 0
            record_test("1. Sample Datasets Generation", True, (time.time() - t0) * 1000, f"Found {len(df_emp)} sample employee records")
        except Exception as e:
            record_test("1. Sample Datasets Generation", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 2: Health Check API
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get("/api/health")
            assert res.status_code == 200
            data = res.json()
            assert data.get("status") == "ok"
            record_test("2. Health Check API", True, (time.time() - t0) * 1000, f"provider={data.get('ai_provider')}")
        except Exception as e:
            record_test("2. Health Check API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 3: Upload Employees CSV Dataset
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            samples_dir = os.path.join(".", "uploads", "samples")
            with open(os.path.join(samples_dir, "employees.csv"), "rb") as f:
                res = client.post("/api/datasets/upload", files={"file": ("employees.csv", f, "text/csv")})
            assert res.status_code == 200, res.text
            emp_ds = res.json()
            emp_id = emp_ds["id"]
            assert emp_ds["rows"] == 13, f"Expected 13 rows, got {emp_ds['rows']}"
            assert emp_ds["columns"] == 7, f"Expected 7 columns, got {emp_ds['columns']}"
            assert emp_ds["duplicate_rows"] == 1, f"Expected 1 duplicate, got {emp_ds['duplicate_rows']}"
            record_test("3. Upload Employees Dataset", True, (time.time() - t0) * 1000, f"rows={emp_ds['rows']}, cols={emp_ds['columns']}, dupes={emp_ds['duplicate_rows']}")
        except Exception as e:
            record_test("3. Upload Employees Dataset", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 4: Upload Payroll JSON Dataset
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            samples_dir = os.path.join(".", "uploads", "samples")
            with open(os.path.join(samples_dir, "payroll.json"), "rb") as f:
                res = client.post("/api/datasets/upload", files={"file": ("payroll.json", f, "application/json")})
            assert res.status_code == 200, res.text
            pay_ds = res.json()
            pay_id = pay_ds["id"]
            assert pay_ds["rows"] == 11, f"Expected 11 rows, got {pay_ds['rows']}"
            assert pay_ds["columns"] == 6, f"Expected 6 columns, got {pay_ds['columns']}"
            assert pay_ds["missing_values"] >= 1, f"Expected missing values in payroll, got {pay_ds['missing_values']}"
            record_test("4. Upload Payroll Dataset", True, (time.time() - t0) * 1000, f"rows={pay_ds['rows']}, missing={pay_ds['missing_values']}")
        except Exception as e:
            record_test("4. Upload Payroll Dataset", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 5: List Datasets
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get("/api/datasets")
            assert res.status_code == 200
            datasets = res.json()
            assert len(datasets) >= 2
            ids = [d["id"] for d in datasets]
            assert emp_id in ids and pay_id in ids
            record_test("5. List Datasets API", True, (time.time() - t0) * 1000, f"total={len(datasets)} datasets")
        except Exception as e:
            record_test("5. List Datasets API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 6: Preview Dataset First 5 Rows
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get(f"/api/datasets/{emp_id}/preview?rows=5")
            assert res.status_code == 200
            p = res.json()
            assert len(p["preview"]) <= 5
            assert "employee_id" in p["columns"]
            assert "employee_name" in p["columns"]
            record_test("6. Dataset Preview API", True, (time.time() - t0) * 1000, f"preview_rows={len(p['preview'])}, cols={len(p['columns'])}")
        except Exception as e:
            record_test("6. Dataset Preview API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 7: Data Quality Analysis Engine
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get(f"/api/quality/{emp_id}")
            assert res.status_code == 200
            q = res.json()
            assert 0 <= q["quality_score"] <= 100
            assert q["total_records"] == 13, f"Expected 13 records in employees.csv, got {q['total_records']}"
            assert q["duplicate_count"] == 1, f"Expected 1 duplicate record, got {q['duplicate_count']}"
            assert "column_quality" in q
            assert len(q["column_quality"]) == 7, f"Expected 7 columns in employees.csv, got {len(q['column_quality'])}"
            email_col = next((c for c in q["column_quality"] if c["column"] == "email"), None)
            assert email_col is not None
            assert email_col["missing"] == 1, f"Expected 1 missing email, got {email_col['missing']}"
            record_test("7. Data Quality Engine", True, (time.time() - t0) * 1000, f"score={q['quality_score']}%, completeness={q['summary']['completeness']}%")
        except Exception as e:
            record_test("7. Data Quality Engine", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 8: AI / Deterministic Schema Mapping Analysis
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.post("/api/schema/analyze", json={"dataset_a_id": emp_id, "dataset_b_id": pay_id})
            assert res.status_code == 200, res.text
            mapping_data = res.json()
            mappings = mapping_data["mappings"]
            assert len(mappings) > 0, "No column mappings suggested"
            # Verify employee_id <-> employee_code identifier match
            matched = any(
                (m["source_column"] == "employee_id" and m["target_column"] == "employee_code") or
                (m["source_column"] == "salary" and m["target_column"] == "basic_salary")
                for m in mappings
            )
            assert matched, f"Expected semantic matches between employees and payroll, got: {mappings}"
            record_test("8. Schema Mapping Analysis", True, (time.time() - t0) * 1000, f"mappings_found={len(mappings)}, ai_generated={mapping_data.get('ai_generated')}")
        except Exception as e:
            record_test("8. Schema Mapping Analysis", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 9: Schema Mapping Apply / Live Join Preview
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.post("/api/schema/map", json={
                "dataset_a_id": emp_id,
                "dataset_b_id": pay_id,
                "mappings": [
                    {"source_column": "employee_id", "target_column": "employee_code"}
                ],
                "join_key_a": "employee_id",
                "join_key_b": "employee_code",
                "join_type": "inner"
            })
            assert res.status_code == 200, res.text
            mapped_prev = res.json()
            assert mapped_prev["total_rows"] > 0
            assert "basic_salary" in mapped_prev["columns"]
            record_test("9. Schema Mapping Join Preview", True, (time.time() - t0) * 1000, f"merged_rows={mapped_prev['total_rows']}, cols={len(mapped_prev['columns'])}")
        except Exception as e:
            record_test("9. Schema Mapping Join Preview", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 10: Natural Language AI Plan Generation
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.post("/api/ai/plan", json={
                "instruction": "Combine employee and payroll datasets using employee ID. Remove duplicate employees and fill missing salary values.",
                "dataset_ids": [emp_id, pay_id]
            })
            assert res.status_code == 200, res.text
            plan_data = res.json()["plan"]
            assert "steps" in plan_data
            assert len(plan_data["steps"]) >= 2
            record_test("10. Natural Language AI Planning", True, (time.time() - t0) * 1000, f"steps={len(plan_data['steps'])}, ai_generated={plan_data.get('ai_generated')}")
        except Exception as e:
            record_test("10. Natural Language AI Planning", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 11: Transformation Studio Preview
        # ---------------------------------------------------------
        operations = [
            {
                "step": 1,
                "operation": "join",
                "params": {"join_type": "inner", "left_key": "employee_id", "right_key": "employee_code"}
            },
            {
                "step": 2,
                "operation": "deduplicate",
                "params": {}
            },
            {
                "step": 3,
                "operation": "fill_missing",
                "params": {"strategy": "mean_or_unknown"}
            },
            {
                "step": 4,
                "operation": "standardize",
                "params": {"column": "employee_name", "mode": "title"}
            }
        ]

        t0 = time.time()
        try:
            res = client.post("/api/transform/preview", json={
                "dataset_a_id": emp_id,
                "dataset_b_id": pay_id,
                "operations": operations,
                "join_key_a": "employee_id",
                "join_key_b": "employee_code",
                "join_type": "inner"
            })
            assert res.status_code == 200, res.text
            tp = res.json()
            assert tp["before_rows"] > 0
            assert tp["after_rows"] > 0
            assert tp["rows_removed"] >= 0
            record_test("11. Transformation Studio Preview", True, (time.time() - t0) * 1000, f"before={tp['before_rows']}, after={tp['after_rows']}")
        except Exception as e:
            record_test("11. Transformation Studio Preview", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 12: Transformation Execution (Full Pipeline)
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.post("/api/transform/execute", json={
                "name": "Employee & Payroll Master Integration",
                "dataset_a_id": emp_id,
                "dataset_b_id": pay_id,
                "operations": operations,
                "join_key_a": "employee_id",
                "join_key_b": "employee_code",
                "join_type": "inner"
            })
            assert res.status_code == 200, res.text
            exec_out = res.json()
            job_id = exec_out["id"]
            assert exec_out["status"] == "completed"
            assert exec_out["records_output"] > 0
            assert exec_out["duplicates_removed"] >= 1
            assert exec_out["quality_score"] > 80
            record_test("12. Transformation Execution", True, (time.time() - t0) * 1000, f"job_id={job_id[:8]}..., output_rows={exec_out['records_output']}, quality={exec_out['quality_score']}%")
        except Exception as e:
            record_test("12. Transformation Execution", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 13: Integration History List
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get("/api/integrations")
            assert res.status_code == 200
            jobs = res.json()
            assert len(jobs) >= 1
            found = any(j["id"] == job_id for j in jobs)
            assert found, "Created job not found in history"
            record_test("13. Integration History List", True, (time.time() - t0) * 1000, f"found {len(jobs)} jobs")
        except Exception as e:
            record_test("13. Integration History List", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 14: Integration Job Details
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get(f"/api/integrations/{job_id}")
            assert res.status_code == 200
            job_detail = res.json()
            assert job_detail["name"] == "Employee & Payroll Master Integration"
            assert len(job_detail["transformation_plan"]) == 4
            record_test("14. Integration Details API", True, (time.time() - t0) * 1000, f"duration={job_detail['processing_time_ms']}ms, steps={len(job_detail['transformation_plan'])}")
        except Exception as e:
            record_test("14. Integration Details API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 15: Export Output as CSV
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get(f"/api/integrations/{job_id}/export?fmt=csv")
            assert res.status_code == 200
            assert "text/csv" in res.headers.get("content-type", "")
            lines = res.text.strip().split("\n")
            assert len(lines) > 1
            record_test("15. Export CSV API", True, (time.time() - t0) * 1000, f"exported {len(lines)} CSV rows")
        except Exception as e:
            record_test("15. Export CSV API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 16: Export Output as JSON
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get(f"/api/integrations/{job_id}/export?fmt=json")
            assert res.status_code == 200
            assert "application/json" in res.headers.get("content-type", "")
            exported_json = res.json()
            assert isinstance(exported_json, list)
            assert len(exported_json) > 0
            record_test("16. Export JSON API", True, (time.time() - t0) * 1000, f"exported {len(exported_json)} JSON records")
        except Exception as e:
            record_test("16. Export JSON API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 17: Export Output as Excel (XLSX)
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get(f"/api/integrations/{job_id}/export?fmt=xlsx")
            assert res.status_code == 200
            assert len(res.content) > 100
            df_check = pd.read_excel(io.BytesIO(res.content))
            assert len(df_check) > 0
            record_test("17. Export Excel (XLSX) API", True, (time.time() - t0) * 1000, f"read back {len(df_check)} rows from Excel")
        except Exception as e:
            record_test("17. Export Excel (XLSX) API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 18: Download Sample Dataset API
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get("/api/samples")
            assert res.status_code == 200
            samples_list = res.json()
            assert len(samples_list) >= 15
            sample_res = client.get("/api/datasets/sample-employees/sample")
            assert sample_res.status_code == 200
            assert len(sample_res.text) > 0
            record_test("18. Sample Downloads API", True, (time.time() - t0) * 1000, f"found {len(samples_list)} samples, downloaded employees")
        except Exception as e:
            record_test("18. Sample Downloads API", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 19: Overview Dashboard Real Stats API
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            res = client.get("/api/overview/stats")
            assert res.status_code == 200
            stats = res.json()
            assert stats["total_datasets"] >= 2
            assert stats["successful_integrations"] >= 1
            assert stats["total_records_processed"] >= 1
            assert stats["total_duplicates_detected"] >= 1
            assert stats["average_quality_score"] > 0
            assert len(stats["recent_jobs"]) >= 1
            record_test("19. Overview Dashboard Stats", True, (time.time() - t0) * 1000, f"datasets={stats['total_datasets']}, integrations={stats['successful_integrations']}, avg_quality={stats['average_quality_score']}%")
        except Exception as e:
            record_test("19. Overview Dashboard Stats", False, (time.time() - t0) * 1000, str(e))

        # ---------------------------------------------------------
        # TEST 20: Dataset Deletion API
        # ---------------------------------------------------------
        t0 = time.time()
        try:
            # Upload a temporary dataset to delete
            samples_dir = os.path.join(".", "uploads", "samples")
            with open(os.path.join(samples_dir, "departments.csv"), "rb") as f:
                res = client.post("/api/datasets/upload", files={"file": ("departments.csv", f, "text/csv")})
            temp_id = res.json()["id"]
            # Delete it
            del_res = client.delete(f"/api/datasets/{temp_id}")
            assert del_res.status_code == 200
            # Verify it's gone
            get_res = client.get(f"/api/datasets/{temp_id}/preview")
            assert get_res.status_code == 404
            record_test("20. Dataset Deletion API", True, (time.time() - t0) * 1000, f"deleted temp dataset {temp_id[:8]}...")
        except Exception as e:
            record_test("20. Dataset Deletion API", False, (time.time() - t0) * 1000, str(e))

    finally:
        # Stop Uvicorn cleanly
        client.close()
        server.should_exit = True
        server_thread.join(timeout=3)
        print("\n✓ Uvicorn server stopped cleanly.")

    # ---------------------------------------------------------
    # FINAL SUMMARY REPORT
    # ---------------------------------------------------------
    print("\n" + "=" * 70)
    print("FINAL INTEGRATION TEST REPORT")
    print("=" * 70)
    print(f"Total Tests Run: {passed_count + failed_count}")
    print(f"PASSED:          {passed_count}")
    print(f"FAILED:          {failed_count}")
    print("=" * 70)

    # Find longest test
    longest = max(test_results, key=lambda x: x["duration_ms"])
    print(f"Longest running test: '{longest['name']}' ({longest['duration_ms']:.1f}ms)")
    print("=" * 70)

    if failed_count > 0:
        print("\nFailed Tests Details:")
        for t in test_results:
            if not t["passed"]:
                print(f"  - {t['name']}: {t['details']}")
        sys.exit(1)
    else:
        print("\n🎉 ALL 20 INTEGRATION TESTS PASSED WITH 100% SUCCESS RATE!\n")
        sys.exit(0)

if __name__ == "__main__":
    run_all_tests()
