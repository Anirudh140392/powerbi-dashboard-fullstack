const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/.env' });

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret123');

axios.get('http://localhost:5000/api/visibility-analysis/visibility-overview', {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => {
    console.log(JSON.stringify(res.data, null, 2));
}).catch(err => {
    console.error(err.response ? err.response.data : err.message);
});
