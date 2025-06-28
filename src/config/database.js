const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Ruta del archivo JSON para persistencia
const DB_FILE_PATH = path.join(__dirname, '../../data/api_keys.json');

// Sistema de base de datos en memoria con persistencia JSON
class APIKeyDatabase {
    constructor() {
        this.apiKeys = new Map();
        this.usage = new Map(); // Almacena estadísticas de uso por API key
        this.loadFromFile();
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
                
    // Cargar API keys
                if (data.apiKeys) {
                    // Asegurar que todas las keys tengan las propiedades de rate limit
                    const completeApiKeys = data.apiKeys.map(([id, keyData]) => {
                        return [id, {
                            ...keyData,
                            // Agregar propiedades de rate limit si no existen
                            exemptFromRateLimit: keyData.exemptFromRateLimit !== undefined ? keyData.exemptFromRateLimit : false,
                            rateLimitHistory: keyData.rateLimitHistory || [],
                            rateLimitUntil: keyData.rateLimitUntil || null,
                            rateLimitLevel: keyData.rateLimitLevel !== undefined ? keyData.rateLimitLevel : 0
                        }];
                    });
                    this.apiKeys = new Map(completeApiKeys);
                }
                
                // Cargar estadísticas de uso
                if (data.usage) {
                    this.usage = new Map();
                    for (const [key, usage] of data.usage) {
                        this.usage.set(key, {
                            ...usage,
                            dailyUsage: new Map(usage.dailyUsage || [])
                        });
                    }
                }
                
                console.log(`[DB] Cargadas ${this.apiKeys.size} API keys desde ${DB_FILE_PATH}`);
            } else {
                console.log('[DB] No se encontró archivo de base de datos, iniciando con datos vacíos');
            }
        } catch (error) {
            console.error('[DB] Error al cargar base de datos:', error.message);
            console.log('[DB] Iniciando con datos vacíos');
        }
    }

    // Guardar datos en archivo JSON
    saveToFile() {
        try {
            const data = {
                apiKeys: Array.from(this.apiKeys.entries()),
                usage: Array.from(this.usage.entries()).map(([key, usage]) => [
                    key,
                    {
                        ...usage,
                        dailyUsage: Array.from(usage.dailyUsage.entries())
                    }
                ]),
                savedAt: new Date().toISOString()
            };
            
            fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2));
            console.log(`[DB] Base de datos guardada en ${DB_FILE_PATH}`);
        } catch (error) {
            console.error('[DB] Error al guardar base de datos:', error.message);
        }
    }

    // Exportar datos a JSON (para descarga)
    exportToJSON() {
        const data = {
            apiKeys: Array.from(this.apiKeys.entries()),
            usage: Array.from(this.usage.entries()).map(([key, usage]) => [
                key,
                {
                    ...usage,
                    dailyUsage: Array.from(usage.dailyUsage.entries())
                }
            ]),
            exportedAt: new Date().toISOString(),
            version: "1.0"
        };
        return JSON.stringify(data, null, 2);
    }

    // Importar datos desde JSON
    importFromJSON(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            let importedKeys = 0;
            
            // Importar API keys
            if (data.apiKeys && Array.isArray(data.apiKeys)) {
                for (const [id, keyData] of data.apiKeys) {
                    // Verificar que no exista ya una key con el mismo valor
                    const existingKey = this.getAPIKeyByValue(keyData.apiKey);
                    if (!existingKey) {
                        // Asegurar que las propiedades de rate limit existan
                        const completeKeyData = {
                            ...keyData,
                            // Siempre habilitar rate limit para keys importadas
                            exemptFromRateLimit: false,
                            rateLimitHistory: keyData.rateLimitHistory || [],
                            rateLimitUntil: keyData.rateLimitUntil || null,
                            rateLimitLevel: keyData.rateLimitLevel !== undefined ? keyData.rateLimitLevel : 0
                        };
                        
                        this.apiKeys.set(id, completeKeyData);
                        importedKeys++;
                    }
                }
            }
            
            // Importar estadísticas de uso
            if (data.usage && Array.isArray(data.usage)) {
                for (const [key, usage] of data.usage) {
                    if (this.getAPIKeyByValue(key)) {
                        this.usage.set(key, {
                            ...usage,
                            dailyUsage: new Map(usage.dailyUsage || [])
                        });
                    }
                }
            }
            
            // Guardar cambios
            this.saveToFile();
            
            return {
                success: true,
                importedKeys,
                message: `Se importaron ${importedKeys} API keys exitosamente`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Crear una nueva API key
    createAPIKey(name, description = '') {
        const id = uuidv4();
        const apiKey = `sk-${uuidv4().replace(/-/g, '')}`;
        const keyData = {
            id,
            name,
            description,
            apiKey,
            enabled: true,
            exemptFromRateLimit: false,
            rateLimitHistory: [],
            rateLimitUntil: null,
            rateLimitLevel: 0,
            createdAt: new Date().toISOString(),
            lastUsed: null,
            totalRequests: 0
        };
        
        this.apiKeys.set(id, keyData);
        this.usage.set(apiKey, {
            requests: 0,
            lastRequest: null,
            dailyUsage: new Map() // Fecha -> número de requests
        });
        
        // Guardar automáticamente
        this.saveToFile();
        
        return keyData;
    }

    // Obtener todas las API keys
    getAllAPIKeys() {
        return Array.from(this.apiKeys.values());
    }

    // Obtener API key por ID
    getAPIKeyById(id) {
        return this.apiKeys.get(id);
    }

    // Obtener API key por su valor
    getAPIKeyByValue(apiKey) {
        for (let [id, data] of this.apiKeys.entries()) {
            if (data.apiKey === apiKey && data.enabled) {
                return data;
            }
        }
        return null;
    }

    // Actualizar API key
    updateAPIKey(id, updates) {
        const existing = this.apiKeys.get(id);
        if (!existing) return null;
        
        const updated = { ...existing, ...updates };
        this.apiKeys.set(id, updated);
        
        // Guardar automáticamente
        this.saveToFile();
        
        return updated;
    }

    // Eliminar API key
    deleteAPIKey(id) {
        const existing = this.apiKeys.get(id);
        if (!existing) return false;
        
        this.apiKeys.delete(id);
        this.usage.delete(existing.apiKey);
        
        // Guardar automáticamente
        this.saveToFile();
        
        return true;
    }

    // Registrar uso de una API key
    recordUsage(apiKey) {
        const keyData = this.getAPIKeyByValue(apiKey);
        if (!keyData) return false;

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Actualizar estadísticas de la key
        keyData.lastUsed = now.toISOString();
        keyData.totalRequests++;
        
        // Asegurar que todas las propiedades de rate limit existan
        if (keyData.exemptFromRateLimit === undefined) {
            keyData.exemptFromRateLimit = false;
        }
        
        // Actualizar historial de rate limit
        if (!keyData.rateLimitHistory) {
            keyData.rateLimitHistory = [];
        }
        
        if (keyData.rateLimitUntil === undefined) {
            keyData.rateLimitUntil = null;
        }
        
        if (keyData.rateLimitLevel === undefined) {
            keyData.rateLimitLevel = 0;
        }
        
        // Añadir la marca de tiempo actual al historial
        keyData.rateLimitHistory.push({
            timestamp: now.toISOString()
        });
        
        // Mantener solo las últimas 10 solicitudes en el historial
        if (keyData.rateLimitHistory.length > 10) {
            keyData.rateLimitHistory = keyData.rateLimitHistory.slice(-10);
        }
        
        this.apiKeys.set(keyData.id, keyData);
        
        // Actualizar estadísticas de uso
        const usage = this.usage.get(apiKey);
        if (usage) {
            usage.requests++;
            usage.lastRequest = now.toISOString();
            
            // Actualizar uso diario
            const currentDaily = usage.dailyUsage.get(today) || 0;
            usage.dailyUsage.set(today, currentDaily + 1);
            
            // Limpiar datos antiguos (mantener solo últimos 30 días)
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
            
            for (let [date] of usage.dailyUsage) {
                if (date < thirtyDaysAgoStr) {
                    usage.dailyUsage.delete(date);
                }
            }
        }
        
        // Guardar cambios cada 10 requests para no saturar el disco
        if (keyData.totalRequests % 10 === 0) {
            this.saveToFile();
        }
        
        return true;
    }

    // Obtener estadísticas de uso de una API key
    getUsageStats(apiKey) {
        const usage = this.usage.get(apiKey);
        const keyData = this.getAPIKeyByValue(apiKey);
        
        if (!usage || !keyData) return null;
        
        return {
            keyName: keyData.name,
            totalRequests: keyData.totalRequests,
            lastUsed: keyData.lastUsed,
            dailyUsage: Object.fromEntries(usage.dailyUsage)
        };
    }

    // Obtener estadísticas generales
    getGeneralStats() {
        const totalKeys = this.apiKeys.size;
        const enabledKeys = Array.from(this.apiKeys.values()).filter(k => k.enabled).length;
        const totalRequests = Array.from(this.apiKeys.values()).reduce((sum, k) => sum + k.totalRequests, 0);
        const rateLimitedKeys = Array.from(this.apiKeys.values()).filter(k => k.rateLimitUntil && new Date(k.rateLimitUntil) > new Date()).length;
        
        const today = new Date().toISOString().split('T')[0];
        let todayRequests = 0;
        
        for (let usage of this.usage.values()) {
            todayRequests += usage.dailyUsage.get(today) || 0;
        }
        
        return {
            totalKeys,
            enabledKeys,
            totalRequests,
            todayRequests,
            rateLimitedKeys
        };
    }
    
    // Comprobar si una API key está actualmente limitada por rate limit
    isRateLimited(apiKey) {
        const keyData = this.getAPIKeyByValue(apiKey);
        if (!keyData) return { limited: true, reason: 'API key inválida' };
        
        // Si la key está exenta de rate limits, siempre devolver false
        if (keyData.exemptFromRateLimit) {
            return { limited: false };
        }
        
        // Comprobar si hay un rate limit activo
        if (keyData.rateLimitUntil) {
            const now = new Date();
            const limitUntil = new Date(keyData.rateLimitUntil);
            
            if (now < limitUntil) {
                // Calcular tiempo restante en minutos
                const remainingMs = limitUntil - now;
                const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
                
                return {
                    limited: true,
                    until: keyData.rateLimitUntil,
                    remainingMinutes,
                    level: keyData.rateLimitLevel
                };
            }
        }
        
        return { limited: false };
    }
    
    // Comprobar y aplicar rate limit si es necesario
    checkAndApplyRateLimit(apiKey) {
        const keyData = this.getAPIKeyByValue(apiKey);
        if (!keyData) return { limited: true, reason: 'API key inválida' };
        
        // Si la key está exenta de rate limits, siempre permitir
        if (keyData.exemptFromRateLimit) {
            return { limited: false };
        }
        
        const now = new Date();
        
        // Comprobar si hay un rate limit activo
        if (keyData.rateLimitUntil) {
            const limitUntil = new Date(keyData.rateLimitUntil);
            
            if (now < limitUntil) {
                // Si intenta usar la API durante un rate limit, aumentar el nivel
                const newLevel = Math.min(keyData.rateLimitLevel + 1, 3); // Máximo nivel 3
                let newDuration;
                
                switch (newLevel) {
                    case 1: newDuration = 1 * 60 * 1000; break;  // 1 minuto
                    case 2: newDuration = 5 * 60 * 1000; break;  // 5 minutos
                    case 3: newDuration = 20 * 60 * 1000; break; // 20 minutos
                    default: newDuration = 60 * 60 * 1000;       // 1 hora
                }
                
                const newLimitUntil = new Date(now.getTime() + newDuration);
                
                // Actualizar el rate limit
                keyData.rateLimitLevel = newLevel;
                keyData.rateLimitUntil = newLimitUntil.toISOString();
                this.apiKeys.set(keyData.id, keyData);
                this.saveToFile();
                
                // Calcular tiempo restante en minutos
                const remainingMinutes = Math.ceil(newDuration / (1000 * 60));
                
                return {
                    limited: true,
                    until: keyData.rateLimitUntil,
                    remainingMinutes,
                    level: newLevel,
                    escalated: true
                };
            } else {
                // Si el rate limit ha expirado, reiniciarlo
                keyData.rateLimitUntil = null;
                keyData.rateLimitLevel = 0;
            }
        }
        
        // Comprobar si ha hecho 3 solicitudes en menos de 2 minutos
        if (keyData.rateLimitHistory && keyData.rateLimitHistory.length >= 3) {
            const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
            const recentRequests = keyData.rateLimitHistory
                .filter(req => new Date(req.timestamp) > twoMinutesAgo)
                .length;
            
            if (recentRequests >= 3) {
                // Aplicar rate limit de 1 minuto
                const limitUntil = new Date(now.getTime() + 1 * 60 * 1000);
                keyData.rateLimitUntil = limitUntil.toISOString();
                keyData.rateLimitLevel = 1;
                this.apiKeys.set(keyData.id, keyData);
                this.saveToFile();
                
                return {
                    limited: true,
                    until: keyData.rateLimitUntil,
                    remainingMinutes: 1,
                    level: 1,
                    escalated: false
                };
            }
        }
        
        return { limited: false };
    }
    
    // Resetear el rate limit de una API key
    resetRateLimit(id) {
        const keyData = this.apiKeys.get(id);
        if (!keyData) return false;
        
        keyData.rateLimitUntil = null;
        keyData.rateLimitLevel = 0;
        this.apiKeys.set(id, keyData);
        this.saveToFile();
        
        return true;
    }
    
    // Obtener todas las API keys actualmente limitadas por rate limit
    getRateLimitedKeys() {
        const now = new Date();
        const limitedKeys = [];
        
        for (let [id, keyData] of this.apiKeys.entries()) {
            if (keyData.rateLimitUntil && new Date(keyData.rateLimitUntil) > now) {
                const remainingMs = new Date(keyData.rateLimitUntil) - now;
                const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
                
                limitedKeys.push({
                    ...keyData,
                    remainingMinutes
                });
            }
        }
        
        return limitedKeys;
    }

    // Limpiar todas las API keys (para reset)
    clearAll() {
        this.apiKeys.clear();
        this.usage.clear();
        this.saveToFile();
    }
    
}

// Instancia singleton
const db = new APIKeyDatabase();

module.exports = db;
