import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const fromEmail = process.env.Alert_email || 'business@trailytics.com';
const pass = process.env.Alert_email_password;
const fromName = 'Trailytics Alerts';

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: { user: fromEmail, pass },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

const recipients = ['kenil.k@trailytics.com', 'aniket.j@trailytics.com'];

async function testSend() {
    console.log(`Sending to ${recipients.length} recipients individually...\n`);

    for (const recipient of recipients) {
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            // NO 'to' field — header set manually below
            subject: `🔍 BCC-CHECK: who is in To? [${new Date().toLocaleTimeString()}]`,
            html: `<h2>BCC Verification Test</h2>
                   <p>This email was sent to <b>${recipient}</b> only (via SMTP envelope).</p>
                   <p><b>Check the To: field</b> — it should show ONLY "Trailytics Alerts".</p>
                   <p>If you see anyone else's name in To, please tell me.</p>
                   <p style="color:gray;font-size:12px">Unique ID: ${uniqueId}</p>`,
            text: `BCC check test. Delivered to: ${recipient}. Check who appears in To field.`,
            headers: {
                'To': `"${fromName}" <${fromEmail}>`,
                // Force unique conversation thread to avoid grouping with old emails
                'Thread-Topic': `BCC-Check-${uniqueId}`,
                'Thread-Index': Buffer.from(uniqueId).toString('base64'),
            },
            envelope: {
                from: fromEmail,
                to: recipient,
            },
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ ${recipient} → Message-ID: ${info.messageId}`);
            console.log(`   Envelope: ${JSON.stringify(info.envelope)}`);
        } catch (e) {
            console.error(`❌ ${recipient}: ${e.message}`);
        }
    }

    console.log('\n✅ Done! Check kenil.k inbox — open the "BCC-CHECK" email and check To: field.');
}

testSend();
