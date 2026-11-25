with open('ds_tester/frontend/DsTesterPage.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

target = """  const [selectedClient, setSelectedClient] = useState(() => {
    try {
      const activeWs = sessionStorage.getItem("activeWorkspaceDb") || localStorage.getItem("activeWorkspaceDb");
      if (activeWs && activeWs.trim()) return activeWs.trim().toLowerCase();
    } catch (e) {}
    return "prestige";
  });"""

replacement = """  const [selectedClient, setSelectedClient] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const clientParam = urlParams.get("client");
      if (clientParam && clientParam.trim()) return clientParam.trim().toLowerCase();
      const activeWs = sessionStorage.getItem("activeWorkspaceDb") || localStorage.getItem("activeWorkspaceDb");
      if (activeWs && activeWs.trim()) return activeWs.trim().toLowerCase();
      const userRaw = sessionStorage.getItem("user");
      if (userRaw) {
        const u = JSON.parse(userRaw);
        if (u.dbName) return u.dbName.trim().toLowerCase();
      }
    } catch (e) {}
    return "prestige";
  });"""

if target in code:
    code = code.replace(target, replacement, 1)
    with open('ds_tester/frontend/DsTesterPage.jsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Updated selectedClient initialization in DsTesterPage.jsx successfully!")
else:
    print("Target not found in DsTesterPage.jsx")
