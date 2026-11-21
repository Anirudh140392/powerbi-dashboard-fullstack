with open('frontend/src/pages/PDSScore/PDSScore.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_block = """                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(p => (
                  <MenuItem key={p} value={`Period ${p}`} sx={{ fontSize: "0.75rem" }}>{`Period ${p}`}</MenuItem>
                ))}"""

new_block = """                <MenuItem value="Period 1" sx={{ fontSize: "0.75rem" }}>Period 1</MenuItem>
                <MenuItem value="Period 2" sx={{ fontSize: "0.75rem" }}>Period 2</MenuItem>
                <MenuItem value="Period 3" sx={{ fontSize: "0.75rem" }}>Period 3</MenuItem>
                <MenuItem value="Period 4" sx={{ fontSize: "0.75rem" }}>Period 4</MenuItem>
                <MenuItem value="Period 5" sx={{ fontSize: "0.75rem" }}>Period 5</MenuItem>
                <MenuItem value="Period 6" sx={{ fontSize: "0.75rem" }}>Period 6</MenuItem>"""

if old_block in c:
    c = c.replace(old_block, new_block)
    with open('frontend/src/pages/PDSScore/PDSScore.jsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Replaced successfully!")
else:
    # check with CRLF
    c = c.replace(old_block.replace("\n", "\r\n"), new_block.replace("\n", "\r\n"))
    with open('frontend/src/pages/PDSScore/PDSScore.jsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Replaced with CRLF!")

