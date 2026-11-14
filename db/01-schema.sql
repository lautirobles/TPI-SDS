-- ===========================================================================
--  Esquema de la base de datos "shopdb" (mini-tienda)
-- ===========================================================================
CREATE DATABASE IF NOT EXISTS shopdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shopdb;

DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS secrets;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  -- pass_plain: usado por la APP VULNERABLE (comparacion en SQL por string).
  --   Es tambien una mala practica a criticar: contrasena en texto plano.
  pass_plain    VARCHAR(100) NOT NULL,
  -- password_hash: usado por la APP REMEDIADA (bcrypt + bcrypt.compare en codigo).
  password_hash VARCHAR(100) NOT NULL,
  email         VARCHAR(120),
  role          VARCHAR(20)  NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(140) NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock       INT NOT NULL DEFAULT 0,
  category    VARCHAR(60)
);

CREATE TABLE orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  product_id  INT,
  quantity    INT,
  total       DECIMAL(10,2),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Tabla "jugosa": el objetivo de un volcado (dump) exitoso
CREATE TABLE secrets (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  label        VARCHAR(80),
  secret_value VARCHAR(255),
  api_token    VARCHAR(128)
);
