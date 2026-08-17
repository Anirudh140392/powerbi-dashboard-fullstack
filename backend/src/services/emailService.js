// src/services/emailService.js
import nodemailer from 'nodemailer';
import 'dotenv/config';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        const user = process.env.SMTP_USER || process.env.Alert_email;
        const pass = process.env.SMTP_PASS || process.env.ALERT_EMAIL_PASSWORD || process.env.Alert_email_password;
        const host = process.env.SMTP_HOST || 'smtp.office365.com';
        const port = parseInt(process.env.SMTP_PORT || '587', 10);

        if (user && pass) {
            transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
                tls: {
                    ciphers: 'SSLv3',
                    rejectUnauthorized: false,
                }
            });
            console.log('[EmailService] SMTP transporter initialized for:', host, 'using account:', user);
        } else {
            console.warn('[EmailService] SMTP credentials not provided in .env. Email invites will be logged to console in dev mode.');
        }
    }
    return transporter;
}

/**
 * Send an invitation email to a newly invited user
 * @param {string} toEmail - Recipient email address
 * @param {string} inviteLink - URL link for accepting invitation & creating password
 * @param {string} dbName - Target company/tenant database name
 * @returns {Promise<boolean>}
 */
export async function sendUserInviteEmail(toEmail, inviteLink, dbName = '') {
    const senderEmail = process.env.SMTP_USER || process.env.Alert_email || 'business@trailytics.com';
    const fromAddress = process.env.EMAIL_FROM || `"Trailytics Support" <${senderEmail}>`;
    const formattedDbName = dbName ? dbName.replace(/_/g, ' ').toUpperCase() : 'TRAILYTICS';

    const subject = `You've been invited to Trailytics (${formattedDbName})`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
        .logo { font-size: 24px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px; margin-bottom: 24px; }
        h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 0; }
        p { font-size: 15px; line-height: 1.6; color: #475569; }
        .badge { display: inline-block; background-color: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
        .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 16px; font-weight: 600; margin: 24px 0; text-align: center; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); }
        .btn:hover { background-color: #4338ca; }
        .footer { margin-top: 32px; pt-32px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
        .link-text { word-break: break-all; font-size: 12px; color: #64748b; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Trailytics</div>
        <div class="badge">Organization Invite</div>
        <h1>Welcome to Trailytics Analytics Platform</h1>
        <p>Hello,</p>
        <p>An administrator has invited you to join Trailytics with access to <strong>${formattedDbName}</strong> analytics environment.</p>
        <p>Please click the button below to accept your invitation and create your account password. This link is valid for 48 hours.</p>
        
        <div style="text-align: center;">
          <a href="${inviteLink}" class="btn" target="_blank">Accept Invite & Set Password</a>
        </div>

        <p>Once your password is created, you can log in using your password or via <strong>Google SSO / Microsoft SSO</strong> using this email address (<code>${toEmail}</code>).</p>
        
        <p class="link-text">If the button above does not work, copy and paste this link into your browser:<br>${inviteLink}</p>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Trailytics Inc. All rights reserved.<br>If you did not request this invitation, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const activeTransporter = getTransporter();

    if (activeTransporter) {
        try {
            await activeTransporter.sendMail({
                from: fromAddress,
                to: toEmail,
                subject,
                html: htmlContent,
            });
            console.log(`[EmailService] Invitation email successfully sent to: ${toEmail}`);
            return true;
        } catch (err) {
            console.error(`[EmailService] Failed to send email to ${toEmail}:`, err.message);
            // Don't throw, fall through to dev log
        }
    }

    // Dev mode fallback log
    console.log('\n======================================================');
    console.log('✉️  [DEV EMAIL LOG] User Invitation Link:');
    console.log(`    To: ${toEmail}`);
    console.log(`    Link: ${inviteLink}`);
    console.log('======================================================\n');
    return true;
}
