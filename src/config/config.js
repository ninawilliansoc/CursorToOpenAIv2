// Almacenamiento para AUTH_COOKIEs
let _authCookies = {
    fromEnv: process.env.AUTH_COOKIE ? process.env.AUTH_COOKIE.split(',').map(c => c.trim()) : [],
    fromDB: [], // Se actualizará dinámicamente
    premium: [], // Cookies premium (solo en modo privilegiado)
    normal: []   // Cookies normales (solo en modo privilegiado)
};

// Método para obtener todas las cookies combinadas
const getAllAuthCookies = () => {
    const combined = [..._authCookies.fromEnv, ..._authCookies.fromDB];
    return combined.length > 0 ? combined.join(',') : null;
};

// Método para actualizar las cookies de la base de datos
const updateDBAuthCookies = (cookies, premiumCookies = []) => {
    if (process.env.IS_PRIV === 'true' && Array.isArray(premiumCookies)) {
        // En modo privilegiado, separamos las cookies por tipo
        _authCookies.fromDB = Array.isArray(cookies) ? cookies : [];
        _authCookies.premium = premiumCookies;
        _authCookies.normal = Array.isArray(cookies) ? cookies : [];
    } else {
        // En modo normal, todas las cookies van a fromDB
        _authCookies.fromDB = Array.isArray(cookies) ? cookies : [];
        _authCookies.premium = [];
        _authCookies.normal = [];
    }
};

// Método para obtener las cookies del entorno
const getEnvAuthCookies = () => {
    return process.env.AUTH_COOKIE ? process.env.AUTH_COOKIE.split(',').map(c => c.trim()) : [];
};

// Método para obtener todas las cookies premium
const getPremiumAuthCookies = () => {
    if (process.env.IS_PRIV !== 'true') return getAllAuthCookies();
    return _authCookies.premium.length > 0 ? _authCookies.premium.join(',') : null;
};

// Método para obtener todas las cookies normales
const getNormalAuthCookies = () => {
    if (process.env.IS_PRIV !== 'true') return getAllAuthCookies();
    return _authCookies.normal.length > 0 ? _authCookies.normal.join(',') : null;
};

const config = {
    port: process.env.PORT || 3010,
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    // Modo privilegiado para habilitar cookies premium
    isPrivilegedMode: process.env.IS_PRIV === 'true' || false,
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
    getPremiumAuthCookies,
    getNormalAuthCookies,
    
    // Propiedad para compatibilidad con código existente
    get authCookie() {
        return getAllAuthCookies();
    },
    
    // Modelos que requieren cookies premium
    premiumModels: ['claude-4-sonnet', 'claude-4-sonnet-thinking']
};

module.exports = config;
