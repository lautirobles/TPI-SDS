'use strict';
// Genera db/02-seed.sql con hashes bcrypt reales.  Uso: node app/src/tools/genseed.js > db/02-seed.sql
const bcrypt = require('bcryptjs');
const esc = (s) => String(s).replace(/'/g, "''");
const h = (p) => bcrypt.hashSync(p, 10);

const users = [
  ['admin',   'Adm1n!Pass2024', 'admin@shoplab.local', 'admin'],
  ['jlopez',  'juan1234',        'jlopez@shoplab.local', 'user'],
  ['mgarcia', 'maria2024',       'mgarcia@shoplab.local', 'user'],
  ['svarela', 'sofia.v!',        'svarela@shoplab.local', 'user'],
];

const products = [
  ['Teclado mecanico RGB','Switches rojos, retroiluminacion RGB, USB-C',54.99,40,'Perifericos'],
  ['Mouse inalambrico Pro','6400 DPI, bateria recargable, silencioso',29.50,120,'Perifericos'],
  ['Monitor 27 144Hz','IPS QHD, 1ms, FreeSync',289.00,15,'Monitores'],
  ['Auriculares gamer','7.1 surround, microfono desmontable',69.90,60,'Audio'],
  ['Webcam 1080p','Autoenfoque, correccion de luz',39.99,80,'Video'],
  ['SSD NVMe 1TB','Lectura 3500 MB/s, PCIe 3.0',74.00,55,'Almacenamiento'],
  ['Memoria RAM 16GB','DDR4 3200MHz CL16',41.25,200,'Componentes'],
  ['Silla ergonomica','Soporte lumbar, reposabrazos 4D',159.99,10,'Mobiliario'],
  ['Hub USB-C 7 en 1','HDMI 4K, lector SD, 3x USB 3.0',32.80,90,'Accesorios'],
  ['Microfono condensador','USB, patron cardioide, brazo incluido',88.50,25,'Audio'],
  ['Router WiFi 6','AX3000, doble banda, 4 antenas',96.00,33,'Redes'],
  ['Cable HDMI 2.1 2m','8K60, 48Gbps, trenzado',12.99,300,'Accesorios'],
];

const secrets = [
  ['AWS backup key','AKIA-LAB-7F3K9D2P','aws:s3:backup:9f8e7d6c5b4a3210'],
  ['DB replica creds','replica_user:R3pl1c4-2024','pgsql://replica@10.0.0.9/shop'],
  ['Stripe test secret','sk_test_51LabShopSecret0000','stripe:webhook:whsec_labonly'],
  ['FLAG','FLAG{sqli_orm_mal_usado_=_rce_potencial}','flag-token-00ADMIN00'],
];

const orders = [
  [1,3,1,289.00],[2,1,2,109.98],[3,6,1,74.00],[1,8,1,159.99],[4,2,3,88.50],
];

let out = '';
out += '-- GENERADO AUTOMATICAMENTE por app/src/tools/genseed.js  (hashes bcrypt reales)\n';
out += 'USE shopdb;\n\n';
out += 'INSERT INTO users (username, pass_plain, password_hash, email, role) VALUES\n';
out += users.map(([u,p,e,r]) =>
  `  ('${esc(u)}', '${esc(p)}', '${esc(h(p))}', '${esc(e)}', '${esc(r)}')`).join(',\n') + ';\n\n';
out += 'INSERT INTO products (name, description, price, stock, category) VALUES\n';
out += products.map(([n,d,pr,st,c]) =>
  `  ('${esc(n)}', '${esc(d)}', ${pr}, ${st}, '${esc(c)}')`).join(',\n') + ';\n\n';
out += 'INSERT INTO secrets (label, secret_value, api_token) VALUES\n';
out += secrets.map(([l,v,t]) =>
  `  ('${esc(l)}', '${esc(v)}', '${esc(t)}')`).join(',\n') + ';\n\n';
out += 'INSERT INTO orders (user_id, product_id, quantity, total) VALUES\n';
out += orders.map(([u,p,q,t]) => `  (${u}, ${p}, ${q}, ${t})`).join(',\n') + ';\n';

process.stdout.write(out);
