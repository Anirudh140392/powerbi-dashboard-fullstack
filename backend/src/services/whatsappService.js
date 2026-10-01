// src/services/whatsappService.js
// Production-grade WhatsApp Cloud API Dispatcher with Retries and Structured Logging

import axios from 'axios';

/**
 * Sanitize and format phone number into E.164 format without leading '+'
 * @param {string} phone
 * @returns {string} Normalized 12-digit Indian or international number (e.g. "919313713899")
 */
export const normalizePhoneNumber = (phone) => {
    let cleaned = String(phone || '').replace(/\D/g, '');
    if (cleaned.length === 10) {
        cleaned = `91${cleaned}`;
    }
    return cleaned;
};

/**
 * Dispatch a WhatsApp template message with exponential backoff retries for transient errors.
 * 
 * @param {Object} options
 * @param {string} options.to - Target recipient phone number
 * @param {Array} options.components - Pre-built template components array
 * @param {string} [options.templateName] - Template name (defaults to WHATSAPP_TEMPLATE_NAME or digital_insight_alert)
 * @param {string} [options.templateLang] - Template language code (defaults to WHATSAPP_TEMPLATE_LANG or en)
 * @param {string} [options.text] - Human-readable message text for audit logging
 * @param {number} [options.maxRetries=3] - Maximum retry attempts for 5xx/429 status codes
 * @returns {Promise<Object>} Meta API response data
 */
export const sendWhatsappMessage = async ({
    to,
    components,
    templateName,
    templateLang,
    text,
    maxRetries = 3
}) => {
    const targetPhone = normalizePhoneNumber(to || process.env.WHATSAPP_TO || process.env.Whatsapp_Number || '8766258384');
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1283810401472038';
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const apiUrl = process.env.WHATSAPP_API_URL || `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;
    const template = templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'digital_insight_alert';
    const lang = templateLang || process.env.WHATSAPP_TEMPLATE_LANG || 'en';

    console.log(`\n==================================================`);
    console.log(`[WhatsAppAlert] 📱 DISPATCHING WHATSAPP TEMPLATE ALERT`);
    console.log(`[WhatsAppAlert] Phone Number ID : ${phoneNumberId}`);
    console.log(`[WhatsAppAlert] Target Number   : +${targetPhone}`);
    console.log(`[WhatsAppAlert] Template        : "${template}" (${lang})`);
    if (text) console.log(`[WhatsAppAlert] Audit Preview   :\n${text}`);
    console.log(`==================================================\n`);

    if (!accessToken) {
        const errMsg = '[WhatsAppAlert] ❌ Missing WHATSAPP_ACCESS_TOKEN in environment.';
        console.error(errMsg);
        throw new Error(errMsg);
    }

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: targetPhone,
        type: 'template',
        template: {
            name: template,
            language: { code: lang },
        }
    };

    if (components && Array.isArray(components) && components.length > 0) {
        payload.template.components = components;
    }

    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        try {
            console.log(`[WhatsAppAlert] [Attempt ${attempt}/${maxRetries}] Calling Meta Cloud API...`);
            console.log(`[WhatsAppAlert] Payload:`, JSON.stringify(payload, null, 2));

            const response = await axios.post(apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            const responseData = response.data;
            const messageId = responseData?.messages?.[0]?.id;
            const messageStatus = responseData?.messages?.[0]?.message_status || 'accepted';

            console.log(`\n[WhatsAppAlert] ✅ SUCCESS (HTTP ${response.status})`);
            console.log(`[WhatsAppAlert] Message ID     : ${messageId}`);
            console.log(`[WhatsAppAlert] Initial Status : ${messageStatus}`);
            console.log(`[WhatsAppAlert] Meta Response  :`, JSON.stringify(responseData, null, 2));

            return {
                success: true,
                messageId,
                status: messageStatus,
                data: responseData
            };
        } catch (error) {
            const status = error.response?.status;
            const errorData = error.response?.data?.error || {};
            const isTransient = !status || status >= 500 || status === 429;

            console.error(`[WhatsAppAlert] ❌ Attempt ${attempt} failed (HTTP ${status || 'NETWORK_ERROR'}):`);
            console.error(`[WhatsAppAlert] Error Code   : ${errorData.code || 'N/A'}`);
            console.error(`[WhatsAppAlert] Error Message: ${errorData.message || error.message}`);
            if (errorData.error_data) {
                console.error(`[WhatsAppAlert] Error Details:`, JSON.stringify(errorData.error_data, null, 2));
            }

            if (isTransient && attempt < maxRetries) {
                const backoffMs = Math.pow(2, attempt) * 1000;
                console.warn(`[WhatsAppAlert] Transient error detected. Retrying in ${backoffMs}ms...`);
                await new Promise(res => setTimeout(res, backoffMs));
            } else {
                throw new Error(`Meta WhatsApp Cloud API error (Code ${errorData.code || status}): ${errorData.message || error.message}`);
            }
        }
    }
};
