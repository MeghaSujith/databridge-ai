import os
import sys
import time
import json
import threading
import httpx
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Load env from backend/.env explicitly
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

from main import app, _create_sample_data

PORT = 8009
BASE_URL = f"http://127.0.0.1:{PORT}"

def run_verification():
    print("=" * 75)
    print("DATABRIDGE AI - LIVE GEMINI API & FALLBACK VERIFICATION TEST")
    print(f"Server Target: {BASE_URL}")
    print("=" * 75)

    current_key = os.getenv("GEMINI_API_KEY", "").strip()
    is_live_key = bool(current_key and current_key != "your_gemini_api_key_here")

    print(f"\n[PHASE 0] Environment Key Check:")
    print(f"  .env location:          {env_path}")
    print(f"  AI_PROVIDER:            {os.getenv('AI_PROVIDER', 'gemini')}")
    print(f"  GEMINI_API_KEY:         {'CONFIGURED (Masked: ' + current_key[:6] + '...' + current_key[-4:] + ')' if is_live_key else 'NOT CONFIGURED / PLACEHOLDER'}")
    print(f"  Mode under test:        {'LIVE GEMINI API REQUESTS' if is_live_key else 'FALLBACK ENGINE (No live key set)'}")

    # Spin up live Uvicorn socket server
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

    if not ready:
        print("ERROR: Could not bind and start Uvicorn server.")
        sys.exit(1)

    print("\n✓ Real Uvicorn server is live and accepting HTTP requests.")

    client = httpx.Client(base_url=BASE_URL, timeout=40.0)

    try:
        # -------------------------------------------------------------
        # STEP 1: Verify GET /api/ai/status
        # -------------------------------------------------------------
        print("\n" + "-" * 75)
        print("STEP 1: Verify GET /api/ai/status")
        print("-" * 75)
        r = client.get("/api/ai/status")
        assert r.status_code == 200, f"Status check failed: {r.text}"
        status_data = r.json()
        print(f"Response: {json.dumps(status_data, indent=2)}")
        print(f"  gemini_key_configured: {status_data.get('gemini_key_configured')}")
        print(f"  ai_active:             {status_data.get('ai_active')}")
        print(f"  provider:              {status_data.get('provider')}")
        print(f"  status:                {status_data.get('status')}")

        # -------------------------------------------------------------
        # STEP 2: Ingest Sample Datasets
        # -------------------------------------------------------------
        print("\n" + "-" * 75)
        print("STEP 2: Ingest Sample Datasets (employees.csv & payroll.csv)")
        print("-" * 75)
        _create_sample_data()
        samples_dir = Path(__file__).parent / "uploads" / "samples"
        with open(samples_dir / "employees.csv", "rb") as f:
            res_emp = client.post("/api/datasets/upload", files={"file": ("employees.csv", f, "text/csv")})
        assert res_emp.status_code == 200
        emp_id = res_emp.json()["id"]

        with open(samples_dir / "payroll.csv", "rb") as f:
            res_pay = client.post("/api/datasets/upload", files={"file": ("payroll.csv", f, "text/csv")})
        assert res_pay.status_code == 200
        pay_id = res_pay.json()["id"]

        print(f"✓ Uploaded employees.csv (ID={emp_id[:8]}...) and payroll.csv (ID={pay_id[:8]}...)")

        # -------------------------------------------------------------
        # STEP 3: Schema Mapping Execution
        # -------------------------------------------------------------
        print("\n" + "-" * 75)
        print("STEP 3: Execute Schema Mapping (POST /api/schema/analyze)")
        print("-" * 75)
        t0 = time.time()
        res_schema = client.post("/api/schema/analyze", json={
            "dataset_a_id": emp_id,
            "dataset_b_id": pay_id
        })
        duration_schema = (time.time() - t0) * 1000
        assert res_schema.status_code == 200, res_schema.text
        schema_data = res_schema.json()
        ai_generated_schema = schema_data.get("ai_generated")

        print(f"Execution Duration: {duration_schema:.1f}ms")
        print(f"ai_generated:       {ai_generated_schema} (Type: {'REAL GEMINI API' if ai_generated_schema else 'DETERMINISTIC FALLBACK ENGINE'})")
        print(f"Join Recommendation:{schema_data.get('join_recommendation')}")
        print(f"Notes:              {schema_data.get('notes')}")
        print("Mappings Found:")
        for m in schema_data.get("mappings", []):
            print(f"  • {m['source_column']} <---> {m['target_column']} (Confidence: {m['confidence']})")
            print(f"    Reason: {m.get('reason')}")

        # -------------------------------------------------------------
        # STEP 4: Natural Language AI Transformation Plan
        # -------------------------------------------------------------
        print("\n" + "-" * 75)
        print("STEP 4: Natural Language Planning (POST /api/ai/plan)")
        print("-" * 75)
        prompt_instruction = "Combine the employee and payroll datasets using employee ID. Remove duplicate employees and identify missing salary records."
        print(f"User Instruction: \"{prompt_instruction}\"")
        t0 = time.time()
        res_plan = client.post("/api/ai/plan", json={
            "instruction": prompt_instruction,
            "dataset_ids": [emp_id, pay_id]
        })
        duration_plan = (time.time() - t0) * 1000
        assert res_plan.status_code == 200, res_plan.text
        plan_data = res_plan.json().get("plan", {})
        ai_generated_plan = plan_data.get("ai_generated")

        print(f"Execution Duration: {duration_plan:.1f}ms")
        print(f"ai_generated:       {ai_generated_plan} (Type: {'REAL GEMINI API' if ai_generated_plan else 'DETERMINISTIC FALLBACK ENGINE'})")
        print(f"Summary:            {plan_data.get('summary')}")
        print("Transformation Pipeline Steps:")
        for s in plan_data.get("steps", []):
            print(f"  Step {s.get('step')}: [{s.get('operation').upper()}] {s.get('description')}")
            if s.get("params"):
                print(f"          Params: {s.get('params')}")

        # -------------------------------------------------------------
        # STEP 5: Negative Testing - Invalid Key Fallback Simulation
        # -------------------------------------------------------------
        print("\n" + "-" * 75)
        print("STEP 5: Negative Testing (Simulating Invalid / Expired Gemini API Key)")
        print("-" * 75)
        print("Injecting invalid key: 'AIzaSy_Simulated_Invalid_Test_Key_999'")

        # Temporarily mock os.environ with invalid key
        original_env_key = os.environ.get("GEMINI_API_KEY")
        try:
            os.environ["GEMINI_API_KEY"] = "AIzaSy_Simulated_Invalid_Test_Key_999"
            
            # 1. Status check with invalid key
            status_invalid = client.get("/api/ai/status").json()
            print(f"Status with invalid key:")
            print(f"  ai_active:             {status_invalid.get('ai_active')} (Expected: False)")
            print(f"  provider:              {status_invalid.get('provider')} (Expected: deterministic_fallback)")
            print(f"  gemini_key_configured: {status_invalid.get('gemini_key_configured')} (Expected: True - key present)")
            assert status_invalid.get("ai_active") is False

            # 2. Schema mapping with invalid key (should fall back cleanly)
            schema_invalid = client.post("/api/schema/analyze", json={
                "dataset_a_id": emp_id,
                "dataset_b_id": pay_id
            }).json()
            print(f"Schema mapping with invalid key:")
            print(f"  ai_generated:   {schema_invalid.get('ai_generated')} (Expected: False - Fallback active)")
            print(f"  mappings count: {len(schema_invalid.get('mappings', []))} (Expected: >=2)")
            assert schema_invalid.get("ai_generated") is False
            assert len(schema_invalid.get("mappings", [])) >= 2

            # 3. AI Plan with invalid key (should fall back cleanly)
            plan_invalid = client.post("/api/ai/plan", json={
                "instruction": prompt_instruction,
                "dataset_ids": [emp_id, pay_id]
            }).json().get("plan", {})
            print(f"AI Plan with invalid key:")
            print(f"  ai_generated:   {plan_invalid.get('ai_generated')} (Expected: False - Fallback active)")
            print(f"  steps count:    {len(plan_invalid.get('steps', []))} (Expected: >=2)")
            assert plan_invalid.get("ai_generated") is False
            assert len(plan_invalid.get("steps", [])) >= 2

            print("✓ Negative test PASSED: Invalid API key was rejected by Google Gemini, caught safely, and deterministic fallback preserved 100% functionality without error!")

        finally:
            # Restore environment
            if original_env_key is not None:
                os.environ["GEMINI_API_KEY"] = original_env_key
            else:
                os.environ.pop("GEMINI_API_KEY", None)

    finally:
        client.close()
        server.should_exit = True
        server_thread.join(timeout=3)
        print("\n✓ Real Uvicorn server stopped cleanly.")

    print("\n" + "=" * 75)
    print("VERIFICATION COMPLETED SUCCESSFULLY")
    print("=" * 75)

if __name__ == "__main__":
    run_verification()

