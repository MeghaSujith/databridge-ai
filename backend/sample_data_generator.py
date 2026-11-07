import os
import json
from pathlib import Path
import pandas as pd
import numpy as np

# =============================================================================
# Sample Datasets Metadata Catalog
# =============================================================================
SAMPLE_DATASETS_META = [
    {
        "id": "sample-employees",
        "filename": "employees.csv",
        "name": "employees.csv",
        "category": "Human Resources",
        "format": "CSV",
        "description": "Employee master records with IDs, departments, titles, and salaries (contains 1 duplicate, 1 missing email, casing variance)",
        "primary_key": "employee_id",
        "links_with": ["employee_attendance.xlsx (staff_id)", "payroll.json (employee_code)", "departments.csv (department)"],
    },
    {
        "id": "sample-employee-attendance",
        "filename": "employee_attendance.xlsx",
        "name": "employee_attendance.xlsx",
        "category": "Human Resources",
        "format": "XLSX",
        "description": "Daily time & attendance logs, clock-in/out times, and work hours (contains absent records, unmatched contractor)",
        "primary_key": "staff_id",
        "links_with": ["employees.csv (employee_id)"],
    },
    {
        "id": "sample-payroll",
        "filename": "payroll.json",
        "name": "payroll.json",
        "category": "Human Resources",
        "format": "JSON",
        "description": "Monthly salary breakdown with basic pay, bonuses, and tax deductions (contains missing bonuses, unmatched staff)",
        "primary_key": "employee_code",
        "links_with": ["employees.csv (employee_id)"],
    },
    {
        "id": "sample-transactions",
        "filename": "transactions.csv",
        "name": "transactions.csv",
        "category": "Finance",
        "format": "CSV",
        "description": "Customer transaction stream with payments, refunds, and statuses (contains 1 duplicate, 1 unmatched customer)",
        "primary_key": "customer_id",
        "links_with": ["customers.csv (customer_id)", "invoices.xlsx (client_id)"],
    },
    {
        "id": "sample-invoices",
        "filename": "invoices.xlsx",
        "name": "invoices.xlsx",
        "category": "Finance",
        "format": "XLSX",
        "description": "Accounts receivable invoices with issue/due dates and payment status (contains draft without due date, unpaid records)",
        "primary_key": "client_id",
        "links_with": ["transactions.csv (customer_id)", "customers.csv (customer_id)"],
    },
    {
        "id": "sample-expenses",
        "filename": "expenses.json",
        "name": "expenses.json",
        "category": "Finance",
        "format": "JSON",
        "description": "Departmental operating expenses, vendor disbursements, and approvals (contains missing approval status)",
        "primary_key": "department",
        "links_with": ["departments.csv (department_name)", "employees.csv (department)"],
    },
    {
        "id": "sample-customers",
        "filename": "customers.csv",
        "name": "customers.csv",
        "category": "Sales and Customers",
        "format": "CSV",
        "description": "Enterprise CRM accounts with contact info, locations, and sign-up dates (contains 1 duplicate, 1 missing email)",
        "primary_key": "customer_id",
        "links_with": ["sales_orders.xlsx (client_reference)", "transactions.csv (customer_id)", "invoices.xlsx (client_id)"],
    },
    {
        "id": "sample-sales-orders",
        "filename": "sales_orders.xlsx",
        "name": "sales_orders.xlsx",
        "category": "Sales and Customers",
        "format": "XLSX",
        "description": "B2B sales orders with client references, product SKUs, and order totals (contains unmatched client reference)",
        "primary_key": "client_reference",
        "links_with": ["customers.csv (customer_id)", "products.json (product_id)"],
    },
    {
        "id": "sample-products",
        "filename": "products.json",
        "name": "products.json",
        "category": "Sales and Customers",
        "format": "JSON",
        "description": "Product catalog with categories, unit pricing, and warehouse stock counts (links across sales, inventory, and procurement)",
        "primary_key": "product_id",
        "links_with": ["sales_orders.xlsx (product_id)", "purchase_orders.xlsx (product_id)", "inventory.json (product_reference)"],
    },
    {
        "id": "sample-patient-records",
        "filename": "patient_records.csv",
        "name": "patient_records.csv",
        "category": "Healthcare",
        "format": "CSV",
        "description": "Hospital clinic patient roster with age, department, and visit dates (contains 1 duplicate, 1 missing age value)",
        "primary_key": "patient_id",
        "links_with": ["appointments.xlsx (patient_reference)"],
    },
    {
        "id": "sample-appointments",
        "filename": "appointments.xlsx",
        "name": "appointments.xlsx",
        "category": "Healthcare",
        "format": "XLSX",
        "description": "Physician appointment schedule with assigned doctors and statuses (contains cancelled visits, emergency unmatched patient)",
        "primary_key": "patient_reference",
        "links_with": ["patient_records.csv (patient_id)"],
    },
    {
        "id": "sample-suppliers",
        "filename": "suppliers.csv",
        "name": "suppliers.csv",
        "category": "Supply Chain and Inventory",
        "format": "CSV",
        "description": "Component vendor directory with contact emails, locations, and categories (contains 1 duplicate, 1 missing email)",
        "primary_key": "supplier_id",
        "links_with": ["purchase_orders.xlsx (vendor_reference)"],
    },
    {
        "id": "sample-purchase-orders",
        "filename": "purchase_orders.xlsx",
        "name": "purchase_orders.xlsx",
        "category": "Supply Chain and Inventory",
        "format": "XLSX",
        "description": "Procurement purchase orders linked to component suppliers and products (contains unmatched vendor code)",
        "primary_key": "vendor_reference",
        "links_with": ["suppliers.csv (supplier_id)", "products.json (product_id)"],
    },
    {
        "id": "sample-inventory",
        "filename": "inventory.json",
        "name": "inventory.json",
        "category": "Supply Chain and Inventory",
        "format": "JSON",
        "description": "Multi-warehouse inventory levels with reorder thresholds and timestamps (contains legacy uncatalogued SKU)",
        "primary_key": "product_reference",
        "links_with": ["products.json (product_id)"],
    },
    {
        "id": "sample-departments",
        "filename": "departments.csv",
        "name": "departments.csv",
        "category": "Supply Chain and Inventory",
        "format": "CSV",
        "description": "Corporate departmental hierarchy with manager IDs, locations, and annual budgets",
        "primary_key": "department_name",
        "links_with": ["employees.csv (department)", "expenses.json (department)"],
    },
]

