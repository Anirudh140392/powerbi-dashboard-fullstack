with open('ds_tester/backend/anomaly_engine.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update imports
old_imp = "from .step3_selenium import create_chrome_driver"
new_imp = "from .step3_selenium import create_chrome_driver, is_driver_alive, safe_quit_driver"
if old_imp in code:
    code = code.replace(old_imp, new_imp, 1)

# 2. Update clear_anomalies
old_clear = """    def clear_anomalies(self, client=None):
        \"\"\"Clears stored anomalies for a client or all clients.\"\"\"
        with self._lock:
            if client and client.lower() != "all":
                self.anomalies = [a for a in self.anomalies if str(a.get("client", "")).lower() != client.lower()]
            else:
                self.anomalies = []
            self.verified_runs_count = 0
            self._save_store()"""

new_clear = """    def clear_anomalies(self, client=None):
        \"\"\"Clears unassigned stored anomalies for a client or all clients, preserving assigned registry.\"\"\"
        with self._lock:
            if client and client.lower() != "all":
                self.anomalies = [a for a in self.anomalies if not (
                    str(a.get("client", "")).lower() == client.lower() and
                    a.get("assignment_status") != "ASSIGNED" and
                    not a.get("assigned_to")
                )]
            else:
                self.anomalies = [a for a in self.anomalies if a.get("assignment_status") == "ASSIGNED" or a.get("assigned_to")]
            self._save_store()"""

if old_clear in code:
    code = code.replace(old_clear, new_clear, 1)
    print("Updated clear_anomalies successfully!")
else:
    print("Could not find old_clear")

# 3. Increase max saved anomalies from 200 to 500
code = code.replace('"anomalies": self.anomalies[:200]', '"anomalies": self.anomalies[:500]')

# 4. Update evaluate_verified_run pruning
old_eval_prune = """        with self._lock:
            # 1. Prune existing anomalies for this specific client + module + segment scope so runs update dynamically
            self.anomalies = [
                a for a in self.anomalies
                if not (
                    str(a.get("client", "")).lower() == client.lower() and
                    str(a.get("module", "")).lower() == module_name.lower() and
                    str(a.get("segment", "")).lower() == segment_name.lower()
                )
            ]
            # 2. Add newly detected anomalies for this run
            if new_anomalies:
                self.anomalies = new_anomalies + self.anomalies
                logger.info(f"Stage 2 Sentinel: Detected {len(new_anomalies)} commercial anomalies from verified run {run_id}.")
            else:
                logger.info(f"Stage 2 Sentinel: No anomalies in verified run {run_id}. Prior anomalies for {client}:{module_name}:{segment_name} resolved.")

            self.verified_runs_count += 1
            self._save_store()"""

new_eval_prune = """        with self._lock:
            # 1. Prune existing unassigned anomalies for this specific client + module + segment scope so runs update dynamically
            self.anomalies = [
                a for a in self.anomalies
                if not (
                    str(a.get("client", "")).lower() == client.lower() and
                    str(a.get("module", "")).lower() == module_name.lower() and
                    str(a.get("segment", "")).lower() == segment_name.lower() and
                    a.get("assignment_status") != "ASSIGNED" and
                    not a.get("assigned_to")
                )
            ]
            # 2. Add newly detected anomalies for this run, preserving assignment metadata if already assigned
            if new_anomalies:
                for anom in new_anomalies:
                    existing = next((a for a in self.anomalies if (
                        str(a.get("client", "")).lower() == client.lower() and
                        str(a.get("kpi", "")).lower() == anom["kpi"].lower() and
                        (a.get("assignment_status") == "ASSIGNED" or a.get("assigned_to"))
                    )), None)
                    if existing:
                        anom["assigned_to"] = existing.get("assigned_to")
                        anom["assigned_by"] = existing.get("assigned_by")
                        anom["assigned_at"] = existing.get("assigned_at")
                        anom["priority"] = existing.get("priority")
                        anom["assignment_status"] = existing.get("assignment_status")
                        anom["notes"] = existing.get("notes")

                self.anomalies = new_anomalies + self.anomalies
                logger.info(f"Stage 2 Sentinel: Detected {len(new_anomalies)} commercial anomalies from verified run {run_id}.")
            else:
                logger.info(f"Stage 2 Sentinel: No anomalies in verified run {run_id}. Prior unassigned anomalies for {client}:{module_name}:{segment_name} resolved.")

            self.verified_runs_count += 1
            self._save_store()"""

if old_eval_prune in code:
    code = code.replace(old_eval_prune, new_eval_prune, 1)
    print("Updated evaluate_verified_run successfully!")
else:
    print("Could not find old_eval_prune")

# 5. Update record_failed_run
old_failed_save = """        with self._lock:
            for anom in created_anomalies:
                self.anomalies = [a for a in self.anomalies if not (
                    str(a.get("client", "")).lower() == client.lower() and
                    str(a.get("kpi", "")).lower() == anom["kpi"].lower()
                )]
                self.anomalies.insert(0, anom)
            self._save_store()"""

new_failed_save = """        with self._lock:
            for anom in created_anomalies:
                existing = next((a for a in self.anomalies if (
                    str(a.get("client", "")).lower() == client.lower() and
                    str(a.get("kpi", "")).lower() == anom["kpi"].lower() and
                    (a.get("assignment_status") == "ASSIGNED" or a.get("assigned_to"))
                )), None)
                if existing:
                    anom["assigned_to"] = existing.get("assigned_to")
                    anom["assigned_by"] = existing.get("assigned_by")
                    anom["assigned_at"] = existing.get("assigned_at")
                    anom["priority"] = existing.get("priority")
                    anom["assignment_status"] = existing.get("assignment_status")
                    anom["notes"] = existing.get("notes")

                self.anomalies = [a for a in self.anomalies if not (
                    str(a.get("client", "")).lower() == client.lower() and
                    str(a.get("kpi", "")).lower() == anom["kpi"].lower() and
                    a.get("assignment_status") != "ASSIGNED" and
                    not a.get("assigned_to")
                )]
                self.anomalies.insert(0, anom)
            self._save_store()"""

if old_failed_save in code:
    code = code.replace(old_failed_save, new_failed_save, 1)
    print("Updated record_failed_run successfully!")
else:
    print("Could not find old_failed_save")

# 6. Remove client wiping in run_chained_pipeline
old_wipe = """        pipeline_start = datetime.now()
        with self._lock:
            # Clear previous anomalies for the target clients being scanned in this session so results reflect this run only
            client_set = {c.lower().strip() for c in target_clients}
            self.anomalies = [a for a in self.anomalies if str(a.get("client", "")).lower() not in client_set]
            self._save_store()
        total_verified = 0"""

new_wipe = """        pipeline_start = datetime.now()
        # Preserve all existing anomalies & assigned registry; newly detected anomalies merge dynamically
        total_verified = 0"""

if old_wipe in code:
    code = code.replace(old_wipe, new_wipe, 1)
    print("Removed destructive client wiping in run_chained_pipeline successfully!")
else:
    print("Could not find old_wipe")

# 7. Update run_chained_pipeline execution loop for driver liveness & recreation sync
old_exec = """                try:
                    # STAGE 1: Execute DS Tester (Step 1 API + Step 2 Logic + Step 3 Live UI)
                    runner._execute_single_run(
                        run=run_record,
                        module=mod,
                        segment=seg_name,
                        period=period,
                        client=client,
                        headless=headless,
                        existing_driver=driver,
                        prefix_step=f"[{t_idx + 1}/{total_tasks}] [{client_label}]",
                    )"""

new_exec = """                # Ensure shared Chrome driver is alive and responding
                if driver is None or not is_driver_alive(driver):
                    safe_quit_driver(driver)
                    driver = create_chrome_driver(headless=headless)
                    runner._active_driver = driver
                    self._active_driver = driver

                try:
                    # STAGE 1: Execute DS Tester (Step 1 API + Step 2 Logic + Step 3 Live UI)
                    runner._execute_single_run(
                        run=run_record,
                        module=mod,
                        segment=seg_name,
                        period=period,
                        client=client,
                        headless=headless,
                        existing_driver=driver,
                        prefix_step=f"[{t_idx + 1}/{total_tasks}] [{client_label}]",
                    )
                    driver = runner._active_driver"""

if old_exec in code:
    code = code.replace(old_exec, new_exec, 1)
    print("Updated execution loop in run_chained_pipeline successfully!")
else:
    print("Could not find old_exec")

with open('ds_tester/backend/anomaly_engine.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Saved anomaly_engine.py successfully!")
