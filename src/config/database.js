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
                    this.apiKeys = new Map(data.apiKeys);
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
                        this.apiKeys.set(id, keyData);
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
        
        const today = new Date().toISOString().split('T')[0];
        let todayRequests = 0;
        
        for (let usage of this.usage.values()) {
            todayRequests += usage.dailyUsage.get(today) || 0;
        }
        
        return {
            totalKeys,
            enabledKeys,
            totalRequests,
            todayRequests
        };
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