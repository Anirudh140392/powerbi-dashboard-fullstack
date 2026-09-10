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
    console.log(`Sending to ${recipients.length} recipients via BCC...\n`);

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: `"${fromName}" <${fromEmail}>`,
        bcc: recipients,
        subject: `🔍 BCC-CHECK: who is in To? [${new Date().toLocaleTimeString()}]`,
        html: `<h2>BCC Verification Test</h2>
               <p>This email was sent via BCC.</p>
               <p><b>Check the To: field</b> — it should show ONLY "Trailytics Alerts".</p>
               <p>No recipient should see any other recipient's email address.</p>
               <p style="color:gray;font-size:12px">Unique ID: ${uniqueId}</p>`,
        text: `BCC check test. Check who appears in To field.`,
        headers: {
            'Thread-Topic': `BCC-Check-${uniqueId}`,
            'Thread-Index': Buffer.from(uniqueId).toString('base64'),
        },
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Sent via BCC → Message-ID: ${info.messageId}`);
    } catch (e) {
        console.error(`❌ Send error: ${e.message}`);
    }

    console.log('\n✅ Done!');
}


testSend();
