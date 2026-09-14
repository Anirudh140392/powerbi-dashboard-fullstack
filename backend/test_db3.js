import { queryAdminDB } from './src/config/adminClickhouse.js';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = Buffer.from('b25e79c090fa1b0a880fa3569503dc694fae75a363f888eb44f9dc37b600f91a', 'hex');

function decrypt(text) {
    if (!text || text === '') return '';
    try {
        let textParts = text.split(':');
        if (textParts.length < 2) return text;
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return '';
    }
}

async function test() {
    try {
        const rows = await queryAdminDB("SELECT * FROM admin_master.tb_alert WHERE alert_name LIKE '%Weekly%' LIMIT 5");
        console.log("Email decrypted:", decrypt(rows[0].send_email));
    } catch (e) {
        console.error(e);
    }
}
test();
