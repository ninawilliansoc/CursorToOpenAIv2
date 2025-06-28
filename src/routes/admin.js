const express = require('express');
const router = express.Router();
const { requireAdminAuth, verifyAdminPassword } = require('../middleware/auth');
const db = require('../config/database');

// Página de login
router.get('/login', (req, res) => {
    if (req.session.isAdminAuthenticated) {
        return res.redirect('/admin');
    }
    
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Administración - Login</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
        }
        
        .login-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease;
        }
        
        .login-container:hover {
            transform: translateY(-5px);
        }
        
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
            font-weight: 600;
            background: linear-gradient(45deg, #64b5f6, #42a5f5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #e0e0e0;
        }
        
        input[type="password"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        input[type="password"]:focus {
            outline: none;
            border-color: #64b5f6;
            box-shadow: 0 0 20px rgba(100, 181, 246, 0.3);
        }
        
        input[type="password"]::placeholder {
            color: #b0b0b0;
        }
        
        .btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(45deg, #1976d2, #1565c0);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn:hover {
            background: linear-gradient(45deg, #1565c0, #0d47a1);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(25, 118, 210, 0.4);
        }
        
        .error {
            background: rgba(244, 67, 54, 0.2);
            color: #ffcdd2;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #f44336;
        }
        
        .logo {
            text-align: center;
            margin-bottom: 30px;
            font-size: 48px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">🔐</div>
        <h1>Panel de Administración</h1>
        ${req.query.error ? '<div class="error">Contraseña incorrecta</div>' : ''}
        <form method="POST" action="/admin/login">
            <div class="form-group">
                <label for="password">Contraseña:</label>
                <input type="password" id="password" name="password" placeholder="Ingresa la contraseña de administrador" required>
            </div>
            <button type="submit" class="btn">Iniciar Sesión</button>
        </form>
    </div>
</body>
</html>
    `);
});

// Procesar login
router.post('/login', async (req, res) => {
    const { password } = req.body;
    
    if (await verifyAdminPassword(password)) {
        req.session.isAdminAuthenticated = true;
        res.redirect('/admin');
    } else {
        res.redirect('/admin/login?error=1');
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Dashboard principal
router.get('/', requireAdminAuth, (req, res) => {
    const apiKeys = db.getAllAPIKeys();
    const stats = db.getGeneralStats();
    
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Administración</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #121212;
            color: #ffffff;
            line-height: 1.6;
        }
        
        .navbar {
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            border-bottom: 1px solid #333;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .navbar h1 {
            color: #64b5f6;
            font-size: 24px;
            font-weight: 600;
        }
        
        .nav-buttons {
            display: flex;
            gap: 1rem;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .btn-primary {
            background: linear-gradient(45deg, #1976d2, #1565c0);
            color: white;
        }
        
        .btn-primary:hover {
            background: linear-gradient(45deg, #1565c0, #0d47a1);
            transform: translateY(-2px);
        }
        
        .btn-danger {
            background: linear-gradient(45deg, #d32f2f, #c62828);
            color: white;
        }
        
        .btn-danger:hover {
            background: linear-gradient(45deg, #c62828, #b71c1c);
            transform: translateY(-2px);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: transform 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
        }
        
        .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            color: #64b5f6;
            margin-bottom: 0.5rem;
        }
        
        .stat-label {
            color: #b0b0b0;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .section h2 {
            margin-bottom: 1.5rem;
            color: #64b5f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .table th,
        .table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .table th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: 600;
            color: #64b5f6;
        }
        
        .table tr:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status.enabled {
            background: rgba(76, 175, 80, 0.2);
            color: #a5d6a7;
        }
        
        .status.disabled {
            background: rgba(244, 67, 54, 0.2);
            color: #ffcdd2;
        }
        
        .action-buttons {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn-small {
            padding: 4px 8px;
            font-size: 0.8rem;
            border-radius: 4px;
        }
        
        .btn-success {
            background: #4caf50;
            color: white;
        }
        
        .btn-warning {
            background: #ff9800;
            color: white;
        }
        
        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }
        
        .empty-state i {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .navbar {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>🔑 Panel de Administración</h1>
        <div class="nav-buttons">
            <a href="/admin/create-key" class="btn btn-primary">+ Nueva API Key</a>
            <a href="/admin/keys-ratelimit" class="btn btn-primary">🚦 Gestión de Rate Limits</a>
            <a href="/admin/import-export" class="btn btn-primary">📁 Importar/Exportar</a>
            <form method="POST" action="/admin/logout" style="display: inline;">
                <button type="submit" class="btn btn-danger">Cerrar Sesión</button>
            </form>
        </div>
    </nav>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.totalKeys}</div>
                <div class="stat-label">Total de Keys</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.enabledKeys}</div>
                <div class="stat-label">Keys Activas</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalRequests}</div>
                <div class="stat-label">Requests Totales</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.todayRequests}</div>
                <div class="stat-label">Requests Hoy</div>
            </div>
        </div>
        
        <div class="section">
            <h2>API Keys</h2>
            ${apiKeys.length === 0 ? `
                <div class="empty-state">
                    <i>🔑</i>
                    <h3>No hay API keys creadas</h3>
                    <p>Crea tu primera API key para comenzar</p>
                </div>
            ` : `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Estado</th>
                            <th>Requests</th>
                            <th>Último Uso</th>
                            <th>Creada</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${apiKeys.map(key => `
                            <tr>
                                <td><strong>${key.name}</strong></td>
                                <td>${key.description || '-'}</td>
                                <td><span class="status ${key.enabled ? 'enabled' : 'disabled'}">${key.enabled ? 'Activa' : 'Deshabilitada'}</span></td>
                                <td>${key.totalRequests}</td>
                                <td>${key.lastUsed ? new Date(key.lastUsed).toLocaleString('es-ES') : 'Nunca'}</td>
                                <td>${new Date(key.createdAt).toLocaleString('es-ES')}</td>
                                <td>
                                    <div class="action-buttons">
                                        <a href="/admin/edit-key/${key.id}" class="btn btn-small btn-warning">Editar</a>
                                        <form method="POST" action="/admin/toggle-key/${key.id}" style="display: inline;">
                                            <button type="submit" class="btn btn-small ${key.enabled ? 'btn-warning' : 'btn-success'}">${key.enabled ? 'Deshabilitar' : 'Habilitar'}</button>
                                        </form>
                                        <form method="POST" action="/admin/delete-key/${key.id}" style="display: inline;" onsubmit="return confirm('¿Estás seguro de eliminar esta API key?')">
                                            <button type="submit" class="btn btn-small btn-danger">Eliminar</button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    </div>
</body>
</html>
    `);
});

// API endpoints para gestión de keys
router.get('/api/keys', requireAdminAuth, (req, res) => {
    const keys = db.getAllAPIKeys();
    res.json(keys);
});

router.get('/api/stats', requireAdminAuth, (req, res) => {
    const stats = db.getGeneralStats();
    res.json(stats);
});

// Exportar API keys como JSON
router.get('/api/export', requireAdminAuth, (req, res) => {
    try {
        const jsonData = db.exportToJSON();
        const filename = `api_keys_export_${new Date().toISOString().split('T')[0]}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(jsonData);
    } catch (error) {
        res.status(500).json({ error: 'Error al exportar datos: ' + error.message });
    }
});

// Importar API keys desde JSON
router.post('/api/import', requireAdminAuth, (req, res) => {
    try {
        const { jsonData } = req.body;
        
        if (!jsonData) {
            return res.status(400).json({ error: 'No se proporcionaron datos JSON' });
        }
        
        const result = db.importFromJSON(jsonData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Error al procesar importación: ' + error.message 
        });
    }
});

router.post('/api/keys', requireAdminAuth, (req, res) => {
    const { name, description } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    
    const newKey = db.createAPIKey(name.trim(), description?.trim() || '');
    res.json(newKey);
});

router.put('/api/keys/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const { name, description, enabled } = req.body;
    
    const updated = db.updateAPIKey(id, { name, description, enabled });
    if (!updated) {
        return res.status(404).json({ error: 'API key no encontrada' });
    }
    
    res.json(updated);
});

router.delete('/api/keys/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    
    if (db.deleteAPIKey(id)) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'API key no encontrada' });
    }
});

router.post('/toggle-key/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const key = db.getAPIKeyById(id);
    
    if (!key) {
        return res.status(404).send('API key no encontrada');
    }
    
    db.updateAPIKey(id, { enabled: !key.enabled });
    res.redirect('/admin');
});

router.post('/delete-key/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    db.deleteAPIKey(id);
    res.redirect('/admin');
});

// Página para crear nueva API key
router.get('/create-key', requireAdminAuth, (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crear Nueva API Key</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #121212;
            color: #ffffff;
            line-height: 1.6;
        }
        
        .navbar {
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            border-bottom: 1px solid #333;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .navbar h1 {
            color: #64b5f6;
            font-size: 24px;
            font-weight: 600;
        }
        
        .container {
            max-width: 600px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        
        .form-container {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            padding: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .form-container h2 {
            margin-bottom: 1.5rem;
            color: #64b5f6;
            text-align: center;
            font-size: 28px;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #e0e0e0;
        }
        
        input[type="text"],
        textarea {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 16px;
            transition: all 0.3s ease;
            font-family: inherit;
        }
        
        input[type="text"]:focus,
        textarea:focus {
            outline: none;
            border-color: #64b5f6;
            box-shadow: 0 0 20px rgba(100, 181, 246, 0.3);
        }
        
        input[type="text"]::placeholder,
        textarea::placeholder {
            color: #b0b0b0;
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            text-align: center;
            font-size: 16px;
            margin-right: 1rem;
        }
        
        .btn-primary {
            background: linear-gradient(45deg, #1976d2, #1565c0);
            color: white;
        }
        
        .btn-primary:hover {
            background: linear-gradient(45deg, #1565c0, #0d47a1);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(25, 118, 210, 0.4);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }
        
        .form-actions {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .icon {
            font-size: 3rem;
            text-align: center;
            margin-bottom: 1rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .navbar {
                padding: 1rem;
            }
            
            .form-actions {
                flex-direction: column;
            }
            
            .btn {
                margin-right: 0;
                margin-bottom: 0.5rem;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>🔑 Crear Nueva API Key</h1>
        <div>
            <a href="/admin" class="btn btn-secondary">← Volver al Panel</a>
        </div>
    </nav>
    
    <div class="container">
        <div class="form-container">
            <div class="icon">🔐</div>
            <h2>Nueva API Key</h2>
            
            <form method="POST" action="/admin/create-key">
                <div class="form-group">
                    <label for="name">Nombre *</label>
                    <input type="text" id="name" name="name" placeholder="Ej: Mi Aplicación" required>
                </div>
                
                <div class="form-group">
                    <label for="description">Descripción</label>
                    <textarea id="description" name="description" placeholder="Descripción opcional de para qué se usará esta API key"></textarea>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">🔑 Crear API Key</button>
                    <a href="/admin" class="btn btn-secondary">Cancelar</a>
                </div>
            </form>
        </div>
    </div>
</body>
</html>
    `);
});

// Procesar creación de API key
router.post('/create-key', requireAdminAuth, (req, res) => {
    const { name, description } = req.body;
    
    if (!name || name.trim() === '') {
        return res.redirect('/admin/create-key?error=name');
    }
    
    const newKey = db.createAPIKey(name.trim(), description?.trim() || '');
    res.redirect(`/admin/key-created/${newKey.id}`);
});

// Página de confirmación de API key creada
router.get('/key-created/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const key = db.getAPIKeyById(id);
    
    if (!key) {
        return res.redirect('/admin');
    }
    
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Key Creada</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #121212;
            color: #ffffff;
            line-height: 1.6;
        }
        
        .navbar {
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            border-bottom: 1px solid #333;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .navbar h1 {
            color: #64b5f6;
            font-size: 24px;
            font-weight: 600;
        }
        
        .container {
            max-width: 700px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        
        .success-container {
            background: rgba(76, 175, 80, 0.1);
            border: 2px solid rgba(76, 175, 80, 0.3);
            border-radius: 20px;
            padding: 2rem;
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .success-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        
        .success-title {
            font-size: 2rem;
            color: #a5d6a7;
            margin-bottom: 1rem;
        }
        
        .key-container {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 2rem;
        }
        
        .key-label {
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #64b5f6;
        }
        
        .key-value {
            background: rgba(0, 0, 0, 0.3);
            padding: 1rem;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
            font-size: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 1rem;
            position: relative;
        }
        
        .copy-btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .copy-btn:hover {
            background: #1565c0;
        }
        
        .warning {
            background: rgba(255, 152, 0, 0.1);
            border: 2px solid rgba(255, 152, 0, 0.3);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .warning-title {
            color: #ffcc02;
            font-weight: 600;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            text-align: center;
            font-size: 16px;
            margin-right: 1rem;
        }
        
        .btn-primary {
            background: linear-gradient(45deg, #1976d2, #1565c0);
            color: white;
        }
        
        .btn-primary:hover {
            background: linear-gradient(45deg, #1565c0, #0d47a1);
            transform: translateY(-2px);
        }
        
        .actions {
            text-align: center;
        }
        
        .key-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .info-item {
            background: rgba(255, 255, 255, 0.03);
            padding: 1rem;
            border-radius: 8px;
        }
        
        .info-label {
            font-size: 0.8rem;
            color: #b0b0b0;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.5rem;
        }
        
        .info-value {
            font-weight: 600;
            color: #e0e0e0;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .key-info {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>✅ API Key Creada</h1>
        <div>
            <a href="/admin" class="btn btn-primary">← Volver al Panel</a>
        </div>
    </nav>
    
    <div class="container">
        <div class="success-container">
            <div class="success-icon">🎉</div>
            <h2 class="success-title">¡API Key creada exitosamente!</h2>
            <p>Tu nueva API key ha sido generada y está lista para usar.</p>
        </div>
        
        <div class="key-container">
            <div class="key-info">
                <div class="info-item">
                    <div class="info-label">Nombre</div>
                    <div class="info-value">${key.name}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Estado</div>
                    <div class="info-value">✅ Activa</div>
                </div>
            </div>
            
            ${key.description ? `
                <div class="info-item">
                    <div class="info-label">Descripción</div>
                    <div class="info-value">${key.description}</div>
                </div>
            ` : ''}
            
            <div class="key-label">Tu API Key:</div>
            <div class="key-value" id="apiKey">${key.apiKey}</div>
            <button class="copy-btn" onclick="copyKey()">📋 Copiar</button>
        </div>
        
        <div class="warning">
            <div class="warning-title">⚠️ Importante</div>
            <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
                <li>Guarda esta API key en un lugar seguro</li>
                <li>No la compartas con nadie más</li>
                <li>Esta es la única vez que se mostrará completa</li>
                <li>Úsala en el header Authorization: Bearer tu-api-key</li>
            </ul>
        </div>
        
        <div class="actions">
            <a href="/admin/create-key" class="btn btn-primary">+ Crear Otra Key</a>
            <a href="/admin" class="btn btn-primary">Ir al Panel</a>
        </div>
    </div>
    
    <script>
        function copyKey() {
            const keyElement = document.getElementById('apiKey');
            const textArea = document.createElement('textarea');
            textArea.value = keyElement.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const btn = document.querySelector('.copy-btn');
            btn.textContent = '✅ Copiado!';
            btn.style.background = '#4caf50';
            
            setTimeout(() => {
                btn.textContent = '📋 Copiar';
                btn.style.background = '#1976d2';
            }, 2000);
        }
    </script>
</body>
</html>
    `);
});

// Página para editar API key existente
router.get('/edit-key/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const key = db.getAPIKeyById(id);
    
    if (!key) {
        return res.redirect('/admin');
    }
    
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Editar API Key</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #121212;
            color: #ffffff;
            line-height: 1.6;
        }
        
        .navbar {
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            border-bottom: 1px solid #333;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .navbar h1 {
            color: #64b5f6;
            font-size: 24px;
            font-weight: 600;
        }
        
        .container {
            max-width: 600px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        
        .form-container {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            padding: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .form-container h2 {
            margin-bottom: 1.5rem;
            color: #64b5f6;
            text-align: center;
            font-size: 28px;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #e0e0e0;
        }
        
        input[type="text"],
        textarea,
        select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 16px;
            transition: all 0.3s ease;
            font-family: inherit;
        }
        
        input[type="text"]:focus,
        textarea:focus,
        select:focus {
            outline: none;
            border-color: #64b5f6;
            box-shadow: 0 0 20px rgba(100, 181, 246, 0.3);
        }
        
        input[type="text"]::placeholder,
        textarea::placeholder {
            color: #b0b0b0;
        }
        
        select option {
            background: #121212;
            color: #ffffff;
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .key-info {
            background: rgba(255, 255, 255, 0.03);
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
        }
        
        .key-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        .info-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 0.75rem;
            border-radius: 6px;
        }
        
        .info-label {
            font-size: 0.8rem;
            color: #b0b0b0;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.25rem;
        }
        
        .info-value {
            font-weight: 600;
            color: #e0e0e0;
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            text-align: center;
            font-size: 16px;
            margin-right: 1rem;
        }
        
        .btn-primary {
            background: linear-gradient(45deg, #1976d2, #1565c0);
            color: white;
        }
        
        .btn-primary:hover {
            background: linear-gradient(45deg, #1565c0, #0d47a1);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(25, 118, 210, 0.4);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }
        
        .btn-danger {
            background: linear-gradient(45deg, #d32f2f, #c62828);
            color: white;
        }
        
        .btn-danger:hover {
            background: linear-gradient(45deg, #c62828, #b71c1c);
            transform: translateY(-2px);
        }
        
        .form-actions {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .icon {
            font-size: 3rem;
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .status-indicator {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-indicator.enabled {
            background: rgba(76, 175, 80, 0.2);
            color: #a5d6a7;
        }
        
        .status-indicator.disabled {
            background: rgba(244, 67, 54, 0.2);
            color: #ffcdd2;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .navbar {
                padding: 1rem;
            }
            
            .form-actions {
                flex-direction: column;
            }
            
            .btn {
                margin-right: 0;
                margin-bottom: 0.5rem;
            }
            
            .key-info-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>✏️ Editar API Key</h1>
        <div>
            <a href="/admin" class="btn btn-secondary">← Volver al Panel</a>
        </div>
    </nav>
    
    <div class="container">
        <div class="form-container">
            <div class="icon">🔑</div>
            <h2>Editar API Key</h2>
            
            <div class="key-info">
                <div class="key-info-grid">
                    <div class="info-item">
                        <div class="info-label">Estado Actual</div>
                        <div class="info-value">
                            <span class="status-indicator ${key.enabled ? 'enabled' : 'disabled'}">
                                ${key.enabled ? '✅ Activa' : '❌ Deshabilitada'}
                            </span>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Requests Totales</div>
                        <div class="info-value">${key.totalRequests}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Creada</div>
                        <div class="info-value">${new Date(key.createdAt).toLocaleDateString('es-ES')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Último Uso</div>
                        <div class="info-value">${key.lastUsed ? new Date(key.lastUsed).toLocaleDateString('es-ES') : 'Nunca'}</div>
                    </div>
                </div>
            </div>
            
            <form method="POST" action="/admin/edit-key/${key.id}">
                <div class="form-group">
                    <label for="name">Nombre *</label>
                    <input type="text" id="name" name="name" value="${key.name}" required>
                </div>
                
                <div class="form-group">
                    <label for="description">Descripción</label>
                    <textarea id="description" name="description" placeholder="Descripción opcional de para qué se usará esta API key">${key.description || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="enabled">Estado</label>
                    <select id="enabled" name="enabled">
                        <option value="true" ${key.enabled ? 'selected' : ''}>✅ Activa</option>
                        <option value="false" ${!key.enabled ? 'selected' : ''}>❌ Deshabilitada</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Guardar Cambios</button>
                    <a href="/admin" class="btn btn-secondary">Cancelar</a>
                </div>
            </form>
        </div>
    </div>
</body>
</html>
    `);
});

// Procesar edición de API key
router.post('/edit-key/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const { name, description, enabled } = req.body;
    
    if (!name || name.trim() === '') {
        return res.redirect(`/admin/edit-key/${id}?error=name`);
    }
    
    const updated = db.updateAPIKey(id, {
        name: name.trim(),
        description: description?.trim() || '',
        enabled: enabled === 'true'
    });
    
    if (!updated) {
        return res.redirect('/admin');
    }
    
    res.redirect('/admin');
});

// Página de importar/exportar
router.get('/import-export', requireAdminAuth, (req, res) => {
    const stats = db.getGeneralStats();
    
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Importar/Exportar API Keys</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #121212;
            color: #ffffff;
            line-height: 1.6;
        }
        
        .navbar {
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            border-bottom: 1px solid #333;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .navbar h1 {
            color: #64b5f6;
            font-size: 24px;
            font-weight: 600;
        }
        
        .container {
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        
        .section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .section h2 {
            margin-bottom: 1.5rem;
            color: #64b5f6;
            font-size: 24px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .section p {
            margin-bottom: 1.5rem;
            color: #b0b0b0;
            line-height: 1.6;
        }
        
        .stats-summary {
            background: rgba(255, 255, 255, 0.03);
            padding: 1rem;
            border-radius: 10px;
            margin-bottom: 1.5rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
        }
        
        .stat-item {
            text-align: center;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: #64b5f6;
        }
        
        .stat-label {
            font-size: 0.8rem;
            color: #b0b0b0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            text-align: center;
            font-size: 16px;
            margin-right: 1rem;
            margin-bottom: 1rem;
        }
        
        .btn-primary {
            background: linear-gradient(45deg, #1976d2, #1565c0);
            color: white;
        }
        
        .btn-primary:hover {
            background: linear-gradient(45deg, #1565c0, #0d47a1);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(25, 118, 210, 0.4);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }
        
        .btn-success {
            background: linear-gradient(45deg, #4caf50, #388e3c);
            color: white;
        }
        
        .btn-success:hover {
            background: linear-gradient(45deg, #388e3c, #2e7d32);
            transform: translateY(-2px);
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #e0e0e0;
        }
        
        textarea {
            width: 100%;
            min-height: 200px;
            padding: 12px 16px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 14px;
            font-family: 'Courier New', monospace;
            transition: all 0.3s ease;
            resize: vertical;
        }
        
        textarea:focus {
            outline: none;
            border-color: #64b5f6;
            box-shadow: 0 0 20px rgba(100, 181, 246, 0.3);
        }
        
        textarea::placeholder {
            color: #b0b0b0;
        }
        
        .file-input {
            display: none;
        }
        
        .file-label {
            display: inline-block;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px dashed rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
            width: 100%;
            margin-bottom: 1rem;
        }
        
        .file-label:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: #64b5f6;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 10px;
            margin-bottom: 1rem;
            display: none;
        }
        
        .alert.success {
            background: rgba(76, 175, 80, 0.2);
            border: 1px solid rgba(76, 175, 80, 0.5);
            color: #a5d6a7;
        }
        
        .alert.error {
            background: rgba(244, 67, 54, 0.2);
            border: 1px solid rgba(244, 67, 54, 0.5);
            color: #ffcdd2;
        }
        
        .warning {
            background: rgba(255, 152, 0, 0.1);
            border: 2px solid rgba(255, 152, 0, 0.3);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1.5rem;
        }
        
        .warning-title {
            color: #ffcc02;
            font-weight: 600;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .navbar {
                padding: 1rem;
            }
            
            .stats-summary {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>📁 Importar/Exportar API Keys</h1>
        <div>
            <a href="/admin" class="btn btn-secondary">← Volver al Panel</a>
        </div>
    </nav>
    
    <div class="container">
        <!-- Estadísticas actuales -->
        <div class="section">
            <h2>📊 Estado Actual</h2>
            <div class="stats-summary">
                <div class="stat-item">
                    <div class="stat-number">${stats.totalKeys}</div>
                    <div class="stat-label">API Keys Totales</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.enabledKeys}</div>
                    <div class="stat-label">Keys Activas</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.totalRequests}</div>
                    <div class="stat-label">Requests Totales</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.todayRequests}</div>
                    <div class="stat-label">Requests Hoy</div>
                </div>
            </div>
        </div>
        
        <!-- Exportar -->
        <div class="section">
            <h2>📤 Exportar API Keys</h2>
            <p>Descarga todas tus API keys y sus estadísticas en formato JSON para hacer respaldo o migrar a otro servidor.</p>
            
            <a href="/admin/api/export" class="btn btn-primary" download>
                💾 Descargar Backup JSON
            </a>
        </div>
        
        <!-- Importar -->
        <div class="section">
            <h2>📥 Importar API Keys</h2>
            <p>Importa API keys desde un archivo JSON de respaldo. Las keys duplicadas serán ignoradas automáticamente.</p>
            
            <div class="warning">
                <div class="warning-title">⚠️ Importante</div>
                <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
                    <li>Solo se importarán API keys que no existan ya en el sistema</li>
                    <li>El formato del JSON debe coincidir con el formato de exportación</li>
                    <li>La importación no eliminará las API keys existentes</li>
                </ul>
            </div>
            
            <div class="alert" id="importAlert"></div>
            
            <div class="form-group">
                <label for="fileInput">Seleccionar archivo JSON:</label>
                <input type="file" id="fileInput" class="file-input" accept=".json" onchange="handleFileSelect(event)">
                <label for="fileInput" class="file-label">
                    📁 Hacer clic para seleccionar archivo JSON
                </label>
            </div>
            
            <div class="form-group">
                <label for="jsonData">O pegar JSON directamente:</label>
                <textarea id="jsonData" placeholder="Pega aquí el contenido del archivo JSON..."></textarea>
            </div>
            
            <button onclick="importData()" class="btn btn-success">
                📥 Importar API Keys
            </button>
        </div>
    </div>
    
    <script>
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('jsonData').value = e.target.result;
                };
                reader.readAsText(file);
            }
        }
        
        function showAlert(message, type) {
            const alert = document.getElementById('importAlert');
            alert.textContent = message;
            alert.className = 'alert ' + type;
            alert.style.display = 'block';
            
            setTimeout(() => {
                alert.style.display = 'none';
            }, 5000);
        }
        
        async function importData() {
            const jsonData = document.getElementById('jsonData').value.trim();
            
            if (!jsonData) {
                showAlert('Por favor selecciona un archivo o pega el contenido JSON', 'error');
                return;
            }
            
            try {
                JSON.parse(jsonData); // Validar JSON
                
                const response = await fetch('/admin/api/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ jsonData })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showAlert(result.message, 'success');
                    document.getElementById('jsonData').value = '';
                    document.getElementById('fileInput').value = '';
                    
                    // Recargar página después de 2 segundos
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    showAlert('Error: ' + result.error, 'error');
                }
            } catch (error) {
                showAlert('Error: JSON inválido o error de red', 'error');
            }
        }
    </script>
</body>
</html>
    `);
});

// Página para gestionar rate limits de API keys
router.get('/keys-ratelimit', requireAdminAuth, (req, res) => {
    const apiKeys = db.getAllAPIKeys();
    
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestión de Rate Limits</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #121212;
            color: #ffffff;
            line-height: 1.6;
        }
        
        .navbar {
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(10px);
            padding: 1rem 2rem;
            border-bottom: 1px solid #333;
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .navbar h1 {
            color: #64b5f6;
            font-size: 24px;
            font-weight: 600;
        }
        
        .nav-buttons {
            display: flex;
            gap: 1rem;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .btn-primary {
            background: linear-gradient(45deg, #1976d2, #1565c0);
            color: white;
        }
        
        .btn-primary:hover {
            background: linear-gradient(45deg, #1565c0, #0d47a1);
            transform: translateY(-2px);
        }
        
        .btn-danger {
            background: linear-gradient(45deg, #d32f2f, #c62828);
            color: white;
        }
        
        .btn-danger:hover {
            background: linear-gradient(45deg, #c62828, #b71c1c);
            transform: translateY(-2px);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .section h2 {
            margin-bottom: 1.5rem;
            color: #64b5f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .search-sort-container {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
        }
        
        .search-container {
            flex-grow: 1;
            display: flex;
        }
        
        .search-input {
            flex-grow: 1;
            padding: 10px 16px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 16px;
        }
        
        .search-input:focus {
            outline: none;
            border-color: #64b5f6;
        }
        
        .sort-container {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .sort-label {
            font-size: 0.9rem;
            color: #b0b0b0;
        }
        
        .sort-select {
            padding: 8px 12px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            font-size: 14px;
        }
        
        .sort-select:focus {
            outline: none;
            border-color: #64b5f6;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .table th,
        .table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .table th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: 600;
            color: #64b5f6;
            cursor: pointer;
            user-select: none;
        }
        
        .table th:hover {
            background: rgba(255, 255, 255, 0.08);
        }
        
        .table tr:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status.enabled {
            background: rgba(76, 175, 80, 0.2);
            color: #a5d6a7;
        }
        
        .status.disabled {
            background: rgba(244, 67, 54, 0.2);
            color: #ffcdd2;
        }
        
        .action-buttons {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn-small {
            padding: 4px 8px;
            font-size: 0.8rem;
            border-radius: 4px;
        }
        
        .btn-success {
            background: #4caf50;
            color: white;
        }
        
        .btn-warning {
            background: #ff9800;
            color: white;
        }
        
        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }
        
        .empty-state i {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
        }
        
        .tooltip {
            position: relative;
            display: inline-block;
        }
        
        .tooltip .tooltiptext {
            visibility: hidden;
            width: 200px;
            background-color: rgba(0, 0, 0, 0.8);
            color: #fff;
            text-align: center;
            border-radius: 6px;
            padding: 8px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 0.8rem;
            font-weight: normal;
            text-transform: none;
        }
        
        .tooltip:hover .tooltiptext {
            visibility: visible;
            opacity: 1;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .navbar {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }
            
            .search-sort-container {
                flex-direction: column;
                align-items: stretch;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>🚦 Gestión de Rate Limits</h1>
        <div class="nav-buttons">
            <a href="/admin" class="btn btn-primary">← Volver al Panel</a>
            <form method="POST" action="/admin/logout" style="display: inline;">
                <button type="submit" class="btn btn-danger">Cerrar Sesión</button>
            </form>
        </div>
    </nav>
    
    <div class="container">
        <div class="section">
            <h2>Configuración de Rate Limits</h2>
            
            <div class="search-sort-container">
                <div class="search-container">
                    <input type="text" id="searchInput" class="search-input" placeholder="Buscar por nombre..." onkeyup="filterTable()">
                </div>
                
                <div class="sort-container">
                    <span class="sort-label">Ordenar por:</span>
                    <select id="sortSelect" class="sort-select" onchange="sortTable()">
                        <option value="name">Nombre</option>
                        <option value="requests">Requests (mayor a menor)</option>
                        <option value="lastUsed">Último uso (reciente primero)</option>
                        <option value="created">Fecha de creación (reciente primero)</option>
                    </select>
                </div>
            </div>
            
            ${apiKeys.length === 0 ? `
                <div class="empty-state">
                    <i>🔑</i>
                    <h3>No hay API keys creadas</h3>
                    <p>Crea tu primera API key para comenzar</p>
                </div>
            ` : `
                <table class="table" id="keysTable">
                    <thead>
                        <tr>
                            <th onclick="sortTableByColumn(0)">Nombre</th>
                            <th onclick="sortTableByColumn(1)">Descripción</th>
                            <th onclick="sortTableByColumn(2)">Estado</th>
                            <th onclick="sortTableByColumn(3)">Requests</th>
                            <th onclick="sortTableByColumn(4)">Último Uso</th>
                            <th onclick="sortTableByColumn(5)">Rate Limit</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${apiKeys.map(key => `
                            <tr data-name="${key.name}" 
                                data-requests="${key.totalRequests}" 
                                data-last-used="${key.lastUsed || '0'}" 
                                data-created="${key.createdAt}">
                                <td><strong>${key.name}</strong></td>
                                <td>${key.description || '-'}</td>
                                <td><span class="status ${key.enabled ? 'enabled' : 'disabled'}">${key.enabled ? 'Activa' : 'Deshabilitada'}</span></td>
                                <td>${key.totalRequests}</td>
                                <td>${key.lastUsed ? new Date(key.lastUsed).toLocaleString('es-ES') : 'Nunca'}</td>
                                <td>
                                    <span class="status ${key.exemptFromRateLimit ? 'disabled' : 'enabled'}">
                                        ${key.exemptFromRateLimit ? 'Desactivado' : 'Activado'}
                                    </span>
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <form method="POST" action="/admin/toggle-ratelimit/${key.id}" style="display: inline;">
                                            <button type="submit" class="btn btn-small ${key.exemptFromRateLimit ? 'btn-success' : 'btn-warning'} tooltip">
                                                ${key.exemptFromRateLimit ? 'Activar Rate Limit' : 'Desactivar Rate Limit'}
                                                <span class="tooltiptext">
                                                    ${key.exemptFromRateLimit 
                                                        ? 'Activar el límite de solicitudes para esta API key' 
                                                        : 'Desactivar el límite de solicitudes para esta API key'}
                                                </span>
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        </div>
    </div>
    
    <script>
        // Función para filtrar la tabla por nombre
        function filterTable() {
            const input = document.getElementById('searchInput');
            const filter = input.value.toUpperCase();
            const table = document.getElementById('keysTable');
            const rows = table.getElementsByTagName('tr');
            
            for (let i = 1; i < rows.length; i++) {
                const nameColumn = rows[i].getElementsByTagName('td')[0];
                if (nameColumn) {
                    const nameValue = nameColumn.textContent || nameColumn.innerText;
                    if (nameValue.toUpperCase().indexOf(filter) > -1) {
                        rows[i].style.display = '';
                    } else {
                        rows[i].style.display = 'none';
                    }
                }
            }
        }
        
        // Función para ordenar la tabla según el select
        function sortTable() {
            const sortBy = document.getElementById('sortSelect').value;
            const table = document.getElementById('keysTable');
            const rows = Array.from(table.getElementsByTagName('tr')).slice(1); // Excluir header
            const tbody = table.getElementsByTagName('tbody')[0];
            
            rows.sort((a, b) => {
                let valueA, valueB;
                
                switch (sortBy) {
                    case 'name':
                        valueA = a.dataset.name.toUpperCase();
                        valueB = b.dataset.name.toUpperCase();
                        return valueA.localeCompare(valueB);
                    
                    case 'requests':
                        valueA = parseInt(a.dataset.requests);
                        valueB = parseInt(b.dataset.requests);
                        return valueB - valueA; // Mayor a menor
                    
                    case 'lastUsed':
                        valueA = a.dataset.lastUsed;
                        valueB = b.dataset.lastUsed;
                        return valueB.localeCompare(valueA); // Más reciente primero
                    
                    case 'created':
                        valueA = a.dataset.created;
                        valueB = b.dataset.created;
                        return valueB.localeCompare(valueA); // Más reciente primero
                }
            });
            
            // Reordenar las filas
            rows.forEach(row => {
                tbody.appendChild(row);
            });
        }
        
        // Función para ordenar por columna al hacer clic en el encabezado
        let sortDirection = 1; // 1 = ascendente, -1 = descendente
        let lastColumn = -1;
        
        function sortTableByColumn(columnIndex) {
            if (lastColumn === columnIndex) {
                sortDirection *= -1; // Cambiar dirección si se hace clic en la misma columna
            } else {
                sortDirection = 1; // Reiniciar dirección si es una nueva columna
                lastColumn = columnIndex;
            }
            
            const table = document.getElementById('keysTable');
            const tbody = table.getElementsByTagName('tbody')[0];
            const rows = Array.from(tbody.getElementsByTagName('tr'));
            
            rows.sort((a, b) => {
                const cellA = a.getElementsByTagName('td')[columnIndex];
                const cellB = b.getElementsByTagName('td')[columnIndex];
                
                if (!cellA || !cellB) return 0;
                
                let valueA = cellA.textContent || cellA.innerText;
                let valueB = cellB.textContent || cellB.innerText;
                
                // Convertir a números si es posible
                if (!isNaN(valueA) && !isNaN(valueB)) {
                    return sortDirection * (parseFloat(valueA) - parseFloat(valueB));
                }
                
                // Ordenar por fecha si es la columna de último uso
                if (columnIndex === 4) {
                    const dateA = a.dataset.lastUsed;
                    const dateB = b.dataset.lastUsed;
                    return sortDirection * dateB.localeCompare(dateA);
                }
                
                // Ordenar alfabéticamente
                return sortDirection * valueA.localeCompare(valueB);
            });
            
            // Reordenar las filas
            rows.forEach(row => {
                tbody.appendChild(row);
            });
        }
    </script>
</body>
</html>
    `);
});

// Endpoint para activar/desactivar rate limit de una API key
router.post('/toggle-ratelimit/:id', requireAdminAuth, (req, res) => {
    const { id } = req.params;
    const key = db.getAPIKeyById(id);
    
    if (!key) {
        return res.status(404).send('API key no encontrada');
    }
    
    // Cambiar el estado de exemptFromRateLimit
    db.updateAPIKey(id, { exemptFromRateLimit: !key.exemptFromRateLimit });
    
    // Redireccionar de vuelta a la página de rate limits
    res.redirect('/admin/keys-ratelimit');
});

module.exports = router;
