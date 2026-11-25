path = 'ds_tester/frontend/DsTesterPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix line 240-247
old_block1 = """        // Auto-switch UI client and module ONLY if a batch scan initiated from this UI session is running
        if (isBatchMode && batchQueue.length > 0) {
          if (statusData?.active_client) {
            setSelectedClient((curr) => (curr !== statusData.active_client ? statusData.active_client : curr));
          }
          if (statusData?.active_module) {
            setSelectedModule((curr) => (curr !== statusData.active_module ? statusData.active_module : curr));
          }
        }"""

new_block1 = """        // Preserve user manual selection: only default selectedModule if user has not chosen one
        if (isBatchMode && batchQueue.length > 0) {
          if (!selectedModule && statusData?.active_module) {
            setSelectedModule(statusData.active_module);
          }
        }"""

# 2. Fix line 269-273
old_block2 = """          // Preserved user selectedClient from manual UI choice (do not auto-switch to r.client)
          if (r.module) {
            setSelectedModule((curr) => (curr !== r.module ? r.module : curr));
          }"""

new_block2 = """          // Preserved user selectedClient and selectedModule from manual UI choice
          // Do NOT auto-switch selectedModule to r.module so user can freely inspect other modules while test runs in background
          if (!selectedModule && r.module) {
            setSelectedModule(r.module);
          }"""

# 3. Fix line 319-324
old_block3 = """      if (isBatchMode && batchQueue.length > 0) {
        // Preserved user selectedClient from manual UI choice
        if (data?.active_module) {
          setSelectedModule((curr) => (curr !== data.active_module ? data.active_module : curr));
        }
      }"""

new_block3 = """      if (isBatchMode && batchQueue.length > 0) {
        // Preserved user selectedClient and selectedModule from manual UI choice
        if (!selectedModule && data?.active_module) {
          setSelectedModule(data.active_module);
        }
      }"""

# 4. Fix line 732
old_block4 = """          // User selectedClient preserved
          if (runningRun.module) setSelectedModule(runningRun.module);"""

new_block4 = """          // User selectedClient and selectedModule preserved
          if (runningRun.module && !selectedModule) setSelectedModule(runningRun.module);"""

# 5. Fix line 747
old_block5 = """          // User selectedClient preserved
          if (r.module) setSelectedModule(r.module);"""

new_block5 = """          // User selectedClient and selectedModule preserved
          if (r.module && !selectedModule) setSelectedModule(r.module);"""

content_norm = content.replace('\r\n', '\n')
for idx, (old_b, new_b) in enumerate([
    (old_block1, new_block1),
    (old_block2, new_block2),
    (old_block3, new_block3),
    (old_block4, new_block4),
    (old_block5, new_block5),
], 1):
    old_norm = old_b.replace('\r\n', '\n')
    new_norm = new_b.replace('\r\n', '\n')
    assert old_norm in content_norm, f'Block {idx} not found in DsTesterPage.jsx!'
    content_norm = content_norm.replace(old_norm, new_norm, 1)

with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content_norm)

print('Successfully removed auto-hijack of selectedModule in DsTesterPage.jsx!')
