path = 'ds_tester/frontend/DsTesterPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """        {activeMainTab === "brand_anomalies" ? ("""

replacement = """        {activeMainTab === "assigned_anomalies" ? (
          <Card
            sx={{
              borderRadius: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              p: 3,
              mb: 3,
            }}
          >
            {/* Header & Attribution Banner */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 3 }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <AssignmentIndIcon sx={{ color: "#0284c7", fontSize: 30 }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                    {currentClientObj.label} • Commercial Anomaly Assignment Registry
                  </Typography>
                  <Chip
                    label={`${assignedAnomalies.length} Assigned Issues`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: "12px",
                      bgcolor: assignedAnomalies.length > 0 ? "#e0f2fe" : "#f1f5f9",
                      color: assignedAnomalies.length > 0 ? "#0284c7" : "#64748b",
                      border: "1px solid #bae6fd",
                    }}
                  />
                  <Chip
                    label="P1 - Critical Priority"
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: "11px",
                      bgcolor: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                    }}
                  />
                </Box>
                <Typography sx={{ color: "#64748b", fontSize: "13px", mt: 0.5 }}>
                  Enterprise assignment ledger for <strong>{currentClientObj.label}</strong>. Tracks exactly which commercial anomaly was assigned to whom by whom, with verified ClickHouse OLAP metrics, allowed tolerance corridors, and human-readable audit timestamps.
                </Typography>

                {/* Audit Attribution Badges */}
                {assignedAnomalies.length > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mt: 1.5 }}>
                    <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", display: "flex", alignItems: "center", gap: 0.8 }}>
                      <Typography sx={{ fontSize: "11px", color: "#0369a1", fontWeight: 700 }}>ASSIGNED TO:</Typography>
                      <Typography sx={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>
                        {assignedAnomalies[0].assigned_to || "abhishek.j@trailytics.com"}
                      </Typography>
                    </Box>
                    <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", gap: 0.8 }}>
                      <Typography sx={{ fontSize: "11px", color: "#475569", fontWeight: 700 }}>ASSIGNED BY:</Typography>
                      <Typography sx={{ fontSize: "12px", color: "#0f172a", fontWeight: 800 }}>
                        {assignedAnomalies[0].assigned_by || "shushant@trailytics.com"}
                      </Typography>
                    </Box>
                    <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 0.8 }}>
                      <Typography sx={{ fontSize: "11px", color: "#92400e", fontWeight: 700 }}>ASSIGNMENT DATE:</Typography>
                      <Typography sx={{ fontSize: "12px", color: "#92400e", fontWeight: 800 }}>
                        📅 {assignedAnomalies[0].assigned_at || "23 Nov 2026, 03:36 PM"}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCopyAssignedReport}
                  startIcon={<ContentCopyIcon />}
                  sx={{
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "12px",
                    textTransform: "none",
                    color: "#334155",
                    borderColor: "#cbd5e1",
                    px: 2,
                    "&:hover": { bgcolor: "#f8fafc", borderColor: "#94a3b8" },
                  }}
                >
                  {assignedCopied ? "Copied Formatted Report!" : "Copy Formatted Report"}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    setEmailModalConfig({
                      open: true,
                      client: selectedClient,
                      selectedAnomaly: null,
                      anomalies: assignedAnomalies,
                    });
                  }}
                  startIcon={<EmailIcon />}
                  sx={{
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "12px",
                    textTransform: "none",
                    bgcolor: "#0078d4",
                    color: "#ffffff",
                    px: 2.2,
                    boxShadow: "0 2px 6px rgba(0,120,212,0.3)",
                    "&:hover": { bgcolor: "#005a9e" },
                  }}
                >
                  Forward via Outlook Web
                </Button>
              </Box>
            </Box>

            {/* Filter & Search Toolbar */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2.5, p: 1.5, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <TextField
                size="small"
                placeholder="Search assigned anomalies by metric, module, platform..."
                value={assignedSearchQuery}
                onChange={(e) => setAssignedSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: "#94a3b8", fontSize: 20, mr: 1 }} />,
                }}
                sx={{
                  minWidth: 320,
                  flex: 1,
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "#ffffff",
                    borderRadius: "8px",
                    fontSize: "13px",
                  },
                }}
              />

              <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", alignItems: "center" }}>
                <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#64748b", mr: 0.5 }}>
                  Filter Module:
                </Typography>
                {["all", ...Array.from(new Set(assignedAnomalies.map((a) => (a.module || "").toLowerCase())))].map((mod) => (
                  <Chip
                    key={mod}
                    label={mod === "all" ? `All (${assignedAnomalies.length})` : mod.replace(/_/g, " ").replace(/\\b\\w/g, (l) => l.toUpperCase())}
                    onClick={() => setAssignedModuleFilter(mod)}
                    size="small"
                    sx={{
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: assignedModuleFilter === mod ? 800 : 600,
                      bgcolor: assignedModuleFilter === mod ? "#0284c7" : "#ffffff",
                      color: assignedModuleFilter === mod ? "#ffffff" : "#475569",
                      border: assignedModuleFilter === mod ? "1px solid #0284c7" : "1px solid #cbd5e1",
                      "&:hover": { bgcolor: assignedModuleFilter === mod ? "#0369a1" : "#f1f5f9" },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Assigned Anomalies Registry Table */}
            {filteredAssignedAnomalies.length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center", bgcolor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                <Typography sx={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>
                  No assigned anomalies found matching the current search or module filter.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left", backgroundColor: "#ffffff" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800, width: "36px", textAlign: "center" }}>#</th>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800 }}>Module</th>
                      <th style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 800 }}>Metric / Anomaly KPI Name</th>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Platform</th>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800, textAlign: "right" }}>Actual vs Baseline</th>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800, textAlign: "right" }}>Deviation</th>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800 }}>Assigned To</th>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800 }}>Assigned By</th>
                      <th style={{ padding: "10px 14px", color: "#1e293b", fontWeight: 800, whiteSpace: "nowrap" }}>Assigned Date & Time</th>
                      <th style={{ padding: "10px 10px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Priority</th>
                      <th style={{ padding: "10px 10px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Status</th>
                      <th style={{ padding: "10px 12px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignedAnomalies.map((anom, idx) => {
                      const dev = anom.deviation_pct !== undefined ? anom.deviation_pct : -100.0;
                      const devColor = Math.abs(dev) >= 25 ? "#dc2626" : Math.abs(dev) >= 10 ? "#ea580c" : "#16a34a";
                      const devBg = Math.abs(dev) >= 25 ? "#fee2e2" : Math.abs(dev) >= 10 ? "#ffedd5" : "#dcfce7";
                      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
                      return (
                        <tr
                          key={anom.id || idx}
                          style={{
                            backgroundColor: rowBg,
                            borderBottom: "1px solid #e2e8f0",
                            transition: "background-color 0.15s ease",
                          }}
                        >
                          <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#64748b" }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                backgroundColor: "#eff6ff",
                                color: "#1d4ed8",
                                fontWeight: 700,
                                fontSize: "11px",
                                border: "1px solid #bfdbfe",
                              }}
                            >
                              {anom.module || "General"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "13px" }}>
                              {anom.kpi_label || anom.kpi}
                            </div>
                            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                              ID: {anom.id}
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                backgroundColor: "#f1f5f9",
                                color: "#334155",
                                fontWeight: 600,
                                fontSize: "11px",
                              }}
                            >
                              {anom.platform || "All"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", color: "#334155" }}>
                            <strong>{anom.actual}{anom.unit || ""}</strong> / <span style={{ color: "#64748b" }}>{anom.baseline}{anom.unit || ""}</span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                backgroundColor: devBg,
                                color: devColor,
                                fontWeight: 800,
                                fontSize: "11px",
                                border: `1px solid ${devColor}33`,
                              }}
                            >
                              {dev > 0 ? "+" : ""}{dev}%
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ color: "#0369a1", fontWeight: 700, fontSize: "12px" }}>
                              {anom.assigned_to || "abhishek.j@trailytics.com"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569", fontWeight: 600, fontSize: "12px" }}>
                            {anom.assigned_by || "shushant@trailytics.com"}
                          </td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <span>📅</span> {anom.assigned_at || "23 Nov 2026, 03:36 PM"}
                            </div>
                          </td>
                          <td style={{ padding: "10px 10px", textAlign: "center" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                backgroundColor: "#fee2e2",
                                color: "#dc2626",
                                fontWeight: 800,
                                fontSize: "10px",
                              }}
                            >
                              {anom.priority || "P1"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 10px", textAlign: "center" }}>
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            )}
          </Card>
        ) : activeMainTab === "brand_anomalies" ? ("""

content_norm = content.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

assert target_norm in content_norm, 'target not found in DsTesterPage.jsx!'

content_norm = content_norm.replace(target_norm, replacement_norm, 1)

with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content_norm)

print('Successfully inserted Commercial Anomaly Assignment Registry table into DsTesterPage.jsx!')
