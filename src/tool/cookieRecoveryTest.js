/**
 * Script para probar cookies rate-limited y reactivarlas si ya no están limitadas
 * Este script puede ser ejecutado manualmente o programado con cron
 */

const authCookieDB = require('../config/auth_cookies');
// Importar funciones necesarias
const { testRateLimitedCookie } = require('../utils/utils');

async function testRateLimitedCookies() {
    console.log('[RECOVERY] Iniciando prueba de cookies rate-limited...');
    
    // Obtener todas las cookies que necesitan ser probadas
    const cookiesForTesting = authCookieDB.getCookiesForTesting();
    
    if (cookiesForTesting.length === 0) {
        console.log('[RECOVERY] No hay cookies rate-limited que necesiten ser probadas');
        return;
    }
    
    console.log(`[RECOVERY] Encontradas ${cookiesForTesting.length} cookies para probar`);
    
    // Probar cada cookie
    for (const cookie of cookiesForTesting) {
        console.log(`[RECOVERY] Probando cookie: ${cookie.name} (${cookie.id.substring(0, 8)}...)`);
        
        try {
            const isWorking = await testRateLimitedCookie(cookie.id);
            
            if (isWorking) {
                console.log(`[RECOVERY] La cookie ${cookie.name} (${cookie.id.substring(0, 8)}...) ha sido reactivada`);
            } else {
                console.log(`[RECOVERY] La cookie ${cookie.name} (${cookie.id.substring(0, 8)}...) sigue rate-limited`);
            }
        } catch (error) {
            console.error(`[RECOVERY] Error al probar la cookie ${cookie.name}:`, error.message);
            // Actualizar el tiempo de la próxima prueba
            authCookieDB.updateNextTestTime(cookie.id);
        }
    }
    
    console.log('[RECOVERY] Prueba de cookies rate-limited completada');
}

// Verificar también cookies que hayan superado el tiempo de rate limit (12 horas)
function checkExpiredRateLimits() {
    console.log('[RECOVERY] Verificando cookies con rate limit expirado...');
    
    const updated = authCookieDB.checkExpiredRateLimits();
    
    if (updated) {
        console.log('[RECOVERY] Se reactivaron cookies con rate limit expirado');
    } else {
        console.log('[RECOVERY] No se encontraron cookies con rate limit expirado');
    }
}

// Ejecutar ambas funciones
async function main() {
    try {
        // Primero verificar cookies con rate limit expirado
        checkExpiredRateLimits();
        
        // Luego probar las cookies que necesitan ser probadas
        await testRateLimitedCookies();
        
        console.log('[RECOVERY] Proceso completado exitosamente');
    } catch (error) {
        console.error('[RECOVERY] Error en el proceso de recuperación:', error.message);
    }
}

// Si se ejecuta directamente, ejecutar la función principal
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testRateLimitedCookies,
    checkExpiredRateLimits,
    main
};
