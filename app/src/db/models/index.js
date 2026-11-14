'use strict';
const { DataTypes } = require('sequelize');
const { sequelize } = require('../sequelize');

// Modelos mapeados al esquema existente (creado por db/01-schema.sql).
// timestamps:false porque gestionamos las columnas a mano en SQL.

const User = sequelize.define('User', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username:      { type: DataTypes.STRING(50), allowNull: false, unique: true },
  pass_plain:    { type: DataTypes.STRING(100), allowNull: false },
  password_hash: { type: DataTypes.STRING(100), allowNull: false },
  email:         { type: DataTypes.STRING(120) },
  role:          { type: DataTypes.STRING(20), defaultValue: 'user' },
}, { tableName: 'users', timestamps: false });

const Product = sequelize.define('Product', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:        { type: DataTypes.STRING(140), allowNull: false },
  description: { type: DataTypes.TEXT },
  price:       { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  stock:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  category:    { type: DataTypes.STRING(60) },
}, { tableName: 'products', timestamps: false });

const Secret = sequelize.define('Secret', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  label:        { type: DataTypes.STRING(80) },
  secret_value: { type: DataTypes.STRING(255) },
  api_token:    { type: DataTypes.STRING(128) },
}, { tableName: 'secrets', timestamps: false });

module.exports = { User, Product, Secret };
