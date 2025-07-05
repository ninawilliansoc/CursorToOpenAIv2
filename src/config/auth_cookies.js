const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const cron = require('node-cron');

// Ruta del archivo JSON para persistencia
const DB_FILE_PATH = path.join(__dirname, '../../data/auth_cookies.json');

// Sistema de base de datos en memoria con persistencia JSON
class AuthCookieDatabase {
    constructor() {
        this.authCookies = new Map();
        this.loadFromFile();
        this.setupRecoveryTesting();
    }

    // Cargar datos desde archivo JSON
    loadFromFile() {
        try {
            // Crear directorio data si no existe
            const dataDir = path.dirname(DB_FILE_PATH);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Cargar archivo si existe
            if (fs.existsSync(DB_FILE_PATH)) {
                const data = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8'));
                
                // Cargar AUTH_COOKIEs
                if (data.authCookies) {
                    this.authCookies = new Map(data.authCookies);
                }
                
                console.log(`[DB] Cargadas ${this.authCookies.size} AUTH_COOKIEs desde ${DB_FILE_PATH}`);
            } else {
                console.log('[DB] No se encontró archivo de AUTH_COOKIEs, iniciando con datos vacíos');
                this.saveToFile(); // Crear archivo vacío
            }
        } catch (error) {
            console.error('[DB] Error al cargar base de datos de AUTH_COOKIEs:', error.message);
            console.log('[DB] Iniciando con datos vacíos');
            this.saveToFile(); // Crear archivo vacío
        }

        // Actualizar la configuración con las cookies de la base de datos
        this.updateConfigAuthCookies();
    }

