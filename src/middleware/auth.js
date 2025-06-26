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