# Quick lookup by ID or filename
SAMPLE_MAP = {s["id"]: s for s in SAMPLE_DATASETS_META}
for s in SAMPLE_DATASETS_META:
    SAMPLE_MAP[s["filename"]] = s

# =============================================================================
# Practical Demonstration Scenarios
# =============================================================================
SCENARIOS_META = [
    {
        "id": "scenario-1",
        "title": "Scenario 1: Employee & Payroll Integration",
        "category": "Human Resources",
        "description": "Merge HR master records (CSV) with monthly payroll (JSON) using employee identifiers. Detect missing salary records and duplicate employees.",
        "dataset_a_sample_id": "sample-employees",
        "dataset_b_sample_id": "sample-payroll",
        "dataset_a_filename": "employees.csv",
        "dataset_b_filename": "payroll.json",
        "recommended_join_a": "employee_id",
        "recommended_join_b": "employee_code",
        "join_type": "left",
        "prompt": "Combine the employee and payroll datasets using employee ID. Remove duplicate employees and identify missing salary records.",
    },
    {
        "id": "scenario-2",
        "title": "Scenario 2: Employee & Attendance Integration",
        "category": "Human Resources",
        "description": "Correlate employee profiles (CSV) with attendance logs (Excel XLSX). Match employee_id with staff_id and identify unmatched attendance records.",
        "dataset_a_sample_id": "sample-employees",
        "dataset_b_sample_id": "sample-employee-attendance",
        "dataset_a_filename": "employees.csv",
        "dataset_b_filename": "employee_attendance.xlsx",
        "recommended_join_a": "employee_id",
        "recommended_join_b": "staff_id",
        "join_type": "left",
        "prompt": "Join employees and attendance on employee_id = staff_id. Filter for present status and handle missing check-in times.",
    },
    {
        "id": "scenario-3",
        "title": "Scenario 3: Customer & Sales Orders Integration",
        "category": "Sales and Customers",
        "description": "Combine enterprise CRM customers (CSV) with sales orders (Excel XLSX) by mapping customer_id to client_reference. Discover orders from unregistered clients.",
        "dataset_a_sample_id": "sample-customers",
        "dataset_b_sample_id": "sample-sales-orders",
        "dataset_a_filename": "customers.csv",
        "dataset_b_filename": "sales_orders.xlsx",
        "recommended_join_a": "customer_id",
        "recommended_join_b": "client_reference",
        "join_type": "right",
        "prompt": "Merge customer records with sales orders using customer ID and client reference. Identify orders with unmatched clients.",
    },
    {
        "id": "scenario-4",
        "title": "Scenario 4: Invoice & Transaction Reconciliation",
        "category": "Finance",
        "description": "Reconcile accounts receivable invoices (Excel XLSX) against banking payment transactions (CSV). Match client_id to customer_id and verify payment completeness.",
        "dataset_a_sample_id": "sample-invoices",
        "dataset_b_sample_id": "sample-transactions",
        "dataset_a_filename": "invoices.xlsx",
        "dataset_b_filename": "transactions.csv",
        "recommended_join_a": "client_id",
        "recommended_join_b": "customer_id",
        "join_type": "inner",
        "prompt": "Reconcile invoices and transactions on client_id = customer_id. Filter for completed payments and calculate outstanding balances.",
    },
]

# Cache for dynamic file stats
_STATS_CACHE = {}

def get_sample_catalog(samples_dir: Path):
    """Dynamically compute row and column counts from actual files on disk."""
    results = []
    for item in SAMPLE_DATASETS_META:
        entry = dict(item)
        file_path = samples_dir / item["filename"]
        if file_path.exists():
            mtime = file_path.stat().st_mtime
            cache_key = (str(file_path), mtime)
            if cache_key in _STATS_CACHE:
                cached = _STATS_CACHE[cache_key]
                entry.update(cached)
            else:
                try:
                    ext = file_path.suffix.lower()
                    if ext == ".csv":
                        df = pd.read_csv(file_path)
                    elif ext == ".xlsx":
                        df = pd.read_excel(file_path)
                    elif ext == ".json":
                        df = pd.read_json(file_path)
                    else:
                        df = pd.DataFrame()

                    stat = {
                        "rows": len(df),
                        "columns": len(df.columns),
                        "column_names": list(df.columns),
                        "size_kb": round(file_path.stat().st_size / 1024, 1),
                    }
                    _STATS_CACHE[cache_key] = stat
                    entry.update(stat)
                except Exception as e:
                    entry["rows"] = 0
                    entry["columns"] = 0
                    entry["column_names"] = []
                    entry["size_kb"] = 0
        else:
            entry["rows"] = 0
            entry["columns"] = 0
            entry["column_names"] = []
            entry["size_kb"] = 0
        results.append(entry)
    return results

def get_sample_by_id(sample_id: str):
    return SAMPLE_MAP.get(sample_id)


