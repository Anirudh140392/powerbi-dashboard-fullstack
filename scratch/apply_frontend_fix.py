with open('ds_tester/frontend/DsTesterPage.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update startSentinelPolling to fetch anomalies on every tick
old_sentinel_poll = """        const [statusRes, runsRes, activeRes] = await Promise.all([
          axios.get(`${DS_TESTER_API}/anomaly/status`),
          axios.get(`${DS_TESTER_API}/runs`).catch(() => ({ data: [] })),
          axios.get(`${DS_TESTER_API}/active`).catch(() => ({ data: null })),
        ]);

        const statusData = statusRes.data;
        setSentinelStatus(statusData);"""

new_sentinel_poll = """        const [statusRes, runsRes, activeRes, anomsRes] = await Promise.all([
          axios.get(`${DS_TESTER_API}/anomaly/status`),
          axios.get(`${DS_TESTER_API}/runs`).catch(() => ({ data: [] })),
          axios.get(`${DS_TESTER_API}/active`).catch(() => ({ data: null })),
          axios.get(`${DS_TESTER_API}/anomaly/results`, { params: { limit: 300 } }).catch(() => null),
        ]);

        const statusData = statusRes.data;
        setSentinelStatus(statusData);

        if (anomsRes?.data?.anomalies) {
          setSentinelAnomalies(anomsRes.data.anomalies);
        }"""

if old_sentinel_poll in code:
    code = code.replace(old_sentinel_poll, new_sentinel_poll, 1)
    print("Updated startSentinelPolling successfully!")
else:
    print("Could not find old_sentinel_poll")

# 2. Update pollingTimerRef to fetch anomalies on every tick
old_run_poll = """        const [runsRes, activeRes] = await Promise.all([
          axios.get(`${DS_TESTER_API}/runs`).catch(() => ({ data: [] })),
          axios.get(`${DS_TESTER_API}/runs/${activeRunId}`).catch(() => null),
        ]);"""

new_run_poll = """        const [runsRes, activeRes, anomsRes] = await Promise.all([
          axios.get(`${DS_TESTER_API}/runs`).catch(() => ({ data: [] })),
          axios.get(`${DS_TESTER_API}/runs/${activeRunId}`).catch(() => null),
          axios.get(`${DS_TESTER_API}/anomaly/results`, { params: { limit: 300 } }).catch(() => null),
        ]);

        if (anomsRes?.data?.anomalies) {
          setSentinelAnomalies(anomsRes.data.anomalies);
        }"""

if old_run_poll in code:
    code = code.replace(old_run_poll, new_run_poll, 1)
    print("Updated pollingTimerRef successfully!")
else:
    print("Could not find old_run_poll")

# 3. Update handleCancelRun
old_cancel = """      setSentinelScanning(false);
      await fetchSentinelStatus();
      await fetchSessionRuns();"""

new_cancel = """      setSentinelScanning(false);
      await Promise.all([
        fetchSentinelStatus(),
        fetchSentinelAnomalies(),
        fetchSessionRuns(),
      ]);"""

if old_cancel in code:
    code = code.replace(old_cancel, new_cancel, 1)
    print("Updated handleCancelRun successfully!")
else:
    print("Could not find old_cancel")

with open('ds_tester/frontend/DsTesterPage.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Saved DsTesterPage.jsx successfully!")
