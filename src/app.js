require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const app = express();

const config = require('./config/config');
const routes = require('./routes');
const adminRoutes = require('./routes/admin');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Configurar sesiones
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Cambiar a true en producción con HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

app.use(morgan(process.env.MORGAN_FORMAT ?? 'tiny'));

// Rutas de administración
app.use('/admin', adminRoutes);

// Rutas principales (incluyendo v1 y cursor)
app.use("/", routes);

app.listen(config.port, () => {
    console.log(`The server listens port: ${config.port}`);
    console.log(`Admin panel available at: http://localhost:${config.port}/admin`);
});
