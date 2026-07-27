// src/services/whatsappService.js
// Handles dispatching WhatsApp messages via API / Webhook with logging

import axios from 'axios';

/**
 * Send WhatsApp text message
 * @param {Object} options
 * @param {string} options.to - Target phone number
 * @param {string} options.text - WhatsApp message text
 */
export const sendWhatsappMessage = async ({ to, text }) => {
    const targetPhone = to || process.env.Whatsapp_Number || process.env.WHATSAPP_NUMBER || '8766258384';
    console.log(`\n==================================================`);
    console.log(`[WhatsAppAlert] 📱 DISPATCHING WHATSAPP MESSAGE`);
    console.log(`[WhatsAppAlert] Target Number: ${targetPhone}`);
    console.log(`[WhatsAppAlert] Message Content:\n${text}`);
    console.log(`==================================================\n`);

    // If an external WhatsApp API or Webhook URL is configured in .env, call it via HTTP POST
    const whatsappApiUrl = process.env.WHATSAPP_API_URL || process.env.ULTRAMSG_API_URL;
    const whatsappToken = process.env.WHATSAPP_API_TOKEN || process.env.ULTRAMSG_TOKEN;

    if (whatsappApiUrl) {
        try {
            const payload = {
                to: targetPhone,
                body: text,
                message: text,
                token: whatsappToken
            };
            const response = await axios.post(whatsappApiUrl, payload, { timeout: 15000 });
            console.log(`[WhatsAppAlert] External API Response:`, response.data);
            return response.data;
        } catch (apiErr) {
            console.error(`[WhatsAppAlert] External API Dispatch Error:`, apiErr.message);
        }
    }

    return { success: true, targetPhone, text };
};
