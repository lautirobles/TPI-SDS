'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const { sequelize, MODE, isVuln } = require('./db/sequelize');

const PORT = Number(process.env.PORT || 3000);
const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
}));

// Variables disponibles en todas las vistas (banner de entorno, debug).
app.use((req, res, next) => {
  res.locals.MODE = MODE;
  res.locals.isVuln = isVuln;
  res.locals.debugSqlEnabled = DEBUG_SQL;
  res.locals.debugSql = [];
  res.locals.user = req.session.user || null;
  next();
});

// Carga de rutas segun el modo.
const routes = isVuln ? require('./routes/vulnerable') : require('./routes/secure');
app.use('/', routes);

app.get('/health', (req, res) => res.json({ ok: true, mode: MODE }));

async function start() {
  // Reintentos de conexion (la BD puede tardar en levantar).
  for (let i = 0; i < 30; i++) {
    try { await sequelize.authenticate(); break; }
    catch (e) {
      console.log('Esperando a la BD... (' + (i + 1) + ')');
      await new Promise((r) => setTimeout(r, 2000));
      if (i === 29) throw e;
    }
  }
  app.listen(PORT, () => {
    console.log('================================================');
    console.log('  Modo:   ' + MODE.toUpperCase() + (isVuln ? '  (VULNERABLE)' : '  (REMEDIADO)'));
    console.log('  Puerto: ' + PORT);
    console.log('  Usuario BD: ' + (process.env.DB_USER));
    console.log('================================================');
  });
}
start().catch((e) => { console.error('Fallo al iniciar:', e.message); process.exit(1); });
