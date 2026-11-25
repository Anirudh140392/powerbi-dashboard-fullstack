with open('ds_tester/frontend/DsTesterPage.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add icons if needed
if "Replay as ReplayIcon" not in code:
    code = code.replace(
        '  CheckCircle as CheckCircleIcon,',
        '  CheckCircle as CheckCircleIcon,\n  Check as CheckIcon,\n  Replay as ReplayIcon,'
    )

# 2. Update auto-module switching in startSentinelPolling
old_sentinel_module = """          // Preserved user selectedClient and selectedModule from manual UI choice
          // Do NOT auto-switch selectedModule to r.module so user can freely inspect other modules while test runs in background
          if (!selectedModule && r.module) {
            setSelectedModule(r.module);
          }"""

new_sentinel_module = """          // Auto-switch selectedModule to follow the active test when Selenium is working
          if (r.module && (r.status === "running" || r.overall === "RUNNING")) {
            setSelectedModule(r.module);
          }"""

if old_sentinel_module in code:
    code = code.replace(old_sentinel_module, new_sentinel_module, 1)
    print("Updated startSentinelPolling auto module switch successfully!")
else:
    print("old_sentinel_module not found")

old_batch_active_module = """        if (isBatchMode && batchQueue.length > 0) {
          if (!selectedModule && statusData?.active_module) {
            setSelectedModule(statusData.active_module);
          }
        }"""

new_batch_active_module = """        if ((isBatchMode && batchQueue.length > 0) || statusData?.is_pipeline_active || statusData?.running) {
          if (statusData?.active_module) {
            setSelectedModule(statusData.active_module);
          }
        }"""

if old_batch_active_module in code:
    code = code.replace(old_batch_active_module, new_batch_active_module, 1)
    print("Updated batch active module switch successfully!")
else:
    print("old_batch_active_module not found")

# 3. Update auto-module switching in pollingTimerRef
old_polling_module = """        const runData = activeRes?.data;
        if (runData) {
          setActiveRunData(runData);
          if (drawerRunData && drawerRunData.run_id === activeRunId) {
            setDrawerRunData(runData);
          }
        }"""

new_polling_module = """        const runData = activeRes?.data;
        if (runData) {
          setActiveRunData(runData);
          if (drawerRunData && drawerRunData.run_id === activeRunId) {
            setDrawerRunData(runData);
          }
          // Auto-switch selectedModule to follow the active test when Selenium is working
          if (runData.module && (runData.status === "running" || runData.overall === "RUNNING")) {
            setSelectedModule(runData.module);
          }
        }"""

if old_polling_module in code:
    code = code.replace(old_polling_module, new_polling_module, 1)
    print("Updated pollingTimerRef auto module switch successfully!")
else:
    print("old_polling_module not found")

# 4. Update assigned anomalies lists, state, and handler
old_assigned_memo = """  // Anomalies specifically assigned to testers/engineers
  const assignedAnomalies = useMemo(() => {
    return brandAnomalies.filter(
      (a) => a.assignment_status === "ASSIGNED" || a.assigned_to
    );
  }, [brandAnomalies]);

  // Filtered assigned anomalies for the Assignment Registry table
  const filteredAssignedAnomalies = useMemo(() => {
    let list = assignedAnomalies;
    if (assignedModuleFilter && assignedModuleFilter !== "all") {
      list = list.filter((a) => (a.module || "").toLowerCase() === assignedModuleFilter.toLowerCase());
    }
    if (assignedSearchQuery) {
      const q = assignedSearchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          (a.kpi_label || "").toLowerCase().includes(q) ||
          (a.kpi || "").toLowerCase().includes(q) ||
          (a.module || "").toLowerCase().includes(q) ||
          (a.platform || "").toLowerCase().includes(q) ||
          (a.assigned_to || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [assignedAnomalies, assignedModuleFilter, assignedSearchQuery]);"""

new_assigned_memo = """  // All assigned issues (active + fixed)
  const allAssignedAnomalies = useMemo(() => {
    return brandAnomalies.filter(
      (a) => a.assignment_status === "ASSIGNED" || a.assignment_status === "FIXED" || a.assigned_to
    );
  }, [brandAnomalies]);

  // Active / pending assigned issues (awaiting fix)
  const activeAssignedAnomalies = useMemo(() => {
    return allAssignedAnomalies.filter((a) => a.assignment_status !== "FIXED" && a.status !== "FIXED");
  }, [allAssignedAnomalies]);

  // Fixed / resolved anomalies
  const fixedAnomalies = useMemo(() => {
    return allAssignedAnomalies.filter((a) => a.assignment_status === "FIXED" || a.status === "FIXED");
  }, [allAssignedAnomalies]);

  // Alias for backward compatibility
  const assignedAnomalies = activeAssignedAnomalies;

  // Sub-tab view state inside Assigned Anomalies Registry: "active" (Pending) | "fixed" (Fixed) | "all"
  const [assignedStatusTab, setAssignedStatusTab] = useState("active");
  const [markingDoneId, setMarkingDoneId] = useState(null);

  const handleMarkAnomalyDone = async (anom, targetStatus = "FIXED") => {
    setMarkingDoneId(anom.id);
    try {
      await axios.post(`${DS_TESTER_API}/anomaly/mark-done`, {
        anomaly_id: anom.id,
        status: targetStatus,
        fixed_by: anom.assigned_to || "abhishek.j@trailytics.com",
        notes: targetStatus === "FIXED" ? "Verified and resolved consistency" : "Reopened for review"
      });
      await fetchSentinelAnomalies();
    } catch (err) {
      console.error("[DsTester] Failed to update anomaly status:", err);
    } finally {
      setMarkingDoneId(null);
    }
  };

  // Filtered assigned anomalies for the Assignment Registry table
  const filteredAssignedAnomalies = useMemo(() => {
    let list = assignedStatusTab === "fixed"
      ? fixedAnomalies
      : assignedStatusTab === "all"
      ? allAssignedAnomalies
      : activeAssignedAnomalies;

    if (assignedModuleFilter && assignedModuleFilter !== "all") {
      list = list.filter((a) => (a.module || "").toLowerCase() === assignedModuleFilter.toLowerCase());
    }
    if (assignedSearchQuery) {
      const q = assignedSearchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          (a.kpi_label || "").toLowerCase().includes(q) ||
          (a.kpi || "").toLowerCase().includes(q) ||
          (a.module || "").toLowerCase().includes(q) ||
          (a.platform || "").toLowerCase().includes(q) ||
          (a.assigned_to || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [assignedStatusTab, activeAssignedAnomalies, fixedAnomalies, allAssignedAnomalies, assignedModuleFilter, assignedSearchQuery]);"""

if old_assigned_memo in code:
    code = code.replace(old_assigned_memo, new_assigned_memo, 1)
    print("Updated assigned anomalies memo & handler successfully!")
else:
    print("old_assigned_memo not found")

# 5. Update main tab button label
old_tab_label = "📋 Assigned Anomalies Registry ({currentClientObj.label}: {assignedAnomalies.length})"
new_tab_label = "📋 Assigned Anomalies Registry ({currentClientObj.label}: {activeAssignedAnomalies.length} Pending{fixedAnomalies.length > 0 ? ` • ${fixedAnomalies.length} Fixed` : ''})"
if old_tab_label in code:
    code = code.replace(old_tab_label, new_tab_label, 1)
    print("Updated main tab button label successfully!")
else:
    print("old_tab_label not found")

# 6. Update Registry Header Chips & Toolbar
old_chips = """                  <Chip
                    label={`${assignedAnomalies.length} Assigned Issues`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: "12px",
                      bgcolor: assignedAnomalies.length > 0 ? "#e0f2fe" : "#f1f5f9",
                      color: assignedAnomalies.length > 0 ? "#0284c7" : "#64748b",
                      border: "1px solid #bae6fd",
                    }}
                  />"""

new_chips = """                  <Chip
                    label={`${activeAssignedAnomalies.length} Pending Issues`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: "12px",
                      bgcolor: activeAssignedAnomalies.length > 0 ? "#e0f2fe" : "#f1f5f9",
                      color: activeAssignedAnomalies.length > 0 ? "#0284c7" : "#64748b",
                      border: "1px solid #bae6fd",
                    }}
                  />
                  {fixedAnomalies.length > 0 && (
                    <Chip
                      label={`${fixedAnomalies.length} Fixed`}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        fontSize: "12px",
                        bgcolor: "#dcfce7",
                        color: "#15803d",
                        border: "1px solid #86efac",
                      }}
                    />
                  )}"""

if old_chips in code:
    code = code.replace(old_chips, new_chips, 1)
    print("Updated Registry Header Chips successfully!")
else:
    print("old_chips not found")

# 7. Add Status Sub-tabs to the Filter Toolbar
old_toolbar = """            {/* Filter & Search Toolbar */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2.5, p: 1.5, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <TextField"""

new_toolbar = """            {/* Status View Selector & Filter Toolbar */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2.5, p: 1.5, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              {/* Sub-Tabs: Pending Fix vs Fixed Anomalies vs All */}
              <Box sx={{ display: "flex", gap: 0.8, alignItems: "center", bgcolor: "#e2e8f0", p: 0.4, borderRadius: "10px" }}>
                <Button
                  size="small"
                  onClick={() => setAssignedStatusTab("active")}
                  sx={{
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "8px",
                    textTransform: "none",
                    px: 1.5,
                    py: 0.4,
                    bgcolor: assignedStatusTab === "active" ? "#ffffff" : "transparent",
                    color: assignedStatusTab === "active" ? "#0284c7" : "#475569",
                    boxShadow: assignedStatusTab === "active" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    "&:hover": { bgcolor: assignedStatusTab === "active" ? "#ffffff" : "#f1f5f9" }
                  }}
                >
                  Pending Fix ({activeAssignedAnomalies.length})
                </Button>
                <Button
                  size="small"
                  onClick={() => setAssignedStatusTab("fixed")}
                  sx={{
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "8px",
                    textTransform: "none",
                    px: 1.5,
                    py: 0.4,
                    bgcolor: assignedStatusTab === "fixed" ? "#16a34a" : "transparent",
                    color: assignedStatusTab === "fixed" ? "#ffffff" : "#475569",
                    boxShadow: assignedStatusTab === "fixed" ? "0 1px 3px rgba(22,163,74,0.3)" : "none",
                    "&:hover": { bgcolor: assignedStatusTab === "fixed" ? "#15803d" : "#f1f5f9" }
                  }}
                >
                  Fixed Anomalies ({fixedAnomalies.length})
                </Button>
                <Button
                  size="small"
                  onClick={() => setAssignedStatusTab("all")}
                  sx={{
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "8px",
                    textTransform: "none",
                    px: 1.2,
                    py: 0.4,
                    bgcolor: assignedStatusTab === "all" ? "#ffffff" : "transparent",
                    color: assignedStatusTab === "all" ? "#0f172a" : "#475569",
                    boxShadow: assignedStatusTab === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    "&:hover": { bgcolor: assignedStatusTab === "all" ? "#ffffff" : "#f1f5f9" }
                  }}
                >
                  All ({allAssignedAnomalies.length})
                </Button>
              </Box>

              <TextField"""

if old_toolbar in code:
    code = code.replace(old_toolbar, new_toolbar, 1)
    print("Updated Status View Selector in Toolbar successfully!")
else:
    print("old_toolbar not found")

# 8. Update Table Rows for Status Badge & Mark Done Button
old_row_status_actions = """                          <td style={{ padding: "10px 10px", textAlign: "center" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "12px",
                                backgroundColor: "#dcfce7",
                                color: "#15803d",
                                fontWeight: 800,
                                fontSize: "11px",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              ASSIGNED
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <Box sx={{ display: "flex", gap: 0.8, justifyContent: "center" }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setSelectedKpiForChart({
                                    kpiKey: anom.kpi,
                                    kpiLabel: anom.kpi_label || anom.kpi,
                                    module: anom.module,
                                    segment: anom.segment,
                                    client: anom.client || selectedClient,
                                    platform: anom.platform,
                                    metric: anom.metric,
                                    api: anom.step1_api_val,
                                    logic: anom.step2_logic_val,
                                    ui: anom.step3_ui_val,
                                    actual: anom.actual,
                                    baseline: anom.baseline,
                                    deviation_pct: anom.deviation_pct,
                                    severity: anom.severity,
                                    threshold_pct: anom.threshold_pct,
                                    unit: anom.unit || "%",
                                    rca: anom.rca,
                                    anomalyObj: anom,
                                  });
                                  setChartDrawerOpen(true);
                                }}
                                sx={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "none",
                                  p: "3px 8px",
                                  minWidth: "auto",
                                  borderColor: "#cbd5e1",
                                  color: "#1d4ed8",
                                }}
                              >
                                Drill-Down
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  setEmailModalConfig({
                                    open: true,
                                    client: anom.client || selectedClient,
                                    selectedAnomaly: anom,
                                    anomalies: [anom],
                                  });
                                }}
                                sx={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "none",
                                  p: "3px 8px",
                                  minWidth: "auto",
                                  bgcolor: "#0078d4",
                                  color: "#ffffff",
                                  "&:hover": { bgcolor: "#005a9e" },
                                }}
                              >
                                Email
                              </Button>
                            </Box>
                          </td>"""

new_row_status_actions = """                          <td style={{ padding: "10px 10px", textAlign: "center" }}>
                            {anom.assignment_status === "FIXED" || anom.status === "FIXED" ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "12px",
                                  backgroundColor: "#dcfce7",
                                  color: "#15803d",
                                  fontWeight: 800,
                                  fontSize: "11px",
                                  border: "1px solid #86efac",
                                }}
                              >
                                ✓ FIXED
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "12px",
                                  backgroundColor: "#e0f2fe",
                                  color: "#0369a1",
                                  fontWeight: 800,
                                  fontSize: "11px",
                                  border: "1px solid #bae6fd",
                                }}
                              >
                                ASSIGNED
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <Box sx={{ display: "flex", gap: 0.8, justifyContent: "center", alignItems: "center" }}>
                              {anom.assignment_status === "FIXED" || anom.status === "FIXED" ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={markingDoneId === anom.id}
                                  onClick={() => handleMarkAnomalyDone(anom, "ASSIGNED")}
                                  startIcon={<ReplayIcon sx={{ fontSize: "13px !important" }} />}
                                  sx={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    textTransform: "none",
                                    p: "2px 8px",
                                    minWidth: "auto",
                                    borderColor: "#cbd5e1",
                                    color: "#64748b",
                                    "&:hover": { borderColor: "#94a3b8", color: "#334155" },
                                  }}
                                >
                                  {markingDoneId === anom.id ? "Saving..." : "Reopen"}
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={markingDoneId === anom.id}
                                  onClick={() => handleMarkAnomalyDone(anom, "FIXED")}
                                  startIcon={<CheckCircleIcon sx={{ fontSize: "13px !important" }} />}
                                  sx={{
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    textTransform: "none",
                                    p: "2px 9px",
                                    minWidth: "auto",
                                    bgcolor: "#16a34a",
                                    color: "#ffffff",
                                    boxShadow: "0 2px 5px rgba(22, 163, 74, 0.3)",
                                    "&:hover": { bgcolor: "#15803d" },
                                  }}
                                >
                                  {markingDoneId === anom.id ? "Saving..." : "Mark Done"}
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setSelectedKpiForChart({
                                    kpiKey: anom.kpi,
                                    kpiLabel: anom.kpi_label || anom.kpi,
                                    module: anom.module,
                                    segment: anom.segment,
                                    client: anom.client || selectedClient,
                                    platform: anom.platform,
                                    metric: anom.metric,
                                    api: anom.step1_api_val,
                                    logic: anom.step2_logic_val,
                                    ui: anom.step3_ui_val,
                                    actual: anom.actual,
                                    baseline: anom.baseline,
                                    deviation_pct: anom.deviation_pct,
                                    severity: anom.severity,
                                    threshold_pct: anom.threshold_pct,
                                    unit: anom.unit || "%",
                                    rca: anom.rca,
                                    anomalyObj: anom,
                                  });
                                  setChartDrawerOpen(true);
                                }}
                                sx={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "none",
                                  p: "2px 8px",
                                  minWidth: "auto",
                                  borderColor: "#cbd5e1",
                                  color: "#1d4ed8",
                                }}
                              >
                                Drill-Down
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  setEmailModalConfig({
                                    open: true,
                                    client: anom.client || selectedClient,
                                    selectedAnomaly: anom,
                                    anomalies: [anom],
                                  });
                                }}
                                sx={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "none",
                                  p: "2px 8px",
                                  minWidth: "auto",
                                  bgcolor: "#0078d4",
                                  color: "#ffffff",
                                  "&:hover": { bgcolor: "#005a9e" },
                                }}
                              >
                                Email
                              </Button>
                            </Box>
                          </td>"""

if old_row_status_actions in code:
    code = code.replace(old_row_status_actions, new_row_status_actions, 1)
    print("Updated Table Rows with Mark Done & Reopen buttons successfully!")
else:
    print("old_row_status_actions not found")

with open('ds_tester/frontend/DsTesterPage.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved DsTesterPage.jsx successfully!")
