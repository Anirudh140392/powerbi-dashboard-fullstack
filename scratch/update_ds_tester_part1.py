import re

path = 'ds_tester/frontend/DsTesterPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Icons to import
old_import = """  Rule as RuleIcon,
  VerifiedUser as VerifiedUserIcon,
  Email as EmailIcon,"""

new_import = """  Rule as RuleIcon,
  VerifiedUser as VerifiedUserIcon,
  Email as EmailIcon,
  AssignmentInd as AssignmentIndIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,"""

# 2. Add State
old_state = """  const [emailModalConfig, setEmailModalConfig] = useState({
    open: false,
    client: "prestige",
    selectedAnomaly: null,
    anomalies: [],
  });"""

new_state = """  const [emailModalConfig, setEmailModalConfig] = useState({
    open: false,
    client: "prestige",
    selectedAnomaly: null,
    anomalies: [],
  });
  const [assignedSearchQuery, setAssignedSearchQuery] = useState("");
  const [assignedModuleFilter, setAssignedModuleFilter] = useState("all");
  const [assignedCopied, setAssignedCopied] = useState(false);"""

# 3. Add assignedAnomalies and filteredAssignedAnomalies
old_filtered = """  // Filtered brand anomalies based on user's module switcher
  const filteredBrandAnomalies = useMemo(() => {
    let list = brandAnomalies;
    if (anomalyModuleFilter && anomalyModuleFilter !== "all") {
      list = list.filter((a) => (a.module || "").toLowerCase() === anomalyModuleFilter.toLowerCase());
    }
    if (anomalySeverityFilter && anomalySeverityFilter !== "all") {
      list = list.filter((a) => (a.severity || "").toUpperCase() === anomalySeverityFilter.toUpperCase());
    }
    return list;
  }, [brandAnomalies, anomalyModuleFilter, anomalySeverityFilter]);"""

new_filtered = """  // Filtered brand anomalies based on user's module switcher
  const filteredBrandAnomalies = useMemo(() => {
    let list = brandAnomalies;
    if (anomalyModuleFilter && anomalyModuleFilter !== "all") {
      list = list.filter((a) => (a.module || "").toLowerCase() === anomalyModuleFilter.toLowerCase());
    }
    if (anomalySeverityFilter && anomalySeverityFilter !== "all") {
      list = list.filter((a) => (a.severity || "").toUpperCase() === anomalySeverityFilter.toUpperCase());
    }
    return list;
  }, [brandAnomalies, anomalyModuleFilter, anomalySeverityFilter]);

  // Anomalies specifically assigned to testers/engineers
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
  }, [assignedAnomalies, assignedModuleFilter, assignedSearchQuery]);

  const handleCopyAssignedReport = async () => {
    try {
      const res = await axios.post(`${DS_TESTER_API}/anomaly/preview-email`, {
        client: selectedClient || "boat",
        recipients: ["abhishek.j@trailytics.com"],
        anomaly_ids: assignedAnomalies.map((a) => a.id).filter(Boolean),
        priority: "P1 - Critical",
        from_email: "shushant@trailytics.com",
      });
      if (res.data?.html) {
        if (navigator.clipboard && window.ClipboardItem) {
          const blobHtml = new Blob([res.data.html], { type: "text/html" });
          const blobText = new Blob([res.data.html], { type: "text/plain" });
          await navigator.clipboard.write([new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })]);
        } else {
          await navigator.clipboard.writeText(res.data.html);
        }
        setAssignedCopied(true);
        setTimeout(() => setAssignedCopied(false), 3500);
      }
    } catch (e) {
      console.error("Copy report error:", e);
    }
  };"""

# 4. Add 3rd Tab Button in Main Tab bar
old_tab_btn = """            <Button
              onClick={() => setActiveMainTab("brand_anomalies")}
              variant={activeMainTab === "brand_anomalies" ? "contained" : "text"}
              startIcon={<WarningAmberIcon />}
              sx={{
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "13px",
                bgcolor: activeMainTab === "brand_anomalies" ? "#dc2626" : "transparent",
                color: activeMainTab === "brand_anomalies" ? "#ffffff" : (brandAnomalies.length > 0 ? "#dc2626" : "#64748b"),
                "&:hover": {
                  bgcolor: activeMainTab === "brand_anomalies" ? "#b91c1c" : "#f1f5f9",
                  color: activeMainTab === "brand_anomalies" ? "#ffffff" : "#0f172a",
                },
                px: 2,
                py: 0.8,
              }}
            >
              🚨 Overall Brand Anomalies ({currentClientObj.label}: {brandAnomalies.length})
            </Button>"""