    // Guardar datos en archivo JSON
    saveToFile() {
        try {
            const data = {
                authCookies: Array.from(this.authCookies.entries()),
                savedAt: new Date().toISOString()
            };
            
            fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2));
            console.log(`[DB] Base de datos de AUTH_COOKIEs guardada en ${DB_FILE_PATH}`);
        } catch (error) {
            console.error('[DB] Error al guardar base de datos de AUTH_COOKIEs:', error.message);
        }
    }

    // Actualizar la configuración con las cookies de la base de datos
    updateConfigAuthCookies() {
        // Si estamos en modo privilegiado, separamos las cookies por tipo
        if (config.isPrivilegedMode) {
            const normalCookies = this.getAllAuthCookies()
                .filter(cookie => cookie.enabled && !cookie.rateLimited && cookie.type === 'normal')
                .map(cookie => cookie.value);
                
            const premiumCookies = this.getAllAuthCookies()
                .filter(cookie => cookie.enabled && !cookie.rateLimited && cookie.type === 'premium')
                .map(cookie => cookie.value);
            
            if (typeof config.updateDBAuthCookies === 'function') {
                config.updateDBAuthCookies(normalCookies, premiumCookies);
            }
        } else {
            // En modo normal, enviamos todas las cookies como normales
            const enabledCookies = this.getAllAuthCookies()
                .filter(cookie => cookie.enabled && !cookie.rateLimited)
                .map(cookie => cookie.value);
            
            if (typeof config.updateDBAuthCookies === 'function') {
                config.updateDBAuthCookies(enabledCookies);
            }
        }
    }

    // Exportar datos a JSON (para descarga)
    exportToJSON() {
        const data = {
            authCookies: Array.from(this.authCookies.entries()),
            exportedAt: new Date().toISOString(),
            version: "1.0"
        };
        return JSON.stringify(data, null, 2);
    }

    // Importar datos desde JSON
    importFromJSON(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            let importedCookies = 0;
            
            // Importar AUTH_COOKIEs
            if (data.authCookies && Array.isArray(data.authCookies)) {
                for (const [id, cookieData] of data.authCookies) {
                    // Verificar que no exista ya una cookie con el mismo valor
                    const existingCookie = this.getAuthCookieByValue(cookieData.value);
                    if (!existingCookie) {
                        this.authCookies.set(id, cookieData);
                        importedCookies++;
                    }
                }
            }
            
            // Guardar cambios
            this.saveToFile();
            
            // Actualizar la configuración
            this.updateConfigAuthCookies();
            
            return {
                success: true,
                importedCookies,
                message: `Se importaron ${importedCookies} AUTH_COOKIEs exitosamente`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Crear una nueva AUTH_COOKIE
    createAuthCookie(name, value, description = '', type = 'normal') {
        const id = uuidv4();
        const cookieData = {
            id,
            name,
            value,
            description,
            // Si el modo privilegiado está activado, usar el tipo proporcionado
            // De lo contrario, siempre usar 'normal'
            type: config.isPrivilegedMode ? type : 'normal',
            enabled: true,
            rateLimited: false,
            rateLimitedAt: null,
            nextTestAt: null,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            usageCount: 0
        };
        
        this.authCookies.set(id, cookieData);
        
        // Guardar automáticamente
        this.saveToFile();
        
        // Actualizar la configuración
        this.updateConfigAuthCookies();
        
        return cookieData;
    }

    // Obtener todas las AUTH_COOKIEs
    getAllAuthCookies() {
        return Array.from(this.authCookies.values());
    }

    // Obtener AUTH_COOKIE por ID
    getAuthCookieById(id) {
        return this.authCookies.get(id);
    }

    // Obtener AUTH_COOKIE por su valor
    getAuthCookieByValue(value) {
        for (let [id, data] of this.authCookies.entries()) {
            if (data.value === value && data.enabled && !data.rateLimited) {
                return data;
            }
        }
        return null;
    }
    
    // Obtener AUTH_COOKIE por tipo
    getAuthCookiesByType(type) {
        return Array.from(this.authCookies.values())
            .filter(cookie => cookie.type === type && cookie.enabled && !cookie.rateLimited);
    }
    
    // Obtener una AUTH_COOKIE disponible por tipo
    getAvailableAuthCookieByType(type) {
        const cookies = this.getAuthCookiesByType(type);
        if (cookies.length === 0) return null;
        
        // Si hay cookies disponibles, devolver una aleatoria
        const randomIndex = Math.floor(Math.random() * cookies.length);
        return cookies[randomIndex];
    }

    // Actualizar AUTH_COOKIE
    updateAuthCookie(id, updates) {
        const existing = this.authCookies.get(id);
        if (!existing) return null;
        
        const updated = { ...existing, ...updates };
        this.authCookies.set(id, updated);
        
        // Guardar automáticamente
        this.saveToFile();
        
        // Actualizar la configuración
        this.updateConfigAuthCookies();
        
        return updated;
    }

    // Eliminar AUTH_COOKIE
    deleteAuthCookie(id) {
        const existing = this.authCookies.get(id);
        if (!existing) return false;
        
        this.authCookies.delete(id);
        
        // Guardar automáticamente
        this.saveToFile();
        
        // Actualizar la configuración
        this.updateConfigAuthCookies();
        
        return true;
    }

    // Registrar uso de una AUTH_COOKIE
    recordUsage(id) {
        const cookieData = this.getAuthCookieById(id);
        if (!cookieData) return false;

        const now = new Date();
        
        // Actualizar estadísticas de la cookie
        cookieData.lastUsed = now.toISOString();
        cookieData.usageCount = (cookieData.usageCount || 0) + 1;
        
        this.authCookies.set(id, cookieData);
        
        // Guardar cambios cada 10 usos para no saturar el disco
        if (Math.random() < 0.1) {
            this.saveToFile();
        }
        
        return true;
    }
    
    // Marcar una AUTH_COOKIE como rate-limited
    markAsRateLimited(id) {
        const cookieData = this.getAuthCookieById(id);
        if (!cookieData) return false;
        
        const now = new Date();
        const nextTest = new Date(now);
        nextTest.setHours(nextTest.getHours() + 2); // Próxima prueba en 2 horas
        
        cookieData.rateLimited = true;
        cookieData.rateLimitedAt = now.toISOString();
        cookieData.nextTestAt = nextTest.toISOString();
        
        this.authCookies.set(id, cookieData);
        this.saveToFile();
        
        console.log(`[AUTH] Cookie ${cookieData.name} (${id.substring(0, 8)}...) marcada como rate-limited hasta ${new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()}`);
        
        // Actualizar la configuración
        this.updateConfigAuthCookies();
        
        return true;
    }
    
    // Marcar una AUTH_COOKIE como no rate-limited
    clearRateLimit(id) {
        const cookieData = this.getAuthCookieById(id);
        if (!cookieData) return false;
        
        cookieData.rateLimited = false;
        cookieData.rateLimitedAt = null;
        cookieData.nextTestAt = null;
        
        this.authCookies.set(id, cookieData);
        this.saveToFile();
        
        console.log(`[AUTH] Cookie ${cookieData.name} (${id.substring(0, 8)}...) ha sido reactivada`);
        
        // Actualizar la configuración
        this.updateConfigAuthCookies();
        
        return true;
    }
    
    // Obtener todas las AUTH_COOKIEs rate-limited que necesitan ser probadas
    getCookiesForTesting() {
        const now = new Date();
        return Array.from(this.authCookies.values()).filter(cookie => {
            return cookie.rateLimited && 
                   cookie.nextTestAt && 
                   new Date(cookie.nextTestAt) <= now;
        });
    }
    
    // Actualizar la hora de la próxima prueba para una AUTH_COOKIE
    updateNextTestTime(id) {
        const cookieData = this.getAuthCookieById(id);
        if (!cookieData || !cookieData.rateLimited) return false;
        
        const nextTest = new Date();
        nextTest.setHours(nextTest.getHours() + 2); // Próxima prueba en 2 horas
        
        cookieData.nextTestAt = nextTest.toISOString();
        
        this.authCookies.set(id, cookieData);
        this.saveToFile();
        
        return true;
    }
    
    // Verificar y limpiar rate limits expirados (más de 12 horas)
    checkExpiredRateLimits() {
        const now = new Date();
        let updated = false;
        
        Array.from(this.authCookies.entries()).forEach(([id, cookie]) => {
            if (cookie.rateLimited && cookie.rateLimitedAt) {
                const limitedAt = new Date(cookie.rateLimitedAt);
                const hoursElapsed = (now - limitedAt) / (1000 * 60 * 60);
                
                if (hoursElapsed >= 12) {
                    console.log(`[AUTH] Reactivando cookie ${cookie.name} (${id.substring(0, 8)}...) después de 12 horas de rate limit`);
                    cookie.rateLimited = false;
                    cookie.rateLimitedAt = null;
                    cookie.nextTestAt = null;
                    this.authCookies.set(id, cookie);
                    updated = true;
                }
            }
        });
        
        if (updated) {
            this.saveToFile();
            this.updateConfigAuthCookies();
        }
        
        return updated;
    }
    
    // Configurar el trabajo de prueba de recuperación
    setupRecoveryTesting() {
        // Verificar dependencia de node-cron
        try {
            // Verificar cada 10 minutos si hay cookies para probar
            cron.schedule('*/10 * * * *', async () => {
                try {
                    // Verificar cookies con rate limit expirado (12 horas)
                    this.checkExpiredRateLimits();
                    
                    // Obtener cookies que necesitan ser probadas
                    const cookiesForTesting = this.getCookiesForTesting();
                    
                    if (cookiesForTesting.length > 0) {
                        console.log(`[AUTH] Encontradas ${cookiesForTesting.length} cookies para probar automáticamente`);
                        
                        // Importar la función de prueba de cookies
                        const { testRateLimitedCookie } = require('../utils/utils');
                        
                        // Probar cada cookie
                        for (const cookie of cookiesForTesting) {
                            console.log(`[AUTH] Probando cookie rate-limited: ${cookie.name} (${cookie.id.substring(0, 8)}...)`);
                            
                            try {
                                const isWorking = await testRateLimitedCookie(cookie.id);
                                if (isWorking) {
                                    console.log(`[AUTH] La cookie ${cookie.name} ha sido reactivada automáticamente`);
                                } else {
                                    console.log(`[AUTH] La cookie ${cookie.name} sigue rate-limited, próxima prueba en 2 horas`);
                                }
                            } catch (error) {
                                console.error(`[AUTH] Error al probar la cookie ${cookie.name}:`, error.message);
                                // Actualizar el tiempo de la próxima prueba
                                this.updateNextTestTime(cookie.id);
                            }
                        }
                    }
                } catch (error) {
                    console.error('[AUTH] Error en la verificación programada de cookies rate-limited:', error.message);
                }
            });
            
            console.log('[AUTH] Sistema de recuperación automática de cookies configurado (cada 10 minutos)');
        } catch (error) {
            console.error('[AUTH] Error al configurar el sistema de recuperación automática:', error.message);
            console.log('[AUTH] Instale node-cron para habilitar la recuperación automática: npm install node-cron');
        }
    }

    // Obtener estadísticas generales
    getGeneralStats() {
        const cookies = Array.from(this.authCookies.values());
        const totalCookies = this.authCookies.size;
        const enabledCookies = cookies.filter(c => c.enabled).length;
        const rateLimitedCookies = cookies.filter(c => c.rateLimited).length;
        const availableCookies = cookies.filter(c => c.enabled && !c.rateLimited).length;
        
        // Estadísticas por tipo (solo en modo privilegiado)
        let normalCookies = 0;
        let premiumCookies = 0;
        
        if (config.isPrivilegedMode) {
            normalCookies = cookies.filter(c => c.type === 'normal' && c.enabled && !c.rateLimited).length;
            premiumCookies = cookies.filter(c => c.type === 'premium' && c.enabled && !c.rateLimited).length;
        }
        
        return {
            totalCookies,
            enabledCookies,
            rateLimitedCookies,
            availableCookies,
            normalCookies: config.isPrivilegedMode ? normalCookies : availableCookies,
            premiumCookies: config.isPrivilegedMode ? premiumCookies : 0
        };
    }

    // Limpiar todas las AUTH_COOKIEs (para reset)
    clearAll() {
        this.authCookies.clear();
        this.saveToFile();
        this.updateConfigAuthCookies();
    }
}

// Instancia singleton
const authCookieDB = new AuthCookieDatabase();

module.exports = authCookieDB;
