path = 'ds_tester/frontend/DsTesterPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

target = "  Fade,\n} from \"@mui/material\";"
replacement = "  Fade,\n  TextField,\n} from \"@mui/material\";"

c_norm = c.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

assert target_norm in c_norm, 'Target not found!'
c_norm = c_norm.replace(target_norm, replacement_norm, 1)
with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(c_norm)
print('Successfully added TextField to @mui/material imports in DsTesterPage.jsx!')