new_tab_btn = """            <Button
              onClick={() => setActiveMainTab("brand_anomalies")}
              variant={activeMainTab === "brand_anomalies" ? "contained" : "text"}
              startIcon={<WarningAmberIcon />}
              sx={{
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "13px",
                bgcolor: activeMainTab === "brand_anomalies" ? "#dc2626" : "transparent",
                color: activeMainTab === "brand_anomalies" ? "#ffffff" : (brandAnomalies.length > 0 ? "#dc2626" : "#64748b"),
                "&:hover": {
                  bgcolor: activeMainTab === "brand_anomalies" ? "#b91c1c" : "#f1f5f9",
                  color: activeMainTab === "brand_anomalies" ? "#ffffff" : "#0f172a",
                },
                px: 2,
                py: 0.8,
              }}
            >
              🚨 Overall Brand Anomalies ({currentClientObj.label}: {brandAnomalies.length})
            </Button>

            <Button
              onClick={() => setActiveMainTab("assigned_anomalies")}
              variant={activeMainTab === "assigned_anomalies" ? "contained" : "text"}
              startIcon={<AssignmentIndIcon />}
              sx={{
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "13px",
                bgcolor: activeMainTab === "assigned_anomalies" ? "#0284c7" : "transparent",
                color: activeMainTab === "assigned_anomalies" ? "#ffffff" : (assignedAnomalies.length > 0 ? "#0284c7" : "#64748b"),
                "&:hover": {
                  bgcolor: activeMainTab === "assigned_anomalies" ? "#0369a1" : "#f1f5f9",
                  color: activeMainTab === "assigned_anomalies" ? "#ffffff" : "#0f172a",
                },
                px: 2,
                py: 0.8,
              }}
            >
              📋 Assigned Anomalies Registry ({currentClientObj.label}: {assignedAnomalies.length})
            </Button>"""

# 5. Add Assigned counter in brand_anomalies header stats
old_stats = """                <Box sx={{ p: 1.5, px: 2, bgcolor: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>ZERO ANOMALY MODULES</Typography>
                  <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#16a34a" }}>
                    {Math.max(0, modules.length - Object.keys(moduleAnomalyCounts).length)}
                  </Typography>
                </Box>"""

new_stats = """                <Box sx={{ p: 1.5, px: 2, bgcolor: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>ZERO ANOMALY MODULES</Typography>
                  <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#16a34a" }}>
                    {Math.max(0, modules.length - Object.keys(moduleAnomalyCounts).length)}
                  </Typography>
                </Box>
                <Box
                  onClick={() => setActiveMainTab("assigned_anomalies")}
                  sx={{
                    p: 1.5,
                    px: 2,
                    bgcolor: "#f0f9ff",
                    borderRadius: "10px",
                    border: "1px solid #bae6fd",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "#0284c7", transform: "translateY(-1px)" },
                  }}
                >
                  <Typography sx={{ fontSize: "11px", color: "#0284c7", fontWeight: 700 }}>ASSIGNED TO TESTER</Typography>
                  <Typography sx={{ fontSize: "18px", fontWeight: 800, color: "#0284c7" }}>
                    {assignedAnomalies.length} Issues
                  </Typography>
                </Box>"""

