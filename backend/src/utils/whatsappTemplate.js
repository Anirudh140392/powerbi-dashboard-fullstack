// src/utils/whatsappTemplate.js
// Generates plain text WhatsApp alert notification message based on the specified template

/**
 * Generates formatted WhatsApp alert message text
 * @param {string} name - Recipient name (defaults to 'there')
 * @returns {string} - Formatted WhatsApp message
 */
export const generateWhatsappAlertText = (name = "there") => {
    const formattedName = name && name.trim() ? name.trim() : "there";
    return `Hi ${formattedName}, quick update on the dashboard 👋

We've mapped out new alerts that build on your existing data — no extra setup needed for most:

📦 Predictive stockout alerts (24-48hrs early warning)
💰 City-wise sales-loss breakdown from OOS
🎯 Same-day competitor price-cut alerts

A couple of these unlock even more value with a small input from your side (MRP list / priority keywords).

Can we hop on a quick call this week to walk through it? Happy to share the full breakdown too.`;
};
