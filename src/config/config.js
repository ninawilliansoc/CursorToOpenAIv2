module.exports = {
    port: process.env.PORT || 3010,
    authCookie: process.env.AUTH_COOKIE || null,
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    cookieRotation: {
        enabled: process.env.COOKIE_ROTATION === 'true' || false,
        time: process.env.COOKIE_TIME || '5m'
    },
    proxy:{
        enabled: process.env.PROXY_ENABLED === 'true' || false,
        url: process.env.PROXY_URL || 'http://127.0.0.1:7890',
    },
    // Control global de rate limit
    rateLimitEnabled: process.env.RATELIMIT_WORK !== 'false', // Por defecto true si no se especifica
    //chatMode: 1 // 1 for ask, 2 for agent, 3 for edit
};
