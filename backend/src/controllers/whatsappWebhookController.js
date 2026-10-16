// src/controllers/whatsappWebhookController.js
// Production Meta WhatsApp Cloud API Webhook Handler
// Manages challenge verification (GET) and real-time delivery status/error tracking (POST)

import crypto from 'crypto';

/**
 * GET Verification endpoint for Meta Webhooks.
 * Meta sends a GET request to verify the endpoint ownership when subscribing.
 */
export const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'trailytics_wa_webhook_secret_2026';

    if (mode === 'subscribe' && token === expectedToken) {
        console.log('[WhatsAppWebhook] ✅ Webhook verified successfully by Meta!');
        return res.status(200).send(challenge);
    } else {
        console.error('[WhatsAppWebhook] ❌ Webhook verification failed! Invalid verify token.');
        return res.sendStatus(403);
    }
};

/**
 * POST Webhook event receiver for status updates (sent, delivered, read, failed).
 * Pushed asynchronously by Meta Cloud API.
 */
export const handleWebhookEvent = (req, res) => {
    try {
        const body = req.body;

        // Verify request payload signature if APP_SECRET is present
        const appSecret = process.env.WHATSAPP_APP_SECRET;
        if (appSecret && req.headers['x-hub-signature-256']) {
            const signature = req.headers['x-hub-signature-256'].replace('sha256=', '');
            const expectedSig = crypto
                .createHmac('sha256', appSecret)
                .update(JSON.stringify(body))
                .digest('hex');

            if (signature !== expectedSig) {
                console.error('[WhatsAppWebhook] ❌ Invalid payload signature. Rejecting event.');
                return res.sendStatus(401);
            }
        }

        if (body.object === 'whatsapp_business_account') {
            const entries = body.entry || [];
            for (const entry of entries) {
                const changes = entry.changes || [];
                for (const change of changes) {
                    const value = change.value || {};

                    // Handle Message Status Updates (sent, delivered, read, failed)
                    if (value.statuses && Array.isArray(value.statuses)) {
                        for (const statusObj of value.statuses) {
                            const messageId = statusObj.id;
                            const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
                            const recipientId = statusObj.recipient_id;
                            const timestamp = statusObj.timestamp;

                            console.log(`\n--------------------------------------------------`);
                            console.log(`[WhatsAppWebhook 📊 STATUS UPDATE]`);
                            console.log(`  Message ID   : ${messageId}`);
                            console.log(`  Recipient    : +${recipientId}`);
                            console.log(`  Status       : ${status.toUpperCase()}`);
                            console.log(`  Timestamp    : ${new Date(timestamp * 1000).toISOString()}`);

                            if (status === 'failed') {
                                const errors = statusObj.errors || [];
                                for (const err of errors) {
                                    console.error(`  ❌ Delivery Failure Code: ${err.code}`);
                                    console.error(`  ❌ Title: ${err.title}`);
                                    console.error(`  ❌ Details: ${err.error_data?.details || err.message || 'No extra details'}`);
                                    
                                    // Explain common Meta delivery failure codes
                                    explainMetaErrorCode(err.code);
                                }
                            }
                            console.log(`--------------------------------------------------\n`);
                        }
                    }

                    // Handle Incoming Messages (user-initiated messages)
                    if (value.messages && Array.isArray(value.messages)) {
                        for (const msg of value.messages) {
                            console.log(`[WhatsAppWebhook 📩 INCOMING MESSAGE] From +${msg.from}: "${msg.text?.body || msg.type}"`);
                        }
                    }
                }
            }
        }

        // Meta requires a 200 OK response within 20 seconds to prevent event retries
        return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
        console.error('[WhatsAppWebhook] Error handling webhook payload:', err.message);
        return res.status(200).send('EVENT_RECEIVED');
    }
};

/**
 * Diagnostic breakdown of Meta Error Codes for WhatsApp Cloud API
 */
function explainMetaErrorCode(code) {
    switch (Number(code)) {
        case 131026:
            console.error(`     👉 DIAGNOSIS: Code 131026 - Message Undeliverable.`);
            console.error(`        Reason: Meta App is in Development Mode and recipient is not added to test numbers, OR recipient opted out / phone turned off.`);
            break;
        case 131047:
            console.error(`     👉 DIAGNOSIS: Code 131047 - Re-engagement / 24h Window Required.`);
            console.error(`        Reason: Tried to send plain text message outside 24h customer service window. Must use an approved Template message.`);
            break;
        case 131009:
            console.error(`     👉 DIAGNOSIS: Code 131009 - Parameter Value Mismatch.`);
            console.error(`        Reason: Variable count or parameter format in code does not match Meta approved template.`);
            break;
        case 131058:
            console.error(`     👉 DIAGNOSIS: Code 131058 - Template restricted.`);
            console.error(`        Reason: hello_world can only be sent from test numbers. Custom templates required for registered numbers.`);
            break;
        default:
            console.error(`     👉 DIAGNOSIS: Meta Error Code ${code}. Check Meta Cloud API documentation for specific resolution.`);
            break;
    }
}
