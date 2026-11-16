with open('frontend/src/pages/PDSScore/PDSScore.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace Period 1-6 with Period 1-13
old_periods = """                <MenuItem value="Period 1" sx={{ fontSize: "0.75rem" }}>Period 1</MenuItem>
                <MenuItem value="Period 2" sx={{ fontSize: "0.75rem" }}>Period 2</MenuItem>
                <MenuItem value="Period 3" sx={{ fontSize: "0.75rem" }}>Period 3</MenuItem>
                <MenuItem value="Period 4" sx={{ fontSize: "0.75rem" }}>Period 4</MenuItem>
                <MenuItem value="Period 5" sx={{ fontSize: "0.75rem" }}>Period 5</MenuItem>
                <MenuItem value="Period 6" sx={{ fontSize: "0.75rem" }}>Period 6</MenuItem>"""

new_periods = """                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(p => (
                  <MenuItem key={p} value={`Period ${p}`} sx={{ fontSize: "0.75rem" }}>{`Period ${p}`}</MenuItem>
                ))}"""

text = text.replace(old_periods, new_periods)

with open('frontend/src/pages/PDSScore/PDSScore.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated Period dropdown in PDSScore.jsx to support Periods 1 to 13.')

