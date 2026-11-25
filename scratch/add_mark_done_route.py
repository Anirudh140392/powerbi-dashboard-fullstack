with open('ds_tester/backend/routes.py', 'r', encoding='utf-8') as f:
    code = f.read()

target = """@router.post("/anomaly/assign-email")
def assign_anomaly_email_endpoint(payload: EmailAssignRequest):"""

new_endpoint = """class MarkAnomalyDoneRequest(BaseModel):
    anomaly_id: Optional[str] = None
    anomaly_ids: Optional[List[str]] = None
    status: Optional[str] = "FIXED"
    fixed_by: Optional[str] = None
    notes: Optional[str] = None


@router.post("/anomaly/mark-done")
@router.post("/anomaly/resolve")
def mark_anomaly_done_endpoint(payload: MarkAnomalyDoneRequest):
    \"\"\"
    Marks an assigned anomaly as FIXED or moves it back to ASSIGNED.
    Persists resolution metadata into the persistent anomaly store.
    \"\"\"
    anomaly_sentinel.refresh_store()
    ids_to_update = set()
    if payload.anomaly_id:
        ids_to_update.add(payload.anomaly_id)
    if payload.anomaly_ids:
        ids_to_update.update(payload.anomaly_ids)

    if not ids_to_update:
        raise HTTPException(status_code=400, detail="No anomaly_id or anomaly_ids specified.")

    updated_count = 0
    now_ts = datetime.now().strftime("%d %b %Y, %I:%M %p")
    target_status = (payload.status or "FIXED").upper()

    with anomaly_sentinel._lock:
        for a in anomaly_sentinel.anomalies:
            if a.get("id") in ids_to_update:
                a["assignment_status"] = target_status
                a["status"] = target_status
                if target_status == "FIXED":
                    a["fixed_at"] = now_ts
                    a["fixed_by"] = payload.fixed_by or a.get("assigned_to") or "abhishek.j@trailytics.com"
                    if payload.notes:
                        a["resolution_notes"] = payload.notes
                else:
                    a["assignment_status"] = "ASSIGNED"
                    a["fixed_at"] = None
                    a["fixed_by"] = None
                updated_count += 1
        anomaly_sentinel._save_store()

    return {
        "success": True,
        "updated_count": updated_count,
        "status": target_status,
        "timestamp": now_ts
    }


@router.post("/anomaly/assign-email")
def assign_anomaly_email_endpoint(payload: EmailAssignRequest):"""

if target in code:
    code = code.replace(target, new_endpoint, 1)
    with open('ds_tester/backend/routes.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Added mark-done endpoint to routes.py successfully!")
else:
    print("Target not found in routes.py")
