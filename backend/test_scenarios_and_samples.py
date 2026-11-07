import sys
import json
import io
from pathlib import Path
import pandas as pd
import numpy as np

# Ensure backend directory is in path
sys.path.insert(0, str(Path(__file__).parent))

from main import (
    app, SessionLocal, DatasetModel, IntegrationModel,
    list_samples, load_sample_dataset, preview_sample, list_scenarios,
    analyze_schema, SchemaAnalyzeRequest,
    apply_schema_mapping, SchemaMappingRequest,
    data_quality, _apply_operations, export_integration,
    _similarity_score, _deterministic_schema_mapping, _read_dataset
)

def run_sample_and_scenario_tests():
    print("=" * 80)
    print("DATABRIDGE AI - 15 DATASETS & 4 SCENARIOS VERIFICATION SUITE")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # 1. CATALOG VERIFICATION
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Sample Catalog Verification")
    catalog = list_samples()
    print(f"  • Total Datasets in Catalog: {len(catalog)}")
    assert len(catalog) == 15, f"Expected 15 datasets, got {len(catalog)}"

    by_format = {}
    by_category = {}
    for item in catalog:
        fmt = item["format"]
        cat = item["category"]
        by_format[fmt] = by_format.get(fmt, 0) + 1
        by_category[cat] = by_category.get(cat, 0) + 1

    print(f"  • Format Distribution: {by_format}")
    assert by_format.get("CSV") == 6, "Expected 6 CSV files"
    assert by_format.get("XLSX") == 5, "Expected 5 XLSX files"
    assert by_format.get("JSON") == 4, "Expected 4 JSON files"

    print(f"  • Category Distribution: {by_category}")
    assert by_category.get("Human Resources") == 3
    assert by_category.get("Finance") == 3
    assert by_category.get("Sales and Customers") == 3
    assert by_category.get("Healthcare") == 2
    assert by_category.get("Supply Chain and Inventory") == 4
    print("  ✓ All 15 sample datasets cataloged with dynamic stats across 5 domains.")

    # -------------------------------------------------------------------------
    # 2. PREVIEW VERIFICATION BEFORE LOADING
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Sample Preview Verification (Without Loading to DB)")
    for s in catalog:
        prev = preview_sample(s["id"], 5)
        assert prev["total_rows"] > 0
        assert len(prev["columns"]) > 0
        assert len(prev["preview"]) > 0
    print(f"  ✓ Successfully previewed all 15 sample datasets directly from disk.")

    # -------------------------------------------------------------------------
    # 3. MULTI-FORMAT LOADING VERIFICATION
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Multi-Format Loading into SQLite & Profiling")
    loaded_ids = {}
    for s in catalog:
        res = load_sample_dataset(s["id"])
        loaded_ids[s["id"]] = res["id"]
        assert res["rows"] > 0
        assert res["columns"] > 0
        assert len(res["column_info"]) > 0
    print(f"  ✓ Successfully loaded all 15 datasets (CSV, XLSX, JSON) into SQLite database.")

    # -------------------------------------------------------------------------
    # 4. SCENARIO 1: Employee and Payroll Integration
    # -------------------------------------------------------------------------
    print("\n[TEST 4] SCENARIO 1: Employee & Payroll Integration (CSV + JSON)")
    emp_id = loaded_ids["sample-employees"]
    pay_id = loaded_ids["sample-payroll"]
    
    # A. Schema Mapping
    map_res = analyze_schema(SchemaAnalyzeRequest(dataset_a_id=emp_id, dataset_b_id=pay_id))
    print(f"  • Discovered mappings: {[m['source_column'] + ' <-> ' + m['target_column'] for m in map_res['mappings']]}")
    emp_key_match = any(m["source_column"] == "employee_id" and m["target_column"] == "employee_code" for m in map_res["mappings"])
    assert emp_key_match, "Failed to match employee_id <-> employee_code"
    print("  ✓ Schema mapping identified 'employee_id' ↔ 'employee_code'.")

    # B. Left Join Preview
    join_res = apply_schema_mapping(SchemaMappingRequest(
        dataset_a_id=emp_id,
        dataset_b_id=pay_id,
        mappings=[{"source_column": "employee_id", "target_column": "employee_code"}],
        join_key_a="employee_id",
        join_key_b="employee_code",
        join_type="left"
    ))
    print(f"  • Left Join: {join_res['total_rows']} rows merged.")
    assert join_res["total_rows"] >= 13

    # C. Data Quality Check on Payroll
    dq_pay = data_quality(pay_id)
    print(f"  • Payroll Quality Score: {dq_pay['quality_score']}% (Missing values: {dq_pay['missing_value_count']})")
    assert dq_pay["missing_value_count"] > 0
    print("  ✓ Scenario 1 completed successfully.")

    # -------------------------------------------------------------------------
    # 5. SCENARIO 2: Employee and Attendance Integration
    # -------------------------------------------------------------------------
    print("\n[TEST 5] SCENARIO 2: Employee & Attendance Integration (CSV + XLSX)")
    att_id = loaded_ids["sample-employee-attendance"]

    # A. Schema Mapping
    map_res2 = analyze_schema(SchemaAnalyzeRequest(dataset_a_id=emp_id, dataset_b_id=att_id))
    print(f"  • Discovered mappings: {[m['source_column'] + ' <-> ' + m['target_column'] for m in map_res2['mappings']]}")
    att_key_match = any(m["source_column"] == "employee_id" and m["target_column"] == "staff_id" for m in map_res2["mappings"])
    assert att_key_match, "Failed to match employee_id <-> staff_id"
    print("  ✓ Schema mapping identified 'employee_id' ↔ 'staff_id'.")

    # B. Full Outer Join to find unmatched attendance
    join_res2 = apply_schema_mapping(SchemaMappingRequest(
        dataset_a_id=emp_id,
        dataset_b_id=att_id,
        mappings=[{"source_column": "employee_id", "target_column": "staff_id"}],
        join_key_a="employee_id",
        join_key_b="staff_id",
        join_type="outer"
    ))
    print(f"  • Outer Join: {join_res2['total_rows']} total rows (identified unmatched attendance records).")
    assert join_res2["total_rows"] >= 14
    print("  ✓ Scenario 2 completed successfully.")

    # -------------------------------------------------------------------------
    # 6. SCENARIO 3: Customer and Sales Integration
    # -------------------------------------------------------------------------
    print("\n[TEST 6] SCENARIO 3: Customer & Sales Integration (CSV + XLSX)")
    cust_id = loaded_ids["sample-customers"]
    sales_id = loaded_ids["sample-sales-orders"]

    # A. Schema Mapping
    map_res3 = analyze_schema(SchemaAnalyzeRequest(dataset_a_id=cust_id, dataset_b_id=sales_id))
    print(f"  • Discovered mappings: {[m['source_column'] + ' <-> ' + m['target_column'] for m in map_res3['mappings']]}")
    cust_key_match = any(m["source_column"] == "customer_id" and m["target_column"] == "client_reference" for m in map_res3["mappings"])
    assert cust_key_match, "Failed to match customer_id <-> client_reference"
    print("  ✓ Schema mapping identified 'customer_id' ↔ 'client_reference'.")

    # B. Right Join to find orders with unmatched customer records
    join_res3 = apply_schema_mapping(SchemaMappingRequest(
        dataset_a_id=cust_id,
        dataset_b_id=sales_id,
        mappings=[{"source_column": "customer_id", "target_column": "client_reference"}],
        join_key_a="customer_id",
        join_key_b="client_reference",
        join_type="right"
    ))
    print(f"  • Right Join: {join_res3['total_rows']} orders (contains C199 unmatched order ORD-7011).")
    assert join_res3["total_rows"] >= 14
    print("  ✓ Scenario 3 completed successfully.")

    # -------------------------------------------------------------------------
    # 7. SCENARIO 4: Invoice and Transaction Reconciliation
    # -------------------------------------------------------------------------
    print("\n[TEST 7] SCENARIO 4: Invoice & Transaction Reconciliation (XLSX + CSV)")
    inv_id = loaded_ids["sample-invoices"]
    txn_id = loaded_ids["sample-transactions"]

    # A. Schema Mapping
    map_res4 = analyze_schema(SchemaAnalyzeRequest(dataset_a_id=inv_id, dataset_b_id=txn_id))
    print(f"  • Discovered mappings: {[m['source_column'] + ' <-> ' + m['target_column'] for m in map_res4['mappings']]}")
    inv_key_match = any(m["source_column"] == "client_id" and m["target_column"] == "customer_id" for m in map_res4["mappings"])
    assert inv_key_match, "Failed to match client_id <-> customer_id"
    print("  ✓ Schema mapping identified 'client_id' ↔ 'customer_id'.")

    # B. Inner Join Preview (Generic account linkage: 15 rows)
    join_res4 = apply_schema_mapping(SchemaMappingRequest(
        dataset_a_id=inv_id,
        dataset_b_id=txn_id,
        mappings=[{"source_column": "client_id", "target_column": "customer_id"}],
        join_key_a="client_id",
        join_key_b="customer_id",
        join_type="inner"
    ))
    print(f"  • Account-Level Join: {join_res4['total_rows']} matching invoice/transaction records.")
    assert join_res4["total_rows"] == 15, f"Expected 15 rows in account-level join, got {join_res4['total_rows']}"

    # C. Financial Reconciliation Audit (Distinguish payment states from existing data)
    db_test = SessionLocal()
    try:
        ds_inv = db_test.query(DatasetModel).filter(DatasetModel.id == inv_id).first()
        ds_txn = db_test.query(DatasetModel).filter(DatasetModel.id == txn_id).first()
        df_inv = _read_dataset(ds_inv.file_path)
        df_txn = _read_dataset(ds_txn.file_path)
    finally:
        db_test.close()

    # Distinguish exact payment matches (customer + exact amount + completed status)
    exact_matches = pd.merge(df_inv, df_txn, left_on=["client_id", "invoice_amount"], right_on=["customer_id", "amount"])
    exact_completed = exact_matches[exact_matches["payment_status_y"] == "Completed"]
    print(f"  • Exact Payment Matches: {len(exact_completed)} invoices fully paid and settled.")
    assert len(exact_completed) == 7, f"Expected 7 exact completed payments, got {len(exact_completed)}"

    # Distinguish partial payment (C110: invoice 5400 vs txn 2200)
    c110_inv = df_inv[df_inv["client_id"] == "C110"]["invoice_amount"].iloc[0]
    c110_txn = df_txn[df_txn["customer_id"] == "C110"]["amount"].iloc[0]
    assert c110_inv == 5400 and c110_txn == 2200, "Failed to identify partial payment for C110"
    print(f"  • Partial Payment: Invoice INV-1008 (${c110_inv}) partially paid with ${c110_txn} (outstanding: ${c110_inv - c110_txn}).")

    # Distinguish pending transaction (C105 / TXN-5005)
    pending_txns = df_txn[df_txn["payment_status"] == "Pending"]
    assert len(pending_txns) == 1 and pending_txns["customer_id"].iloc[0] == "C105"
    print(f"  • Pending Transaction: TXN-5005 for customer C105 is currently Pending settlement.")

    # Distinguish failed payment (C106 / TXN-5007)
    failed_txns = df_txn[df_txn["payment_status"] == "Failed"]
    assert len(failed_txns) == 1 and failed_txns["customer_id"].iloc[0] == "C106"
    print(f"  • Failed Payment: TXN-5007 ($6,200) Failed; invoice INV-1005 is Overdue.")

    # Distinguish unpaid invoice with no transaction (C112 / INV-1009)
    unpaid_clients = set(df_inv["client_id"]) - set(df_txn["customer_id"])
    assert "C112" in unpaid_clients
    print(f"  • Unpaid Invoice: INV-1009 for client C112 has 0 payment transactions.")

    # Distinguish unmatched transactions (C199 / TXN-5011)
    unmatched_txn_clients = set(df_txn["customer_id"]) - set(df_inv["client_id"])
    assert "C199" in unmatched_txn_clients
    print(f"  • Unmatched Transaction: TXN-5011 for client C199 has no registered invoice.")

    # Distinguish duplicate transactions (TXN-5003 for C103)
    tx_dupes = df_txn[df_txn.duplicated(subset=["transaction_id"], keep=False)]
    assert len(tx_dupes) == 2 and "TXN-5003" in tx_dupes["transaction_id"].values
    print(f"  • Duplicate Transaction: TXN-5003 recorded twice in banking log.")
    print("  ✓ Scenario 4 completed successfully with full financial reconciliation clarity.")

    # -------------------------------------------------------------------------
    # 8. HEALTHCARE & SUPPLY CHAIN CROSS-DOMAIN INTEGRATIONS
    # -------------------------------------------------------------------------
    print("\n[TEST 8] Healthcare & Supply Chain Cross-Domain Integrations")
    
    # Healthcare: patient_records <-> appointments
    pat_id = loaded_ids["sample-patient-records"]
    apt_id = loaded_ids["sample-appointments"]
    map_pat = analyze_schema(SchemaAnalyzeRequest(dataset_a_id=pat_id, dataset_b_id=apt_id))
    assert any(m["source_column"] == "patient_id" and m["target_column"] == "patient_reference" for m in map_pat["mappings"])
    print("  ✓ Healthcare: 'patient_id' ↔ 'patient_reference' mapped.")

    # Supply Chain: suppliers <-> purchase_orders
    sup_id = loaded_ids["sample-suppliers"]
    po_id = loaded_ids["sample-purchase-orders"]
    map_sup = analyze_schema(SchemaAnalyzeRequest(dataset_a_id=sup_id, dataset_b_id=po_id))
    assert any(m["source_column"] == "supplier_id" and m["target_column"] == "vendor_reference" for m in map_sup["mappings"])
    print("  ✓ Supply Chain: 'supplier_id' ↔ 'vendor_reference' mapped.")

    # Inventory: products <-> inventory
    prod_id = loaded_ids["sample-products"]
    inv_stock_id = loaded_ids["sample-inventory"]
    map_inv = analyze_schema(SchemaAnalyzeRequest(dataset_a_id=prod_id, dataset_b_id=inv_stock_id))
    assert any(m["source_column"] == "product_id" and m["target_column"] == "product_reference" for m in map_inv["mappings"])
    print("  ✓ Inventory: 'product_id' ↔ 'product_reference' mapped.")

    # -------------------------------------------------------------------------
    # 9. CLEAN UP TEST DATASETS IN DB
    # -------------------------------------------------------------------------
    db = SessionLocal()
    db.query(DatasetModel).filter(DatasetModel.id.in_(list(loaded_ids.values()))).delete(synchronize_session=False)
    db.commit()
    db.close()

    print("\n" + "=" * 80)
    print("🎉 ALL 15 DATASETS AND 4 PRACTICAL SCENARIOS PASSED WITH 100% SUCCESS RATE!")
    print("=" * 80)

if __name__ == "__main__":
    run_sample_and_scenario_tests()

