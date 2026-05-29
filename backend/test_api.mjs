import axios from 'axios';

async function test() {
    try {
        const queryParams = new URLSearchParams({
            platform: 'Amazon,Blinkit,Instamart',
            timePeriod: 'Last 30 Days',
            reportType: 'Master Dump',
            metrics: 'Offtake,Units Sold,Orders,Stock Availability,Listing %,Inorganic Sales,ROAS,Conversion Rate,CPM,CPC,BMI Sales Ratio,Promo %,OSA %,Stock Out %,DOI,SOS %,PSL,Assortment,Metro City Stock Availability,Overall SOS %,Sponsored SOS %,Organic SOS %,Ad Position,Org Position,ECP,MRP,Discount %,RPI,Sales Value,Market Share %,Category Size',
            dimensions: 'Category,Brand,City',
            granularityTime: 'Daily',
            granularitySku: 'Category',
            granularityGeo: 'Pan India',
            startDate: '2026-03-28',
            endDate: '2026-04-27'
        });
        
        console.log("Calling API...");
        // Call the endpoint on the running backend server.
        // The backend uses JWT auth, but we don't have a token.
        // Actually, we can just call it if we mock the request.
        // It's easier to just construct the req and res objects and call `downloadReport`.
    } catch (e) {
        console.log(e);
    }
}
test();