# =============================================================================
# Generator Routine for 15 Datasets
# =============================================================================
def generate_all_samples(samples_dir: Path):
    samples_dir.mkdir(parents=True, exist_ok=True)

    # 1. Human Resources - employees.csv
    employees_path = samples_dir / "employees.csv"
    if not employees_path.exists():
        employees_df = pd.DataFrame([
            {"employee_id": "E001", "employee_name": "Alice Johnson", "department": "Engineering", "designation": "Senior Cloud Architect", "joining_date": "2021-03-15", "email": "alice.johnson@company.com", "salary": 115000},
            {"employee_id": "E002", "employee_name": "Bob Smith", "department": "Marketing", "designation": "Growth Marketing Lead", "joining_date": "2020-07-22", "email": "bob.smith@company.com", "salary": 82000},
            {"employee_id": "E003", "employee_name": "Carol White", "department": "Engineering", "designation": "Lead Backend Engineer", "joining_date": "2022-01-10", "email": "carol.white@company.com", "salary": 98000},
            {"employee_id": "E004", "employee_name": "David Brown", "department": "HR", "designation": "Talent Acquisition Manager", "joining_date": "2019-11-05", "email": "david.brown@company.com", "salary": 75000},
            {"employee_id": "E005", "employee_name": "Eva Martinez", "department": "Finance", "designation": "Senior Financial Analyst", "joining_date": "2021-08-30", "email": "eva.martinez@company.com", "salary": 105000},
            {"employee_id": "E002", "employee_name": "Bob Smith", "department": "Marketing", "designation": "Growth Marketing Lead", "joining_date": "2020-07-22", "email": "bob.smith@company.com", "salary": 82000}, # Duplicate
            {"employee_id": "E006", "employee_name": "Frank Lee", "department": "Engineering", "designation": "DevOps Engineer", "joining_date": "2023-02-14", "email": None, "salary": 88000}, # Missing email
            {"employee_id": "E007", "employee_name": "Grace Kim", "department": "MARKETING", "designation": "Campaign Specialist", "joining_date": "2022-09-01", "email": "grace.kim@company.com", "salary": 71000}, # Casing inconsistency
            {"employee_id": "E008", "employee_name": "Henry Davis", "department": "Finance", "designation": "Accounting Manager", "joining_date": "2020-12-20", "email": "henry.davis@company.com", "salary": 94000},
            {"employee_id": "E009", "employee_name": "Iris Chen", "department": "HR", "designation": "HR Operations Specialist", "joining_date": "2021-05-17", "email": "iris.chen@company.com", "salary": 68000},
            {"employee_id": "E010", "employee_name": "Jack Wilson", "department": "Engineering", "designation": "QA Automation Lead", "joining_date": "2023-06-01", "email": "jack.wilson@company.com", "salary": 86000},
            {"employee_id": "E011", "employee_name": "Karen Taylor", "department": "Sales", "designation": "Enterprise Account Exec", "joining_date": "2022-04-18", "email": "karen.taylor@company.com", "salary": 95000},
            {"employee_id": "E012", "employee_name": "Leo Garcia", "department": "Operations", "designation": "Logistics Coordinator", "joining_date": "2023-08-11", "email": "leo.garcia@company.com", "salary": 64000},
        ])
        employees_df.to_csv(employees_path, index=False)

    # 2. Human Resources - employee_attendance.xlsx
    attendance_path = samples_dir / "employee_attendance.xlsx"
    if not attendance_path.exists():
        attendance_df = pd.DataFrame([
            {"staff_id": "E001", "attendance_date": "2024-10-01", "check_in": "08:58", "check_out": "17:30", "working_hours": 8.5, "attendance_status": "Present"},
            {"staff_id": "E002", "attendance_date": "2024-10-01", "check_in": "09:15", "check_out": "17:45", "working_hours": 8.5, "attendance_status": "Present"},
            {"staff_id": "E003", "attendance_date": "2024-10-01", "check_in": "09:02", "check_out": "17:15", "working_hours": 8.2, "attendance_status": "Present"},
            {"staff_id": "E004", "attendance_date": "2024-10-01", "check_in": "09:30", "check_out": "17:30", "working_hours": 8.0, "attendance_status": "Late"},
            {"staff_id": "E005", "attendance_date": "2024-10-01", "check_in": "08:45", "check_out": "17:15", "working_hours": 8.5, "attendance_status": "Present"},
            {"staff_id": "E006", "attendance_date": "2024-10-01", "check_in": None, "check_out": None, "working_hours": 0.0, "attendance_status": "Absent"},
            {"staff_id": "E007", "attendance_date": "2024-10-01", "check_in": "09:05", "check_out": "17:05", "working_hours": 8.0, "attendance_status": "Present"},
            {"staff_id": "E008", "attendance_date": "2024-10-01", "check_in": "08:55", "check_out": "17:25", "working_hours": 8.5, "attendance_status": "Present"},
            {"staff_id": "E009", "attendance_date": "2024-10-01", "check_in": "09:00", "check_out": "13:00", "working_hours": 4.0, "attendance_status": "Half-Day"},
            {"staff_id": "E011", "attendance_date": "2024-10-01", "check_in": "09:10", "check_out": "17:40", "working_hours": 8.5, "attendance_status": "Present"},
            {"staff_id": "E012", "attendance_date": "2024-10-01", "check_in": "08:50", "check_out": "17:20", "working_hours": 8.5, "attendance_status": "Present"},
            {"staff_id": "E099", "attendance_date": "2024-10-01", "check_in": "09:00", "check_out": "17:00", "working_hours": 8.0, "attendance_status": "Present"},
            {"staff_id": "E001", "attendance_date": "2024-10-02", "check_in": "09:05", "check_out": "17:35", "working_hours": 8.5, "attendance_status": "Present"},
            {"staff_id": "E003", "attendance_date": "2024-10-02", "check_in": "08:50", "check_out": "17:10", "working_hours": 8.3, "attendance_status": "Present"},
        ])
        with pd.ExcelWriter(attendance_path, engine="openpyxl") as writer:
            attendance_df.to_excel(writer, index=False, sheet_name="Attendance_Log")

    # 3. Human Resources - payroll.json
    payroll_path = samples_dir / "payroll.json"
    if not payroll_path.exists():
        payroll_data = [
            {"employee_code": "E001", "basic_salary": 95000, "deductions": 7500, "bonuses": 8000, "net_salary": 95500, "payment_date": "2024-09-30"},
            {"employee_code": "E002", "basic_salary": 72000, "deductions": 5500, "bonuses": 4000, "net_salary": 70500, "payment_date": "2024-09-30"},
            {"employee_code": "E003", "basic_salary": 88000, "deductions": 6800, "bonuses": 6000, "net_salary": 87200, "payment_date": "2024-09-30"},
            {"employee_code": "E005", "basic_salary": 105000, "deductions": 8500, "bonuses": 9000, "net_salary": 105500, "payment_date": "2024-09-30"},
            {"employee_code": "E007", "basic_salary": 68000, "deductions": 5000, "bonuses": 3500, "net_salary": 66500, "payment_date": "2024-09-30"},
            {"employee_code": "E008", "basic_salary": 92000, "deductions": 7200, "bonuses": 7000, "net_salary": 91800, "payment_date": "2024-09-30"},
            {"employee_code": "E009", "basic_salary": 65000, "deductions": 4800, "bonuses": None, "net_salary": 60200, "payment_date": "2024-09-30"},
            {"employee_code": "E011", "basic_salary": 85000, "deductions": 6500, "bonuses": 7500, "net_salary": 86000, "payment_date": "2024-09-30"},
            {"employee_code": "E012", "basic_salary": 58000, "deductions": 4200, "bonuses": 2500, "net_salary": 56300, "payment_date": "2024-09-30"},
            {"employee_code": "E088", "basic_salary": 77000, "deductions": 5800, "bonuses": 4500, "net_salary": 75700, "payment_date": "2024-09-30"},
            {"employee_code": "E001", "basic_salary": 95000, "deductions": 7500, "bonuses": 8000, "net_salary": 95500, "payment_date": "2024-08-31"},
        ]
        payroll_path.write_text(json.dumps(payroll_data, indent=2), encoding="utf-8")

    # 4. Finance - transactions.csv
    transactions_path = samples_dir / "transactions.csv"
    if not transactions_path.exists():
        transactions_df = pd.DataFrame([
            {"transaction_id": "TXN-5001", "customer_id": "C101", "amount": 1500.00, "transaction_type": "Payment", "transaction_date": "2024-08-10", "payment_status": "Completed"},
            {"transaction_id": "TXN-5002", "customer_id": "C102", "amount": 3200.50, "transaction_type": "Payment", "transaction_date": "2024-08-12", "payment_status": "Completed"},
            {"transaction_id": "TXN-5003", "customer_id": "C103", "amount": 850.00, "transaction_type": "Refund", "transaction_date": "2024-08-15", "payment_status": "Settled"},
            {"transaction_id": "TXN-5003", "customer_id": "C103", "amount": 850.00, "transaction_type": "Refund", "transaction_date": "2024-08-15", "payment_status": "Settled"},
            {"transaction_id": "TXN-5004", "customer_id": "C104", "amount": 4500.00, "transaction_type": "Payment", "transaction_date": "2024-08-18", "payment_status": "Completed"},
            {"transaction_id": "TXN-5005", "customer_id": "C105", "amount": 1200.00, "transaction_type": "Payment", "transaction_date": "2024-08-20", "payment_status": "Pending"},
            {"transaction_id": "TXN-5006", "customer_id": "C101", "amount": 2800.00, "transaction_type": "Payment", "transaction_date": "2024-08-22", "payment_status": "Completed"},
            {"transaction_id": "TXN-5007", "customer_id": "C106", "amount": 6200.00, "transaction_type": "Payment", "transaction_date": "2024-08-25", "payment_status": "Failed"},
            {"transaction_id": "TXN-5008", "customer_id": "C107", "amount": 950.00, "transaction_type": "Payment", "transaction_date": "2024-08-27", "payment_status": "Completed"},
            {"transaction_id": "TXN-5009", "customer_id": "C108", "amount": 3100.00, "transaction_type": "Payment", "transaction_date": "2024-08-29", "payment_status": "Completed"},
            {"transaction_id": "TXN-5010", "customer_id": "C109", "amount": 1750.00, "transaction_type": "Payment", "transaction_date": "2024-09-02", "payment_status": "Completed"},
            {"transaction_id": "TXN-5011", "customer_id": "C199", "amount": 4100.00, "transaction_type": "Payment", "transaction_date": "2024-09-05", "payment_status": "Completed"},
            {"transaction_id": "TXN-5012", "customer_id": "C102", "amount": 1850.00, "transaction_type": "Payment", "transaction_date": "2024-09-08", "payment_status": "Completed"},
            {"transaction_id": "TXN-5013", "customer_id": "C110", "amount": 2200.00, "transaction_type": "Payment", "transaction_date": "2024-09-11", "payment_status": "Completed"},
        ])
        transactions_df.to_csv(transactions_path, index=False)

    # 5. Finance - invoices.xlsx
    invoices_path = samples_dir / "invoices.xlsx"
    if not invoices_path.exists():
        invoices_df = pd.DataFrame([
            {"invoice_id": "INV-1001", "client_id": "C101", "invoice_amount": 1500.00, "issue_date": "2024-08-01", "due_date": "2024-08-31", "payment_status": "Paid"},
            {"invoice_id": "INV-1002", "client_id": "C102", "invoice_amount": 3200.50, "issue_date": "2024-08-05", "due_date": "2024-09-05", "payment_status": "Paid"},
            {"invoice_id": "INV-1003", "client_id": "C104", "invoice_amount": 4500.00, "issue_date": "2024-08-10", "due_date": "2024-09-10", "payment_status": "Paid"},
            {"invoice_id": "INV-1004", "client_id": "C105", "invoice_amount": 1200.00, "issue_date": "2024-08-15", "due_date": "2024-09-15", "payment_status": "Unpaid"},
            {"invoice_id": "INV-1005", "client_id": "C106", "invoice_amount": 6200.00, "issue_date": "2024-08-18", "due_date": "2024-09-18", "payment_status": "Overdue"},
            {"invoice_id": "INV-1006", "client_id": "C107", "invoice_amount": 950.00, "issue_date": "2024-08-20", "due_date": "2024-09-20", "payment_status": "Paid"},
            {"invoice_id": "INV-1007", "client_id": "C108", "invoice_amount": 3100.00, "issue_date": "2024-08-22", "due_date": "2024-09-22", "payment_status": "Paid"},
            {"invoice_id": "INV-1008", "client_id": "C110", "invoice_amount": 5400.00, "issue_date": "2024-08-25", "due_date": "2024-09-25", "payment_status": "Unpaid"},
            {"invoice_id": "INV-1009", "client_id": "C112", "invoice_amount": 2900.00, "issue_date": "2024-08-28", "due_date": "2024-09-28", "payment_status": "Unpaid"},
            {"invoice_id": "INV-1010", "client_id": "C101", "invoice_amount": 2800.00, "issue_date": "2024-08-15", "due_date": "2024-09-15", "payment_status": "Paid"},
            {"invoice_id": "INV-1011", "client_id": "C103", "invoice_amount": 1100.00, "issue_date": "2024-08-10", "due_date": None, "payment_status": "Draft"},
            {"invoice_id": "INV-1012", "client_id": "C109", "invoice_amount": 1750.00, "issue_date": "2024-09-01", "due_date": "2024-10-01", "payment_status": "Paid"},
        ])
        with pd.ExcelWriter(invoices_path, engine="openpyxl") as writer:
            invoices_df.to_excel(writer, index=False, sheet_name="Invoices_2024")

    # 6. Finance - expenses.json
    expenses_path = samples_dir / "expenses.json"
    if not expenses_path.exists():
        expenses_data = [
            {"expense_id": "EXP-301", "department": "Engineering", "expense_category": "Cloud Infrastructure", "amount": 14500.00, "approval_status": "Approved", "submission_date": "2024-08-01"},
            {"expense_id": "EXP-302", "department": "Marketing", "expense_category": "Advertising Campaigns", "amount": 8200.00, "approval_status": "Approved", "submission_date": "2024-08-03"},
            {"expense_id": "EXP-303", "department": "HR", "expense_category": "Recruitment Software", "amount": 3400.00, "approval_status": "Approved", "submission_date": "2024-08-05"},
            {"expense_id": "EXP-304", "department": "Finance", "expense_category": "Audit & Compliance", "amount": 6500.00, "approval_status": "Approved", "submission_date": "2024-08-08"},
            {"expense_id": "EXP-305", "department": "Operations", "expense_category": "Facility Maintenance", "amount": 4100.00, "approval_status": "Approved", "submission_date": "2024-08-10"},
            {"expense_id": "EXP-306", "department": "Engineering", "expense_category": "Hardware Workstations", "amount": 9800.00, "approval_status": "Approved", "submission_date": "2024-08-12"},
            {"expense_id": "EXP-307", "department": "Marketing", "expense_category": "Conference Sponsorship", "amount": 5500.00, "approval_status": "Pending", "submission_date": "2024-08-15"},
            {"expense_id": "EXP-308", "department": "Sales", "expense_category": "Client Entertainment", "amount": 2100.00, "approval_status": "Approved", "submission_date": "2024-08-18"},
            {"expense_id": "EXP-309", "department": "HR", "expense_category": "Employee Training", "amount": 4800.00, "approval_status": "Rejected", "submission_date": "2024-08-20"},
            {"expense_id": "EXP-310", "department": "Engineering", "expense_category": "SaaS Subscriptions", "amount": 7200.00, "approval_status": "Approved", "submission_date": "2024-08-22"},
            {"expense_id": "EXP-311", "department": "Operations", "expense_category": "Shipping & Logistics", "amount": 3900.00, "approval_status": None, "submission_date": "2024-08-25"},
            {"expense_id": "EXP-312", "department": "Finance", "expense_category": "Tax Advisory Services", "amount": 5200.00, "approval_status": "Approved", "submission_date": "2024-08-28"},
        ]
        expenses_path.write_text(json.dumps(expenses_data, indent=2), encoding="utf-8")

    # 7. Sales and Customer Management - customers.csv
    customers_path = samples_dir / "customers.csv"
    if not customers_path.exists():
        customers_df = pd.DataFrame([
            {"customer_id": "C101", "customer_name": "Acme Global Logistics", "email": "contact@acmeglobal.com", "location": "New York", "registration_date": "2022-01-15"},
            {"customer_id": "C102", "customer_name": "BlueWave Technologies", "email": "info@bluewave.io", "location": "San Francisco", "registration_date": "2022-03-20"},
            {"customer_id": "C103", "customer_name": "Crestline Partners", "email": "billing@crestline.com", "location": "Chicago", "registration_date": "2022-06-11"},
            {"customer_id": "C104", "customer_name": "Delta Healthcare Systems", "email": "ap@deltahealth.org", "location": "Austin", "registration_date": "2022-09-04"},
            {"customer_id": "C105", "customer_name": "Echo Media Networks", "email": "accounting@echomedia.net", "location": "Boston", "registration_date": "2023-02-18"},
            {"customer_id": "C106", "customer_name": "Frontier Aerospace", "email": "finance@frontieraero.com", "location": "Seattle", "registration_date": "2023-04-22"},
            {"customer_id": "C107", "customer_name": "Greenleaf Agribusiness", "email": "orders@greenleaf.com", "location": "Denver", "registration_date": "2023-07-30"},
            {"customer_id": "C108", "customer_name": "Horizon Financial", "email": "support@horizonfin.com", "location": "new york", "registration_date": "2023-10-14"},
            {"customer_id": "C109", "customer_name": "Ironclad Security", "email": "payments@ironcladsec.com", "location": "Atlanta", "registration_date": "2024-01-08"},
            {"customer_id": "C110", "customer_name": "Jupiter Retail Group", "email": "admin@jupiterretail.com", "location": "Dallas", "registration_date": "2024-03-25"},
            {"customer_id": "C101", "customer_name": "Acme Global Logistics", "email": "contact@acmeglobal.com", "location": "New York", "registration_date": "2022-01-15"},
            {"customer_id": "C113", "customer_name": "Keystone Industrial", "email": None, "location": "Los Angeles", "registration_date": "2024-05-19"},
        ])
        customers_df.to_csv(customers_path, index=False)

    # 8. Sales and Customer Management - sales_orders.xlsx
    sales_orders_path = samples_dir / "sales_orders.xlsx"
    if not sales_orders_path.exists():
        sales_orders_df = pd.DataFrame([
            {"order_id": "ORD-7001", "client_reference": "C101", "product_id": "P201", "quantity": 10, "total_amount": 4999.00, "order_date": "2024-07-01"},
            {"order_id": "ORD-7002", "client_reference": "C102", "product_id": "P203", "quantity": 5, "total_amount": 2495.00, "order_date": "2024-07-03"},
            {"order_id": "ORD-7003", "client_reference": "C103", "product_id": "P202", "quantity": 15, "total_amount": 4350.00, "order_date": "2024-07-08"},
            {"order_id": "ORD-7004", "client_reference": "C104", "product_id": "P205", "quantity": 8, "total_amount": 3600.00, "order_date": "2024-07-12"},
            {"order_id": "ORD-7005", "client_reference": "C105", "product_id": "P201", "quantity": 4, "total_amount": 1999.60, "order_date": "2024-07-15"},
            {"order_id": "ORD-7006", "client_reference": "C106", "product_id": "P204", "quantity": 12, "total_amount": 1788.00, "order_date": "2024-07-19"},
            {"order_id": "ORD-7007", "client_reference": "C107", "product_id": "P206", "quantity": 6, "total_amount": 2100.00, "order_date": "2024-07-22"},
            {"order_id": "ORD-7008", "client_reference": "C108", "product_id": "P203", "quantity": 9, "total_amount": 4491.00, "order_date": "2024-07-26"},
            {"order_id": "ORD-7009", "client_reference": "C109", "product_id": "P202", "quantity": 7, "total_amount": 2030.00, "order_date": "2024-07-30"},
            {"order_id": "ORD-7010", "client_reference": "C110", "product_id": "P205", "quantity": 10, "total_amount": 4500.00, "order_date": "2024-08-02"},
            {"order_id": "ORD-7011", "client_reference": "C199", "product_id": "P201", "quantity": 3, "total_amount": 1499.70, "order_date": "2024-08-05"},
            {"order_id": "ORD-7012", "client_reference": "C101", "product_id": "P207", "quantity": 2, "total_amount": 980.00, "order_date": "2024-08-09"},
            {"order_id": "ORD-7013", "client_reference": "C102", "product_id": "P208", "quantity": 14, "total_amount": 2660.00, "order_date": "2024-08-14"},
            {"order_id": "ORD-7014", "client_reference": "C104", "product_id": "P203", "quantity": 4, "total_amount": 1996.00, "order_date": "2024-08-18"},
        ])
        with pd.ExcelWriter(sales_orders_path, engine="openpyxl") as writer:
            sales_orders_df.to_excel(writer, index=False, sheet_name="Q3_Orders")

    # 9. Sales and Customer Management - products.json
    products_path = samples_dir / "products.json"
    if not products_path.exists():
        products_data = [
            {"product_id": "P201", "product_name": "Enterprise Server Blade X1", "category": "Hardware", "price": 499.90, "stock_quantity": 85},
            {"product_id": "P202", "product_name": "Cloud Data Gateway Pro", "category": "Networking", "price": 290.00, "stock_quantity": 140},
            {"product_id": "P203", "product_name": "AI Inference Accelerator", "category": "Hardware", "price": 499.00, "stock_quantity": 60},
            {"product_id": "P204", "product_name": "Edge IoT Sensor Module", "category": "IoT Devices", "price": 149.00, "stock_quantity": 320},
            {"product_id": "P205", "product_name": "Managed Firewall Appliance", "category": "Security", "price": 450.00, "stock_quantity": 95},
            {"product_id": "P206", "product_name": "Optical Fiber Transceiver", "category": "Networking", "price": 350.00, "stock_quantity": 210},
            {"product_id": "P207", "product_name": "Redundant Power Supply 1200W", "category": "Accessories", "price": 490.00, "stock_quantity": 115},
            {"product_id": "P208", "product_name": "Smart Rack Cooling Fan Array", "category": "Hardware", "price": 190.00, "stock_quantity": 180},
            {"product_id": "P209", "product_name": "High-Density NVMe Storage Array", "category": "Storage", "price": 890.00, "stock_quantity": 40},
            {"product_id": "P210", "product_name": "Industrial Ethernet Switch 24P", "category": "Networking", "price": 620.00, "stock_quantity": 75},
        ]
        products_path.write_text(json.dumps(products_data, indent=2), encoding="utf-8")

    # 10. Healthcare - patient_records.csv
    patients_path = samples_dir / "patient_records.csv"
    if not patients_path.exists():
        patients_df = pd.DataFrame([
            {"patient_id": "PT-001", "patient_name": "Eleanor Vance", "age": 42, "department": "Cardiology", "visit_date": "2024-06-10"},
            {"patient_id": "PT-002", "patient_name": "Marcus Brody", "age": 58, "department": "Oncology", "visit_date": "2024-06-12"},
            {"patient_id": "PT-003", "patient_name": "Sophia Patel", "age": 29, "department": "Neurology", "visit_date": "2024-06-15"},
            {"patient_id": "PT-004", "patient_name": "Julian Thorne", "age": 64, "department": "Orthopedics", "visit_date": "2024-06-18"},
            {"patient_id": "PT-005", "patient_name": "Clara Oswald", "age": 35, "department": "Pediatrics", "visit_date": "2024-06-21"},
            {"patient_id": "PT-002", "patient_name": "Marcus Brody", "age": 58, "department": "Oncology", "visit_date": "2024-06-12"},
            {"patient_id": "PT-006", "patient_name": "Arthur Dent", "age": 46, "department": "Gastroenterology", "visit_date": "2024-06-25"},
            {"patient_id": "PT-007", "patient_name": "Natasha Roman", "age": 33, "department": "Cardiology", "visit_date": "2024-06-28"},
            {"patient_id": "PT-008", "patient_name": "Bruce Banner", "age": 51, "department": "Endocrinology", "visit_date": "2024-07-02"},
            {"patient_id": "PT-009", "patient_name": "Diana Prince", "age": None, "department": "Neurology", "visit_date": "2024-07-05"},
            {"patient_id": "PT-010", "patient_name": "Clark Kent", "age": 38, "department": "Orthopedics", "visit_date": "2024-07-08"},
            {"patient_id": "PT-011", "patient_name": "Barry Allen", "age": 28, "department": "Cardiology", "visit_date": "2024-07-12"},
        ])
        patients_df.to_csv(patients_path, index=False)

    # 11. Healthcare - appointments.xlsx
    appointments_path = samples_dir / "appointments.xlsx"
    if not appointments_path.exists():
        appointments_df = pd.DataFrame([
            {"patient_reference": "PT-001", "appointment_id": "APT-801", "doctor_name": "Dr. Gregory House", "appointment_date": "2024-06-10", "appointment_status": "Completed"},
            {"patient_reference": "PT-002", "appointment_id": "APT-802", "doctor_name": "Dr. Allison Cameron", "appointment_date": "2024-06-12", "appointment_status": "Completed"},
            {"patient_reference": "PT-003", "appointment_id": "APT-803", "doctor_name": "Dr. James Wilson", "appointment_date": "2024-06-15", "appointment_status": "Completed"},
            {"patient_reference": "PT-004", "appointment_id": "APT-804", "doctor_name": "Dr. Robert Chase", "appointment_date": "2024-06-18", "appointment_status": "Completed"},
            {"patient_reference": "PT-005", "appointment_id": "APT-805", "doctor_name": "Dr. Eric Foreman", "appointment_date": "2024-06-21", "appointment_status": "Completed"},
            {"patient_reference": "PT-007", "appointment_id": "APT-806", "doctor_name": "Dr. Gregory House", "appointment_date": "2024-06-28", "appointment_status": "Completed"},
            {"patient_reference": "PT-009", "appointment_id": "APT-807", "doctor_name": "Dr. James Wilson", "appointment_date": "2024-07-05", "appointment_status": "Scheduled"},
            {"patient_reference": "PT-010", "appointment_id": "APT-808", "doctor_name": "Dr. Robert Chase", "appointment_date": "2024-07-08", "appointment_status": "Completed"},
            {"patient_reference": "PT-099", "appointment_id": "APT-809", "doctor_name": "Dr. Meredith Grey", "appointment_date": "2024-07-12", "appointment_status": "Completed"},
            {"patient_reference": "PT-001", "appointment_id": "APT-810", "doctor_name": "Dr. Gregory House", "appointment_date": "2024-07-15", "appointment_status": "Follow-up"},
            {"patient_reference": "PT-003", "appointment_id": "APT-811", "doctor_name": "Dr. James Wilson", "appointment_date": "2024-07-20", "appointment_status": "Cancelled"},
            {"patient_reference": "PT-011", "appointment_id": "APT-812", "doctor_name": "Dr. Allison Cameron", "appointment_date": "2024-07-25", "appointment_status": "Completed"},
        ])
        with pd.ExcelWriter(appointments_path, engine="openpyxl") as writer:
            appointments_df.to_excel(writer, index=False, sheet_name="Appointments_Schedule")

    # 12. Supply Chain & Inventory - suppliers.csv
    suppliers_path = samples_dir / "suppliers.csv"
    if not suppliers_path.exists():
        suppliers_df = pd.DataFrame([
            {"supplier_id": "SUP-01", "supplier_name": "Apex Silicon Foundry", "contact_email": "sales@apexsilicon.com", "location": "Austin", "supplier_category": "Hardware"},
            {"supplier_id": "SUP-02", "supplier_name": "NexaTech Components", "contact_email": "b2b@nexatech.de", "location": "Munich", "supplier_category": "Networking"},
            {"supplier_id": "SUP-03", "supplier_name": "Pacific Optical Supplies", "contact_email": "info@pacificoptics.jp", "location": "Tokyo", "supplier_category": "Optics"},
            {"supplier_id": "SUP-04", "supplier_name": "Nordic Thermal Dynamics", "contact_email": "support@nordicthermal.se", "location": "Stockholm", "supplier_category": "Cooling"},
            {"supplier_id": "SUP-05", "supplier_name": "Quantum Sensors Inc", "contact_email": "orders@quantumsensors.com", "location": "Boston", "supplier_category": "IoT Devices"},
            {"supplier_id": "SUP-06", "supplier_name": "Veloce Cable Systems", "contact_email": "sales@velocecables.it", "location": "Milan", "supplier_category": "Accessories"},
            {"supplier_id": "SUP-07", "supplier_name": "Vanguard Storage Corp", "contact_email": None, "location": "San Jose", "supplier_category": "Storage"},
            {"supplier_id": "SUP-01", "supplier_name": "Apex Silicon Foundry", "contact_email": "sales@apexsilicon.com", "location": "Austin", "supplier_category": "Hardware"},
            {"supplier_id": "SUP-08", "supplier_name": "Titanium Power Modules", "contact_email": "orders@titaniumpower.com", "location": "Chicago", "supplier_category": "hardware"},
        ])
        suppliers_df.to_csv(suppliers_path, index=False)

    # 13. Supply Chain & Inventory - purchase_orders.xlsx
    po_path = samples_dir / "purchase_orders.xlsx"
    if not po_path.exists():
        po_df = pd.DataFrame([
            {"purchase_order_id": "PO-4001", "vendor_reference": "SUP-01", "product_id": "P201", "quantity": 50, "order_value": 18500.00, "order_date": "2024-06-01"},
            {"purchase_order_id": "PO-4002", "vendor_reference": "SUP-02", "product_id": "P202", "quantity": 100, "order_value": 21000.00, "order_date": "2024-06-05"},
            {"purchase_order_id": "PO-4003", "vendor_reference": "SUP-01", "product_id": "P203", "quantity": 40, "order_value": 14800.00, "order_date": "2024-06-10"},
            {"purchase_order_id": "PO-4004", "vendor_reference": "SUP-05", "product_id": "P204", "quantity": 200, "order_value": 19000.00, "order_date": "2024-06-15"},
            {"purchase_order_id": "PO-4005", "vendor_reference": "SUP-02", "product_id": "P205", "quantity": 60, "order_value": 19200.00, "order_date": "2024-06-20"},
            {"purchase_order_id": "PO-4006", "vendor_reference": "SUP-03", "product_id": "P206", "quantity": 120, "order_value": 28800.00, "order_date": "2024-06-25"},
            {"purchase_order_id": "PO-4007", "vendor_reference": "SUP-06", "product_id": "P207", "quantity": 80, "order_value": 25600.00, "order_date": "2024-07-02"},
            {"purchase_order_id": "PO-4008", "vendor_reference": "SUP-04", "product_id": "P208", "quantity": 100, "order_value": 13000.00, "order_date": "2024-07-08"},
            {"purchase_order_id": "PO-4009", "vendor_reference": "SUP-07", "product_id": "P209", "quantity": 30, "order_value": 20100.00, "order_date": "2024-07-14"},
            {"purchase_order_id": "PO-4010", "vendor_reference": "SUP-99", "product_id": "P201", "quantity": 20, "order_value": 7400.00, "order_date": "2024-07-20"},
            {"purchase_order_id": "PO-4011", "vendor_reference": "SUP-01", "product_id": "P210", "quantity": 15, "order_value": 8100.00, "order_date": "2024-07-28"},
        ])
        with pd.ExcelWriter(po_path, engine="openpyxl") as writer:
            po_df.to_excel(writer, index=False, sheet_name="Purchase_Orders")

    # 14. Supply Chain & Inventory - inventory.json
    inventory_path = samples_dir / "inventory.json"
    if not inventory_path.exists():
        inventory_data = [
            {"product_reference": "P201", "warehouse_id": "WH-EAST-01", "available_stock": 85, "reorder_level": 20, "last_updated": "2024-08-01"},
            {"product_reference": "P202", "warehouse_id": "WH-EAST-01", "available_stock": 140, "reorder_level": 30, "last_updated": "2024-08-01"},
            {"product_reference": "P203", "warehouse_id": "WH-WEST-02", "available_stock": 60, "reorder_level": 15, "last_updated": "2024-08-02"},
            {"product_reference": "P204", "warehouse_id": "WH-CENTRAL-03", "available_stock": 320, "reorder_level": 50, "last_updated": "2024-08-02"},
            {"product_reference": "P205", "warehouse_id": "WH-WEST-02", "available_stock": 95, "reorder_level": 25, "last_updated": "2024-08-03"},
            {"product_reference": "P206", "warehouse_id": "WH-EAST-01", "available_stock": 210, "reorder_level": 40, "last_updated": "2024-08-03"},
            {"product_reference": "P207", "warehouse_id": "WH-CENTRAL-03", "available_stock": 115, "reorder_level": 30, "last_updated": "2024-08-04"},
            {"product_reference": "P208", "warehouse_id": "WH-WEST-02", "available_stock": 180, "reorder_level": 40, "last_updated": "2024-08-04"},
            {"product_reference": "P209", "warehouse_id": "WH-EAST-01", "available_stock": 40, "reorder_level": 10, "last_updated": "2024-08-05"},
            {"product_reference": "P999", "warehouse_id": "WH-CENTRAL-03", "available_stock": 15, "reorder_level": 5, "last_updated": "2024-08-05"},
        ]
        inventory_path.write_text(json.dumps(inventory_data, indent=2), encoding="utf-8")

    # 15. Departments - departments.csv
    departments_path = samples_dir / "departments.csv"
    if not departments_path.exists():
        departments_df = pd.DataFrame([
            {"department_id": "D001", "department_name": "Engineering", "manager_id": "E001", "location": "New York", "annual_budget": 1200000},
            {"department_id": "D002", "department_name": "Marketing", "manager_id": "E002", "location": "Chicago", "annual_budget": 650000},
            {"department_id": "D003", "department_name": "HR", "manager_id": "E004", "location": "Austin", "annual_budget": 450000},
            {"department_id": "D004", "department_name": "Finance", "manager_id": "E005", "location": "San Francisco", "annual_budget": 850000},
            {"department_id": "D005", "department_name": "Operations", "manager_id": "E012", "location": "Boston", "annual_budget": 550000},
            {"department_id": "D006", "department_name": "Sales", "manager_id": "E011", "location": "Dallas", "annual_budget": 950000},
            {"department_id": "D007", "department_name": "Legal & Compliance", "manager_id": "E015", "location": "Washington DC", "annual_budget": 350000},
        ])
        departments_df.to_csv(departments_path, index=False)

    print("All 15 enterprise sample datasets successfully generated.")

if __name__ == "__main__":
    import sys
    target = Path(__file__).parent / "uploads" / "samples"
    generate_all_samples(target)
