const bcrypt = require('bcryptjs');
const config = require('../config/config');
const db = require('../config/database');
const authCookieDB = require('../config/auth_cookies');

// Middleware para verificar API keys y configurar reintentos
function verifyAPIKey(options = {}) {
    // Opciones por defecto
    const { recordUsage = true } = options;
    
    return (req, res, next) => {
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
        
        // Registrar el uso de la API key solo si se especifica
        if (recordUsage) {
            db.recordUsage(apiKey);
            console.log(`[AUTH] Registrando uso de API key: ${keyData.name}`);
        } else {
            console.log(`[AUTH] Omitiendo registro de uso para API key: ${keyData.name} (ruta exenta)`);
        }
        
        // Agregar información de la key al request
        req.apiKey = keyData;
        req.isAPIKeyAuth = true;
        
        next();
    };
}

// Función para realizar reintentos en caso de error
async function retryOnError(fn, maxRetries = 20, rawAuthToken = null) {
    let lastError;
    let currentAuthToken = rawAuthToken;
    const utils = require('../utils/utils.js');
    
    // Contador de intentos totales para evitar bucles infinitos
    let totalAttempts = 0;
    const MAX_TOTAL_ATTEMPTS = 50;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fn(currentAuthToken);
            
            // Verificar si es una respuesta HTTP y si es exitosa (código 200)
            if (response && response.status === 200 && typeof response.body !== 'undefined') {
                // Intentar leer el primer chunk para verificar si hay rate limit
                try {
                    const reader = response.body.getReader();
                    const { value, done } = await reader.read();
                    
                    if (!done && value) {
                        // Convertir el chunk a string y verificar si contiene el mensaje de rate limit
                        const chunk = Buffer.from(value).toString('hex');
                        const { isRateLimited } = utils.chunkToUtf8String(chunk);
                        
                        if (isRateLimited) {
                            console.log('[RETRY] Detectado mensaje de rate limit en la respuesta (formato detectado)');
                            
                            // Si tenemos un token de autenticación, marcar la cookie como rate-limited
                            if (currentAuthToken) {
                                // Buscar la cookie en la base de datos
                                const keys = currentAuthToken.split(',').map(key => key.trim());
                                const processedCurrentToken = utils.processAuthToken(currentAuthToken);
                                
                                // Buscar la cookie en la base de datos por su valor
                                for (const cookie of authCookieDB.getAllAuthCookies()) {
                                    const processedCookieValue = utils.processAuthToken(cookie.value);
                                    
                                    if (cookie.value === processedCurrentToken || processedCookieValue === processedCurrentToken) {
                                        console.log(`[RETRY] Marcando cookie ${cookie.name} (${cookie.id.substring(0, 8)}...) como rate-limited`);
                                        authCookieDB.markAsRateLimited(cookie.id);
                                        break;
                                    }
                                }
                                
                                // Marcar el token actual como fallido
                                utils.markTokenAsFailed(currentAuthToken);
                                
                                // Obtener el siguiente token disponible (con delay incorporado)
                                currentAuthToken = await utils.getNextAuthToken(currentAuthToken);
                                
                                console.log(`[RETRY] Intento ${attempt + 1}/${maxRetries}: Rotando a siguiente auth_cookie después de rate limit`);
                                
                                // Crear un nuevo stream con el mismo contenido para devolver
                                const newStream = new ReadableStream({
                                    start(controller) {
                                        controller.enqueue(value);
                                        controller.close();
                                    }
                                });
                                
                                // Incrementar contador de intentos totales
                                totalAttempts++;
                                
                                // Verificar si hemos alcanzado el límite máximo de intentos totales
                                if (totalAttempts > MAX_TOTAL_ATTEMPTS) {
                                    console.log(`[RETRY] Alcanzado el límite máximo de ${MAX_TOTAL_ATTEMPTS} intentos totales, abortando`);
                                    throw new Error('Se alcanzó el límite máximo de intentos totales');
                                }
                                
                                // Reintentar con la nueva cookie
                                continue;
                            }
                        }
                        
                        // Si no hay rate limit, devolver la respuesta original con un nuevo stream
                        const newStream = new ReadableStream({
                            start(controller) {
                                controller.enqueue(value);
                                
                                // Transferir el resto del stream original al nuevo stream
                                const pump = () => {
                                    reader.read().then(({ value, done }) => {
                                        if (done) {
                                            controller.close();
                                            return;
                                        }
                                        controller.enqueue(value);
                                        pump();
                                    }).catch(error => {
                                        controller.error(error);
                                    });
                                };
                                
                                pump();
                            }
                        });
                        
                        // Crear una nueva respuesta con el nuevo stream
                        return new Response(newStream, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }
                } catch (streamError) {
                    console.error('[RETRY] Error al leer el stream:', streamError);
                    // Si hay un error al leer el stream, devolver la respuesta original
                }
            }
            
            // Si no es una respuesta HTTP o no tiene body, devolver la respuesta original
            return response;
        } catch (error) {
            lastError = error;
            
            // Incrementar contador de intentos totales
            totalAttempts++;
            
            // Verificar si hemos alcanzado el límite máximo de intentos totales
            if (totalAttempts > MAX_TOTAL_ATTEMPTS) {
                console.log(`[RETRY] Alcanzado el límite máximo de ${MAX_TOTAL_ATTEMPTS} intentos totales, abortando`);
                throw new Error('Se alcanzó el límite máximo de intentos totales');
            }
            
            // Si tenemos un token de autenticación, intentar rotar a la siguiente cookie
            if (currentAuthToken) {
                // Marcar el token actual como fallido
                utils.markTokenAsFailed(currentAuthToken);
                
                // Obtener el siguiente token disponible (con delay incorporado)
                currentAuthToken = await utils.getNextAuthToken(currentAuthToken);
                
                console.log(`[RETRY] Intento ${attempt + 1}/${maxRetries} (total: ${totalAttempts}): Rotando a siguiente auth_cookie después de error`);
            } else {
                console.log(`[RETRY] Intento ${attempt + 1}/${maxRetries} (total: ${totalAttempts}): Reintentando después de error`);
            }
            
            // Esperar un poco antes de reintentar (puedes ajustar el tiempo)
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Si llegamos aquí, todos los reintentos fallaron
    throw lastError;
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
    verifyAdminPassword,
    retryOnError
};
