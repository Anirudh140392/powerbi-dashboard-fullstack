import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT_COTENT || process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is operating on => http://localhost:${PORT}`);
});