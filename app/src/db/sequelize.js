'use strict';
const { Sequelize } = require('sequelize');

const MODE = process.env.MODE || 'vulnerable';
const isVuln = MODE === 'vulnerable';

/*
 * Diferencia de configuracion clave entre entornos:
 *
 *  - multipleStatements: true  (solo en el entorno VULNERABLE)
 *        Permite "stacked queries" (p.ej.  '; DROP TABLE ...  o  ; SELECT sys_exec(...)).
 *        Es una precondicion habitual para que SQLMap intente --os-shell via UDF.
 *
 *  - multipleStatements: false (entorno REMEDIADO)
 *        El driver rechaza multiples sentencias en una sola llamada.
 *        Sumado al usuario de minimo privilegio, bloquea la cadena de os-shell.
 */
const sequelize = new Sequelize(
  process.env.DB_NAME || 'shopdb',
  process.env.DB_USER || 'app_root',
  process.env.DB_PASS || 'app_root_pw',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      multipleStatements: isVuln,   // <--- diferencia deliberada
    },
    pool: { max: 10, min: 0, idle: 10000 },
  }
);

module.exports = { sequelize, MODE, isVuln };
