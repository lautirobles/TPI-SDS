'use strict';
/* ===========================================================================
 *  RUTAS REMEDIADAS  (MODE=secure)
 *  -------------------------------------------------------------------------
 *  Mismas funcionalidades, uso CORRECTO del ORM + defensa en profundidad:
 *   - Consultas parametrizadas (replacements / operadores Op). El valor del
 *     usuario viaja como PARAMETRO, nunca como parte del texto SQL.
 *   - ORDER BY: como un ORM NO parametriza identificadores, se usa WHITELIST
 *     explicita de columnas y un ENUM de direccion.
 *   - Validacion de tipos (id y minStock deben ser enteros).
 *   - Autenticacion con bcrypt.compare (el hash nunca se compara en SQL).
 * =========================================================================== */
const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Product, User, Secret } = require('../db/models');

const router = express.Router();

// Whitelist para ORDER BY (defensa contra inyeccion de identificador).
const SORT_WHITELIST = new Set(['id', 'name', 'price', 'stock', 'category']);
const ORDER_WHITELIST = new Set(['ASC', 'DESC']);

router.get('/', async (req, res) => {
  const q = (req.query.q || '').toString();
  const sort  = SORT_WHITELIST.has(req.query.sort)  ? req.query.sort  : 'id';
  const order = ORDER_WHITELIST.has((req.query.order || '').toUpperCase())
    ? req.query.order.toUpperCase() : 'ASC';
  try {
    // SEGURO: el valor de busqueda va como parametro (Sequelize lo escapa).
    // sort/order ya quedaron restringidos a valores de la whitelist.
    const products = await Product.findAll({
      where: { name: { [Op.like]: '%' + q + '%' } },   // q NO entra al texto SQL: es un bind param
      order: [[sort, order]],
    });
    res.render('home', { products, q, sort, order, error: null });
  } catch (err) {
    res.render('home', { products: [], q, sort, order, error: 'Error interno' });
  }
});

router.get('/products/:id', async (req, res) => {
  // SEGURO: validacion estricta de tipo antes de tocar la BD.
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).render('product', { product: null, error: 'ID invalido' });
  }
  const product = await Product.findByPk(id);   // consulta parametrizada
  if (!product) return res.status(404).render('product', { product: null, error: 'No encontrado' });
  res.render('product', { product, error: null });
});

router.get('/api/products', async (req, res) => {
  const minStock = Number.parseInt(req.query.minStock, 10);
  if (!Number.isInteger(minStock)) {
    return res.status(400).json({ error: 'minStock debe ser un entero' });
  }
  const products = await Product.findAll({
    attributes: ['id', 'name', 'price', 'stock'],
    where: { stock: { [Op.gte]: minStock } },    // operador parametrizado
  });
  res.json({ count: products.length, products });
});

router.get('/login', (req, res) => res.render('login', { error: null, info: null }));

router.post('/login', async (req, res) => {
  const username = (req.body.username || '').toString();
  const password = (req.body.password || '').toString();
  try {
    // SEGURO: busqueda parametrizada por username; el hash NUNCA entra al SQL.
    const user = await User.findOne({ where: { username } });
    // Comparacion de contrasena con bcrypt en la aplicacion.
    const ok = user && bcrypt.compareSync(password, user.password_hash);
    if (ok) {
      req.session.user = { id: user.id, username: user.username, role: user.role };
      return res.redirect('/panel');
    }
    // Mensaje generico (no revela si el usuario existe).
    res.status(401).render('login', { error: 'Credenciales invalidas', info: null });
  } catch (err) {
    res.status(500).render('login', { error: 'Error interno', info: null });
  }
});

router.post('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

router.get('/panel', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const secrets = await Secret.findAll({ attributes: ['label', 'secret_value', 'api_token'] });
  res.render('panel', { user: req.session.user, secrets });
});

module.exports = router;
