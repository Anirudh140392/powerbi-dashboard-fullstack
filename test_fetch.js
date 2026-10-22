fetch("http://localhost:5000/api/insights?platform=Blinkit&city=Mumbai&category=Chocolates%20(Non%20Gifting)&signal=Share%20Headroom%20Hotspots")
  .then(r => r.json())
  .then(d => {
      const shh = d.data.find(x => x.type === "Share Headroom Hotspots");
      console.log(shh.evidence);
  });
