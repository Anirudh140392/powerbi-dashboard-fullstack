import { sendWhatsappMessage } from './src/services/whatsappService.js';
import dotenv from 'dotenv';
dotenv.config();

const text = "🔴 *Alert Triggered: WhatsApp Test 1*\n*Client:* Mars\n*Condition:* SKU OSA Drop > 10%\n*Top Impacted SKUs:*\n📦 *blinkit*\n• *orbit spearmint flavour*\n  📉 Drop: -100.0% (100.0% -> 0.0%)";

const components = [
    {
        type: 'body',
        parameters: [
            { type: 'text', text: 'there' },
            { type: 'text', text: 'Mars' },
            { type: 'text', text: text }
        ]
    }
];

sendWhatsappMessage({
    to: '919958923570', 
    templateName: 'digital_insight_alert', 
    components 
})
    .then(res => console.log("SUCCESS:", res))
    .catch(err => console.error("ERROR:", err));
