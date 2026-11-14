'use strict';
/* ===========================================================================
 *  RUTAS VULNERABLES  (MODE=vulnerable)
 *  -------------------------------------------------------------------------
 *  EXACTAMENTE DOS vulnerabilidades SQLi (el resto del sitio es seguro):
 *
 *   (1) LOGIN  (POST /login)  -> Bypass de autenticacion.
 *       La verificacion de credenciales se hace concatenando la entrada dentro
 *       del SQL, por lo que 'admin' --  o  ' OR '1'='1' --  evaden el password.
 *
 *   (2) BUSCADOR (GET /?q=)   -> Extraccion de datos (UNION-based).
 *       El termino de busqueda se interpola en la consulta; permite UNION SELECT
 *       para volcar otras tablas (users, secrets, ...).
 *
 *  Demuestra que Sequelize (ORM) NO protege si se usa mal: aca se usa
 *  sequelize.query(`... ${input} ...`) en lugar de parametros.
 *  NO USAR COMO REFERENCIA. Es un anti-ejemplo intencional.
 * =========================================================================== */
const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const { Product } = require('../db/models');

const router = express.Router();
const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

// Ordenamiento: es una funcion de UI, NO una vulnerabilidad -> whitelist en ambas apps.
const SORT_WHITELIST = new Set(['id', 'name', 'price', 'stock', 'category']);
const ORDER_WHITELIST = new Set(['ASC', 'DESC']);
function safeSort(v) { return SORT_WHITELIST.has(v) ? v : 'id'; }
function safeOrder(v) { return ORDER_WHITELIST.has((v || '').toUpperCase()) ? v.toUpperCase() : 'ASC'; }

function dbg(res, sql) { if (DEBUG_SQL) res.locals.debugSql = (res.locals.debugSql || []).concat(sql); }

/* ---------------------------------------------------------------------------
 *  (2) BUSCADOR  ->  VULNERABLE (UNION-based data extraction)
 * ------------------------------------------------------------------------- */
router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const sort = safeSort(req.query.sort);
  const order = safeOrder(req.query.order);
  try {
    // VULNERABLE: q se interpola directamente en el SQL (sort/order van por whitelist).
    const sql =
      "SELECT id, name, description, price, stock, category " +
      "FROM products " +
      "WHERE name LIKE '%" + q + "%' " +
      "ORDER BY " + sort + " " + order;
    dbg(res, sql);
    const products = await sequelize.query(sql, { type: QueryTypes.SELECT });
    res.render('home', { products, q, sort, order, error: null });
  } catch (err) {
    // Se expone el error de la BD (ayuda a construir el UNION correcto).
    res.render('home', { products: [], q, sort, order, error: err.message });
  }
});

/* ---------------------------------------------------------------------------
 *  DETALLE DE PRODUCTO  ->  SEGURO (validacion de tipo + findByPk)
 * ------------------------------------------------------------------------- */
router.get('/products/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).render('product', { product: null, error: 'ID invalido' });
  }
  const product = await Product.findByPk(id);
  if (!product) return res.status(404).render('product', { product: null, error: 'No encontrado' });
  res.render('product', { product, error: null });
});

/* ---------------------------------------------------------------------------
 *  (1) LOGIN  ->  VULNERABLE (auth bypass)
 * ------------------------------------------------------------------------- */
router.get('/login', (req, res) => res.render('login', { error: null, info: null }));

router.post('/login', async (req, res) => {
  const username = req.body.username || '';
  const password = req.body.password || '';
  try {
    // VULNERABLE: ambos campos concatenados; password comparado como string en SQL.
    const sql =
      "SELECT id, username, role FROM users " +
      "WHERE username = '" + username + "' AND pass_plain = '" + password + "'";
    dbg(res, sql);
    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
    if (rows.length) {
      req.session.user = { id: rows[0].id, username: rows[0].username, role: rows[0].role };
      return res.redirect('/panel');
    }
    res.status(401).render('login', { error: 'Credenciales invalidas', info: null });
  } catch (err) {
    res.status(500).render('login', { error: err.message, info: null });
  }
});

router.post('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

/* ---------------------------------------------------------------------------
 *  PANEL (area autenticada)  -> muestra datos sensibles accesibles tras login.
 * ------------------------------------------------------------------------- */
router.get('/panel', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  let secrets = [];
  try {
    secrets = await sequelize.query('SELECT label, secret_value, api_token FROM secrets', { type: QueryTypes.SELECT });
  } catch (_) { /* noop */ }
  res.render('panel', { user: req.session.user, secrets });
});

module.exports = router;
