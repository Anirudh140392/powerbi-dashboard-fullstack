const accessControlMiddleware = (req, res, next) => {
    const dbName = req.headers['db-name'] || req.query.dbName || (req.user && req.user.dbName);

    if (dbName === 'sugar') {
        const url = req.originalUrl.toLowerCase();

        // Check if the request is for competition-related data
        if (
            url.includes('competition') ||
            url.includes('market-share') ||
            req.query.keywordType === 'Competition'
        ) {
            return res.status(403).json({
                error: 'Access Denied',
                message: 'Competition data is restricted for this account.'
            });
        }
    }

    next();
};

export default accessControlMiddleware;
