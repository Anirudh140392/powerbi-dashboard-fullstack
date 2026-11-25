import os
import re

directories_to_scan = [
    'ds_tester/backend',
    'backend/src',
    'frontend/src'
]

findings = []

date_pattern = re.compile(r'["\']202[0-9]-[0-1][0-9]-[0-3][0-9]["\']')
client_name_pattern = re.compile(r'(?:==|!=|in)\s*\(?["\'](drl|mars|danone|prestige|dr_reddy|pidilite)["\']', re.IGNORECASE)
uuid_pattern = re.compile(r'["\'][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["\']', re.IGNORECASE)
limit_pattern = re.compile(r'\bLIMIT\s+([0-9]+)\b', re.IGNORECASE)
magic_number_pattern = re.compile(r'=\s*(30360|1234|9999)\b')

for base_dir in directories_to_scan:
    if not os.path.exists(base_dir):
        continue
    for root, _, files in os.walk(base_dir):
        # skip node_modules, dist, build, .git
        if any(skip in root for skip in ['node_modules', 'dist', 'build', '.git', '__pycache__']):
            continue
        for file in files:
            if not file.endswith(('.py', '.js', '.jsx', '.ts', '.tsx')):
                continue
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                for idx, line in enumerate(lines):
                    l_strip = line.strip()
                    if l_strip.startswith('//') or l_strip.startswith('#') or l_strip.startswith('/*'):
                        continue
                    
                    # 1. Date check
                    dates = date_pattern.findall(l_strip)
                    if dates and not any(ok in l_strip for ok in ['YYYY-MM-DD', 'defaultStart', 'test_date']):
                        findings.append((path, idx + 1, 'HARDCODED_DATE', l_strip[:120]))
                    
                    # 2. Client check
                    clients = client_name_pattern.findall(l_strip)
                    if clients:
                        findings.append((path, idx + 1, 'HARDCODED_CLIENT', l_strip[:120]))
                        
                    # 3. UUID check
                    uuids = uuid_pattern.findall(l_strip)
                    if uuids and not '00000000-0000-0000-0000-000000000000' in l_strip:
                        findings.append((path, idx + 1, 'HARDCODED_UUID', l_strip[:120]))
                        
                    # 4. Small LIMIT check
                    limits = limit_pattern.findall(l_strip)
                    for lim in limits:
                        if int(lim) in [10, 15, 20, 25]:
                            findings.append((path, idx + 1, f'ARBITRARY_LIMIT_{lim}', l_strip[:120]))
                            
                    # 5. Magic numbers
                    if magic_number_pattern.search(l_strip):
                        findings.append((path, idx + 1, 'MAGIC_NUMBER', l_strip[:120]))
            except Exception as e:
                pass

print(f"Total findings: {len(findings)}")
for f in findings:
    print(f"[{f[2]}] {f[0]}:{f[1]} -> {f[3]}")
