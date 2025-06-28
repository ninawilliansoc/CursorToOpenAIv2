const bcrypt = require('bcryptjs');
const config = require('../config/config');
const db = require('../config/database');

// Middleware para verificar API keys
function verifyAPIKey(req, res, next) {
    // Primero verificar si hay una API key en el header Authorization
    const authHeader = req.headers.authorization;
    let apiKey = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
    }
    
    // Si no hay API key, usar el comportamiento original (AUTH_COOKIE)
    if (!apiKey) {
        return next();
    }
    
    // Verificar que la API key sea válida
    const keyData = db.getAPIKeyByValue(apiKey);
    if (!keyData || !keyData.enabled) {
        return res.status(401).json({
            error: 'API key inválida o deshabilitada'
        });
    }
    
    // Verificar si la API key está bajo rate limit
    const rateLimit = db.checkAndApplyRateLimit(apiKey);
    if (rateLimit.limited) {
        // Construir mensaje según el nivel de rate limit
        let message;
        switch (rateLimit.level) {
            case 1:
                message = `Has excedido el límite de solicitudes (3 en menos de 2 minutos). Por favor espera ${rateLimit.remainingMinutes} minuto antes de intentar nuevamente.`;
                break;
            case 2:
                message = `Has intentado hacer solicitudes durante un periodo de rate limit. Ahora debes esperar ${rateLimit.remainingMinutes} minutos antes de intentar nuevamente.`;
                break;
            case 3:
                message = `Debido a solicitudes excesivas, ahora debes esperar ${rateLimit.remainingMinutes} minutos antes de intentar nuevamente.`;
                break;
            default:
                message = `Has sido limitado por uso excesivo. Por favor espera ${rateLimit.remainingMinutes} minutos antes de intentar nuevamente.`;
        }
        
        return res.status(429).json({
            error: 'Demasiadas solicitudes',
            message: message,
            retry_after: rateLimit.remainingMinutes * 60 // En segundos
        });
    }
    
    // Registrar el uso de la API key
    db.recordUsage(apiKey);
    
    // Agregar información de la key al request
    req.apiKey = keyData;
    req.isAPIKeyAuth = true;
    
    next();
}

// Middleware para verificar autenticación del admin
function requireAdminAuth(req, res, next) {
    if (!req.session.isAdminAuthenticated) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Acceso no autorizado' });
        }
        return res.redirect('/admin/login');
    }
    next();
}

// Función para verificar contraseña de admin
async function verifyAdminPassword(password) {
    // Si la contraseña en config no está hasheada, compararla directamente
    if (config.adminPassword.length < 60) {
        return password === config.adminPassword;
    }
    
    // Si está hasheada, usar bcrypt
    return await bcrypt.compare(password, config.adminPassword);
}

module.exports = {
    verifyAPIKey,
    requireAdminAuth,
    verifyAdminPassword
};
