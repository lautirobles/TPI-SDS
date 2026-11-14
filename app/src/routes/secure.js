'use strict';
/* ===========================================================================
 *  RUTAS REMEDIADAS  (MODE=secure)
 *  -------------------------------------------------------------------------
 *  Mismas funcionalidades, uso CORRECTO del ORM:
 *   - LOGIN: busqueda parametrizada por username + verificacion con bcrypt
 *            (el hash NUNCA se compara dentro del SQL).
 *   - BUSCADOR: operador Op.like -> el termino viaja como PARAMETRO, Sequelize
 *            lo escapa; NO se puede inyectar UNION ni extraer datos.
 *   - Detalle: validacion de tipo + findByPk. Orden: whitelist.
 * =========================================================================== */
const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Product, User, Secret } = require('../db/models');

const router = express.Router();

const SORT_WHITELIST = new Set(['id', 'name', 'price', 'stock', 'category']);
const ORDER_WHITELIST = new Set(['ASC', 'DESC']);

router.get('/', async (req, res) => {
  const q = (req.query.q || '').toString();
  const sort = SORT_WHITELIST.has(req.query.sort) ? req.query.sort : 'id';
  const order = ORDER_WHITELIST.has((req.query.order || '').toUpperCase())
    ? req.query.order.toUpperCase() : 'ASC';
  try {
    // SEGURO: q va como bind param (Sequelize lo escapa). No hay inyeccion posible.
    const products = await Product.findAll({
      where: { name: { [Op.like]: '%' + q + '%' } },
      order: [[sort, order]],
    });
    res.render('home', { products, q, sort, order, error: null });
  } catch (err) {
    res.render('home', { products: [], q, sort, order, error: 'Error interno' });
  }
});

router.get('/products/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).render('product', { product: null, error: 'ID invalido' });
  }
  const product = await Product.findByPk(id);
  if (!product) return res.status(404).render('product', { product: null, error: 'No encontrado' });
  res.render('product', { product, error: null });
});

router.get('/login', (req, res) => res.render('login', { error: null, info: null }));

router.post('/login', async (req, res) => {
  const username = (req.body.username || '').toString();
  const password = (req.body.password || '').toString();
  try {
    // SEGURO: busqueda parametrizada; el hash nunca entra al SQL.
    const user = await User.findOne({ where: { username } });
    const ok = user && bcrypt.compareSync(password, user.password_hash);
    if (ok) {
      req.session.user = { id: user.id, username: user.username, role: user.role };
      return res.redirect('/panel');
    }
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
