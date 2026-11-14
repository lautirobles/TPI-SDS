# 08 — Conclusiones

## Síntesis del trabajo
Se construyó una aplicación web realista (mini-tienda "ShopLab") con **Node.js +
Express + Sequelize (ORM) + MySQL**, en dos variantes: **vulnerable** y **remediada**,
más capas de infraestructura (mínimo privilegio y WAF). Se recorrió el ciclo completo:
análisis ofensivo (manual + automatizado), evaluación de impacto y defensa en código e
infraestructura.

## Hallazgos clave
1. **Un ORM no previene SQLi por sí solo.** Las malas prácticas (raw query interpolada,
   `literal()`, identificadores en `ORDER BY`, comparar credenciales en SQL) reintroducen
   la vulnerabilidad. Se demostraron las 4 técnicas: UNION, Error-based, Boolean-blind y
   Time-based blind, más el bypass de autenticación.
2. **El identificador en `ORDER BY` es un punto ciego**: ningún *prepared statement*
   parametriza nombres de columna; la única defensa es la **whitelist**.
3. **El impacto escala con el privilegio.** Con `FILE` se leyó el sistema de archivos del
   host de BD (`/etc/passwd`) y se habilitó el intento de `--os-shell`. Con **mínimo
   privilegio** ese techo desaparece.
4. **Los controles por blacklist fallan**: un filtro case-sensitive se evade con
   `--tamper=lowercase`. Un **WAF (CRS)** es mucho más robusto (normaliza y bloquea), pero
   **no es infalible** ni reemplaza corregir el código.

## La jerarquía de defensa (lección central)
| Capa | Qué aporta | ¿Suficiente sola? |
|---|---|---|
| Parametrización / ORM correcto | Elimina la **causa raíz** | **Es la base** |
| Mínimo privilegio en BD | Limita el **impacto** residual | No |
| WAF (CRS) | Bloquea ataques conocidos | No |
| Validación de entrada + errores genéricos | Reduce superficie e info leak | No |

> Orden correcto: **primero** corregir el código; el resto son capas que asumen que la
> primera puede fallar.

## Checklist defensivo final
- [ ] Consultas **parametrizadas** siempre (`replacements`/`bind`, operadores `Op`).
- [ ] **Whitelist** para identificadores (ORDER BY, columnas dinámicas).
- [ ] **Validación** de tipos y longitudes.
- [ ] **bcrypt/argon2** para contraseñas; nunca texto plano ni comparación en SQL.
- [ ] **Mínimo privilegio** en la cuenta de BD (sin `FILE`/`SUPER`); stacked queries off.
- [ ] **WAF** en modo bloqueo como capa adicional + logging/alertas.
- [ ] **Errores genéricos** al usuario; detalle sólo en logs del servidor.
- [ ] **Dependencias actualizadas** (CVEs del propio ORM).

## Reproducibilidad
Todo el entorno se levanta con `docker compose up -d --build`. El script
`evidencias/run-demo.sh` reproduce automáticamente las pruebas ofensivas/defensivas y
guarda la salida como evidencia.
