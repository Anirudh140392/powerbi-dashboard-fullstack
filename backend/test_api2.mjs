import { downloadReport } from './src/controllers/reportsController.js';

async function test() {
    const req = {
        user: { dbName: 'mars' },
        query: {
            platform: 'amazon,blinkit',
            timePeriod: 'Last 30 Days',
            reportType: 'Master Dump',
            metrics: 'Offtake,Units Sold,Orders,Stock Availability,Listing %,Inorganic Sales,ROAS,Conversion Rate,CPM,CPC,BMI Sales Ratio,Promo %,OSA %,Stock Out %,DOI,SOS %,PSL,Assortment,Metro City Stock Availability,Overall SOS %,Sponsored SOS %,Organic SOS %,Ad Position,Org Position,ECP,MRP,Discount %,RPI,Sales Value,Market Share %,Category Size',
            dimensions: 'Category,Brand,City',
            granularityTime: 'Daily',
            granularitySku: 'Category',
            granularityGeo: 'Pan India',
            startDate: '2026-03-28',
            endDate: '2026-04-27'
        }
    };
    
    const res = {
        status: (code) => {
            console.log("Status:", code);
            return { send: () => console.log("Sent") };
        },
        setHeader: (key, val) => console.log("SetHeader:", key, val),
        send: (buffer) => console.log("Sent buffer of size", buffer.length)
    };

    try {
        await downloadReport(req, res);
    } catch (e) {
        console.error("Error in downloadReport:", e);
    }
}
test();
