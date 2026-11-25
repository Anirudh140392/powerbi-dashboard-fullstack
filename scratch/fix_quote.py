with open("ds_tester/backend/modules/primary_summary.py", "rb") as f:
    data = f.read()
data = data.replace(b'max_d"', b'max_d')
with open("ds_tester/backend/modules/primary_summary.py", "wb") as f:
    f.write(data)
print("Fixed successfully")
