import axios from 'axios';
const test = async () => {
    try {
        const res = await axios.get("http://localhost:5000/api/insights", {
            params: {
                platform: "Blinkit",
                city: "Mumbai",
                category: "Chocolates (Non Gifting)",
                signal: "Share Headroom Hotspots"
            }
        });
        const data = res.data.data;
        const shh = data.find(d => d.type === "Share Headroom Hotspots");
        console.log("Evidence rows:");
        shh.evidence.forEach(e => {
            console.log(e.city, e.platform, e.category, e.myTopSku, e.competitorSku);
        });
    } catch (e) {
        console.error(e.message);
    }
}
test();
