with open('ds_tester/frontend/DsTesterPage.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_thead = """                  <thead>
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
                  </thead>"""

new_thead = """                  <thead>
                    <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, width: "30px", textAlign: "center" }}>#</th>
                      <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800 }}>Module</th>
                      <th style={{ padding: "8px 10px", color: "#1e293b", fontWeight: 800 }}>Metric / Anomaly KPI Name</th>
                      <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Platform</th>
                      <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800, textAlign: "right" }}>Actual vs Base</th>
                      <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "right" }}>Dev</th>
                      <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800 }}>Assigned To</th>
                      <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800 }}>Assigned By</th>
                      <th style={{ padding: "8px 8px", color: "#1e293b", fontWeight: 800, whiteSpace: "nowrap" }}>Date & Time</th>
                      <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Priority</th>
                      <th style={{ padding: "8px 6px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Status</th>
                      <th style={{ padding: "8px 10px", color: "#1e293b", fontWeight: 800, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>"""

if old_thead in code:
    code = code.replace(old_thead, new_thead, 1)
    print("Replaced thead successfully!")
else:
    print("old_thead not found")

with open('ds_tester/frontend/DsTesterPage.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved DsTesterPage.jsx successfully!")
