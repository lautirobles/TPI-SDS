'use strict';
/* ===========================================================================
 *  RUTAS VULNERABLES  (MODE=vulnerable)
 *  -------------------------------------------------------------------------
 *  TODAS las consultas construyen SQL concatenando entrada del usuario.
 *  Se usa Sequelize, demostrando que el ORM NO protege cuando se lo usa mal:
 *    - sequelize.query(`... ${input} ...`)      -> SQL crudo interpolado
 *    - Model.findAll({ where: literal(`${in}`) }) -> literal() con interpolacion
 *    - order:[[ literal(input), ... ]]           -> inyeccion de IDENTIFICADOR
 *                                                   (un ORM NO puede parametrizar
 *                                                    nombres de columna/orden)
 *  NO USAR ESTE CODIGO COMO REFERENCIA. Es un anti-ejemplo intencional.
 * =========================================================================== */
const express = require('express');
const bcrypt = require('bcryptjs');
const { QueryTypes, literal } = require('sequelize');
const { sequelize } = require('../db/sequelize');
const { Product } = require('../db/models');

const router = express.Router();
const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

// Helper: adjunta la query cruda ejecutada para mostrarla en pantalla (panel debug).
function dbg(res, sql) {
  if (DEBUG_SQL) res.locals.debugSql = (res.locals.debugSql || []).concat(sql);
}

/* ---------------------------------------------------------------------------
 *  HOME / CATALOGO + BUSQUEDA + ORDEN
 *  Puntos de inyeccion: q (UNION-based), sort y order (ORDER BY / identifier).
 * ------------------------------------------------------------------------- */
router.get('/', async (req, res, next) => {
  const q     = req.query.q     || '';
  const sort  = req.query.sort  || 'id';
  const order = req.query.order || 'ASC';
  try {
    // VULNERABLE: q interpolado dentro de un LIKE, y sort/order como identificadores.
    const sql =
      "SELECT id, name, description, price, stock, category " +
      "FROM products " +
      "WHERE name LIKE '%" + q + "%' " +
      "ORDER BY " + sort + " " + order;
    dbg(res, sql);
    const products = await sequelize.query(sql, { type: QueryTypes.SELECT });
    res.render('home', { products, q, sort, order, error: null });
  } catch (err) {
    // Se expone el error de la BD a proposito -> habilita Error-based.
    res.render('home', { products: [], q, sort, order, error: err.message });
  }
});

/* ---------------------------------------------------------------------------
 *  DETALLE DE PRODUCTO  ->  Error-based / Boolean-blind (contexto numerico)
 * ------------------------------------------------------------------------- */
router.get('/products/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // VULNERABLE: id sin comillas (contexto numerico). Ideal para extractvalue/updatexml.
    const sql = "SELECT id, name, description, price, stock, category FROM products WHERE id = " + id;
    dbg(res, sql);
    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
    if (!rows.length) return res.status(404).render('product', { product: null, error: 'No encontrado' });
    res.render('product', { product: rows[0], error: null });
  } catch (err) {
    res.status(500).render('product', { product: null, error: err.message });
  }
});

/* ---------------------------------------------------------------------------
 *  API JSON  ->  Time-based blind.  Mala praxis de ORM: literal() interpolado.
 * ------------------------------------------------------------------------- */
router.get('/api/products', async (req, res) => {
  const minStock = req.query.minStock || '0';
  try {
    // VULNERABLE: literal() con interpolacion dentro de una llamada "de ORM".
    const products = await Product.findAll({
      attributes: ['id', 'name', 'price', 'stock'],
      where: literal('stock >= ' + minStock),   // <- inyeccion (SLEEP, etc.)
    });
    res.json({ count: products.length, products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------------------------
 *  LOGIN  ->  Auth bypass (' OR '1'='1' -- ), Error/Boolean en ambos campos.
 *  La verificacion de password se hace EN EL SQL (comparacion por string),
 *  por eso ' OR '1'='1 evade la autenticacion.
 * ------------------------------------------------------------------------- */
router.get('/login', (req, res) => res.render('login', { error: null, info: null }));

router.post('/login', async (req, res) => {
  const username = req.body.username || '';
  const password = req.body.password || '';
  try {
    // VULNERABLE: ambos campos concatenados. pass_plain comparado como string.
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
  } catch (_) { /* usuario de BD podria no tener acceso */ }
  res.render('panel', { user: req.session.user, secrets });
});

module.exports = router;
