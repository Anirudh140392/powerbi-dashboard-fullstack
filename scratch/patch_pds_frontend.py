with open('frontend/src/pages/PDSScore/PDSScore.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add axiosInstance import
if 'axiosInstance' not in code:
    code = code.replace(
        'import React, { useState, useContext, useEffect } from "react";',
        'import React, { useState, useContext, useEffect } from "react";\nimport axiosInstance from "../../api/axiosInstance";'
    )

# 2. Add liveRows and liveTotals state, and API fetch
hook_target = """  const [sortConfig, setSortConfig] = useState({ key: "scoreId", direction: "asc" });
  const [isLoading, setIsLoading] = useState(false);"""

hook_replacement = """  const [sortConfig, setSortConfig] = useState({ key: "scoreId", direction: "asc" });
  const [isLoading, setIsLoading] = useState(false);
  const [liveRows, setLiveRows] = useState([]);
  const [liveTotals, setLiveTotals] = useState({ achievement: null, target: null });

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    axiosInstance.get("/pds-score/overview", {
      params: {
        platform: selectedPlatform,
        year: selectedYear,
        period: selectedPeriod,
      }
    }).then(res => {
      if (isMounted && res.data?.success && res.data?.data) {
        setLiveTotals({
          achievement: res.data.data.achievementFormatted,
          target: res.data.data.targetFormatted
        });
        if (res.data.data.levers && res.data.data.levers.length > 0) {
          setLiveRows(res.data.data.levers.map(r => ({
            scoreId: r.scoreId,
            dmmhLever: r.dmmhLever,
            dmmhSubLever: r.dmmhSubLever,
            weight: r.weight,
            target: r.target,
            weightedTarget: r.periodWSTarget || r.weightedTarget,
            score: r.score,
            weightedScore: r.weightedScore
          })));
        }
      }
    }).catch(err => {
      console.warn("[PDSScore] Live API fetch error, fallback:", err.message);
    }).finally(() => {
      if (isMounted) setIsLoading(false);
    });
    return () => { isMounted = false; };
  }, [selectedPlatform, selectedYear, selectedPeriod]);"""

code = code.replace(hook_target, hook_replacement)

# 3. Replace currentData with liveRows fallback
code = code.replace(
    'const currentData = getTableData(selectedPlatform, selectedPeriod);',
    'const currentData = (liveRows && liveRows.length > 0) ? liveRows : getTableData(selectedPlatform, selectedPeriod);'
)

# 4. Replace totalTarget and totalAchievement
code = code.replace(
    'const totalTarget = calculateTotal("weightedTarget");\n  const totalAchievement = calculateTotal("weightedScore");',
    'const totalTarget = liveTotals.target || calculateTotal("weightedTarget");\n  const totalAchievement = liveTotals.achievement || calculateTotal("weightedScore");'
)

with open('frontend/src/pages/PDSScore/PDSScore.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated PDSScore.jsx for live API.')

