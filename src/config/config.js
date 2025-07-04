// Almacenamiento para AUTH_COOKIEs
let _authCookies = {
    fromEnv: process.env.AUTH_COOKIE ? process.env.AUTH_COOKIE.split(',').map(c => c.trim()) : [],
    fromDB: [] // Se actualizará dinámicamente
};

// Método para obtener todas las cookies combinadas
const getAllAuthCookies = () => {
    const combined = [..._authCookies.fromEnv, ..._authCookies.fromDB];
    return combined.length > 0 ? combined.join(',') : null;
};

// Método para actualizar las cookies de la base de datos
const updateDBAuthCookies = (cookies) => {
    _authCookies.fromDB = Array.isArray(cookies) ? cookies : [];
};

// Método para obtener las cookies del entorno
const getEnvAuthCookies = () => {
    return process.env.AUTH_COOKIE ? process.env.AUTH_COOKIE.split(',').map(c => c.trim()) : [];
};

const config = {
    port: process.env.PORT || 3010,
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
    
    // Métodos para AUTH_COOKIEs
    getAllAuthCookies,
    updateDBAuthCookies,
    getEnvAuthCookies,
    
    // Propiedad para compatibilidad con código existente
    get authCookie() {
        return getAllAuthCookies();
    }
};

module.exports = config;
