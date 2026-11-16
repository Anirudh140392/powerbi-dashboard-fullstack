with open('frontend/src/components/CommonLayout/Sidebar.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    '{ label: "PDS Score", path: "/pds-score", icon: <BarChartIcon sx={{ fontSize: \'1rem\' }} /> },',
    '{ label: "PDS Score", path: "/pds-score", icon: <BarChartIcon sx={{ fontSize: \'1rem\' }} />, showOnlyForDb: [\'mars\', \'mars_petcare\', \'mars_korea\'] },'
)

with open('frontend/src/components/CommonLayout/Sidebar.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated Sidebar.jsx for PDS Score.')

