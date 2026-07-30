// src/services/whatsappService.js
// Handles dispatching WhatsApp messages via Meta WhatsApp Cloud API / Webhook with logging

import axios from 'axios';

/**
 * Send WhatsApp message using Meta WhatsApp Cloud API or custom Webhook
 * @param {Object} options
 * @param {string} options.to - Target phone number
 * @param {string} [options.text] - WhatsApp message text
 * @param {string} [options.templateName] - Template name (e.g. hello_world)
 * @param {string} [options.templateLang] - Language code (e.g. en_US)
 */
export const sendWhatsappMessage = async ({ to, text, templateName, templateLang }) => {
    let targetPhone = String(to || process.env.Whatsapp_Number || process.env.WHATSAPP_NUMBER || '8766258384').replace(/\D/g, '');
    
    // Ensure country code prefix (default 91 for 10-digit Indian numbers)
    if (targetPhone.length === 10) {
        targetPhone = `91${targetPhone}`;
    }

    console.log(`\n==================================================`);
    console.log(`[WhatsAppAlert] 📱 DISPATCHING WHATSAPP MESSAGE`);
    console.log(`[WhatsAppAlert] Target Number: ${targetPhone}`);
    console.log(`[WhatsAppAlert] Message Content:\n${text || 'Template Message'}`);
    console.log(`==================================================\n`);

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1226514977213899';
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const apiUrl = process.env.WHATSAPP_API_URL || `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

    // 1. Meta WhatsApp Cloud API (Graph API template format)
    if (accessToken) {
        try {
            const template = templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'hello_world';
            const lang = templateLang || process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';

            const payload = {
                messaging_product: 'whatsapp',
                to: targetPhone,
                type: 'template',
                template: {
                    name: template,
                    language: {
                        code: lang
                    }
                }
            };

            console.log(`[WhatsAppAlert] Calling Meta Cloud API: ${apiUrl}`);
            const response = await axios.post(apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            console.log(`[WhatsAppAlert] Meta Cloud API Response Status:`, response.status);
            console.log(`[WhatsAppAlert] Meta Cloud API Response Data:`, response.data);
            return response.data;
        } catch (apiErr) {
            console.error(`[WhatsAppAlert] Meta Cloud API Dispatch Error:`, apiErr.response?.data || apiErr.message);
            throw apiErr;
        }
    }

    // 2. Fallback to custom webhook / Ultramsg API if configured
    const ultramsgUrl = process.env.ULTRAMSG_API_URL;
    const ultramsgToken = process.env.ULTRAMSG_TOKEN;
    if (ultramsgUrl) {
        try {
            const payload = {
                to: targetPhone,
                body: text,
                message: text,
                token: ultramsgToken
            };
            const response = await axios.post(ultramsgUrl, payload, { timeout: 15000 });
            console.log(`[WhatsAppAlert] Ultramsg Response:`, response.data);
            return response.data;
        } catch (apiErr) {
            console.error(`[WhatsAppAlert] Ultramsg Dispatch Error:`, apiErr.message);
        }
    }

    return { success: true, targetPhone, text };
};
