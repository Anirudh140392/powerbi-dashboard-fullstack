import urllib.request, json
req = urllib.request.urlopen('http://127.0.0.1:8002/ds-tester/modules?client=mars')
data = json.loads(req.read().decode())
print('Mars modules from port 8002:')
for m in data:
    segs = [s["id"] for s in m.get("segments", [])]
    print(f' - {m["id"]}: {m["name"]} ({len(segs)} segments)')

