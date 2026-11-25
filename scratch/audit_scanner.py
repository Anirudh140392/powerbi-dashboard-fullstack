import os

modules_dir = 'ds_tester/backend/modules'
keywords = ['2026-', '30360', 'fallback', 'limit 25', 'LIMIT 25', "== 'drl'", '== "drl"', "== 'mars'", '== "mars"']

for f in sorted(os.listdir(modules_dir)):
    if f.endswith('.py'):
        path = os.path.join(modules_dir, f)
        with open(path, 'r', encoding='utf-8') as fp:
            lines = fp.readlines()
        for idx, line in enumerate(lines):
            l = line.strip()
            if any(k.lower() in l.lower() for k in keywords):
                # ignore comments or pure imports
                if not l.startswith('#') and not l.startswith('import'):
                    print(f'{f}:{idx+1} -> {l[:100]}')

with open('ds_tester/backend/anomaly_engine.py', 'r', encoding='utf-8') as fp:
    lines = fp.readlines()
for idx, line in enumerate(lines):
    l = line.strip()
    if any(k.lower() in l.lower() for k in keywords):
        if not l.startswith('#') and not l.startswith('import'):
            print(f'anomaly_engine.py:{idx+1} -> {l[:100]}')