# 6. Add Module Switcher Pill
old_pill = """                <Button
                  size="small"
                  variant={anomalyModuleFilter === "all" ? "contained" : "outlined"}
                  onClick={() => setAnomalyModuleFilter("all")}
                  sx={{
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: anomalyModuleFilter === "all" ? 800 : 600,
                    textTransform: "none",
                    bgcolor: anomalyModuleFilter === "all" ? "#2563eb" : "#ffffff",
                    color: anomalyModuleFilter === "all" ? "#ffffff" : "#334155",
                    borderColor: anomalyModuleFilter === "all" ? "#2563eb" : "#cbd5e1",
                    "&:hover": {
                      bgcolor: anomalyModuleFilter === "all" ? "#1d4ed8" : "#f1f5f9",
                    },
                    px: 1.8,
                  }}
                >
                  🌐 All Tested Modules ({brandAnomalies.length})
                </Button>"""

new_pill = """                <Button
                  size="small"
                  variant={anomalyModuleFilter === "all" ? "contained" : "outlined"}
                  onClick={() => setAnomalyModuleFilter("all")}
                  sx={{
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: anomalyModuleFilter === "all" ? 800 : 600,
                    textTransform: "none",
                    bgcolor: anomalyModuleFilter === "all" ? "#2563eb" : "#ffffff",
                    color: anomalyModuleFilter === "all" ? "#ffffff" : "#334155",
                    borderColor: anomalyModuleFilter === "all" ? "#2563eb" : "#cbd5e1",
                    "&:hover": {
                      bgcolor: anomalyModuleFilter === "all" ? "#1d4ed8" : "#f1f5f9",
                    },
                    px: 1.8,
                  }}
                >
                  🌐 All Tested Modules ({brandAnomalies.length})
                </Button>

                <Button
                  size="small"
                  variant={anomalyModuleFilter === "assigned" ? "contained" : "outlined"}
                  onClick={() => {
                    setAnomalyModuleFilter("assigned");
                    setActiveMainTab("assigned_anomalies");
                  }}
                  sx={{
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 800,
                    textTransform: "none",
                    bgcolor: anomalyModuleFilter === "assigned" ? "#0284c7" : "#f0f9ff",
                    color: anomalyModuleFilter === "assigned" ? "#ffffff" : "#0284c7",
                    borderColor: anomalyModuleFilter === "assigned" ? "#0284c7" : "#bae6fd",
                    "&:hover": {
                      bgcolor: anomalyModuleFilter === "assigned" ? "#0369a1" : "#e0f2fe",
                    },
                    px: 1.8,
                  }}
                >
                  📋 Assigned to Tester ({assignedAnomalies.length})
                </Button>"""

# 7. Add onAssigned prop to AssignAnomalyEmailModal call
old_modal_call = """        {/* Assign Anomaly Outlook Email Modal */}
        <AssignAnomalyEmailModal
          open={emailModalConfig.open}
          onClose={() => setEmailModalConfig((prev) => ({ ...prev, open: false }))}
          client={emailModalConfig.client || selectedClient}
          selectedAnomaly={emailModalConfig.selectedAnomaly}
          anomalies={emailModalConfig.anomalies.length > 0 ? emailModalConfig.anomalies : brandAnomalies}
        />"""

new_modal_call = """        {/* Assign Anomaly Outlook Email Modal */}
        <AssignAnomalyEmailModal
          open={emailModalConfig.open}
          onClose={() => setEmailModalConfig((prev) => ({ ...prev, open: false }))}
          client={emailModalConfig.client || selectedClient}
          selectedAnomaly={emailModalConfig.selectedAnomaly}
          anomalies={emailModalConfig.anomalies.length > 0 ? emailModalConfig.anomalies : brandAnomalies}
          onAssigned={fetchSentinelAnomalies}
        />"""

content_norm = content.replace('\r\n', '\n')
for name, old_b, new_b in [
    ('import', old_import, new_import),
    ('state', old_state, new_state),
    ('filtered', old_filtered, new_filtered),
    ('tab_btn', old_tab_btn, new_tab_btn),
    ('stats', old_stats, new_stats),
    ('pill', old_pill, new_pill),
    ('modal_call', old_modal_call, new_modal_call),
]:
    old_b_norm = old_b.replace('\r\n', '\n')
    new_b_norm = new_b.replace('\r\n', '\n')
    assert old_b_norm in content_norm, f'Block {name} not found!'
    content_norm = content_norm.replace(old_b_norm, new_b_norm, 1)

with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content_norm)

print('Part 1 of DsTesterPage.jsx updated successfully!')
