/**
 * Quick standalone SMTP probe — verifies the env-var transport can
 * actually authenticate and send. Prints the raw nodemailer response.
 *
 * Usage: node scripts/test_smtp.cjs [recipient@example.com]
 */
require('dotenv').config();
const { sendAlertEmail, isMailerConfigured } = require('../server/automation/mailer.cjs');

const recipient = process.argv[2] || process.env.ALERT_DEFAULT_RECIPIENTS?.split(',')[0]?.trim() || process.env.SMTP_USER;

(async () => {
    console.log('SMTP config:');
    console.log(`  host  : ${process.env.SMTP_HOST}`);
    console.log(`  port  : ${process.env.SMTP_PORT}`);
    console.log(`  user  : ${process.env.SMTP_USER}`);
    console.log(`  pass  : ${process.env.SMTP_PASS ? '****' + process.env.SMTP_PASS.slice(-3) : '(missing)'}`);
    console.log(`  from  : ${process.env.SMTP_FROM}`);
    console.log(`  → to  : ${recipient}\n`);

    if (!isMailerConfigured()) {
        console.error('isMailerConfigured() === false — env vars not picked up.');
        process.exit(1);
    }

    try {
        const info = await sendAlertEmail({
            to: recipient,
            subject: '[Rating Intelligence] SMTP probe',
            html: '<p>This is a probe from <code>scripts/test_smtp.cjs</code>. If you can read it, SMTP works.</p>',
            text: 'SMTP probe — if you can read this, SMTP works.',
        });
        console.log('✅ SENT');
        console.log(JSON.stringify(info, null, 2));
    } catch (e) {
        console.error('❌ FAILED');
        console.error(e.message);
        if (e.response) console.error('Server response:', e.response);
        process.exit(2);
    }
})();
