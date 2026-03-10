import http from 'http';

http.get('http://localhost:5000/api/watchtower/competition-brand-trends?platform=Blinkit&location=All&brands=Amul&skus=All&category=All&period=1M&timeStep=Daily', { timeout: 3000 }, (res) => {
    // Just trigger it, let the backend log.
    process.exit(0);
}).on('error', (e) => {
    process.exit(0);
});
