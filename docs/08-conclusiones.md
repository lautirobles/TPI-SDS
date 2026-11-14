# 08 — Conclusiones

## Síntesis del trabajo
Se construyó una aplicación web realista (mini-tienda "ShopLab") con **Node.js +
Express + Sequelize (ORM) + MySQL**, en dos variantes: **vulnerable** y **remediada**,
más capas de infraestructura (mínimo privilegio y WAF). Se recorrió el ciclo completo:
análisis ofensivo (manual + automatizado), evaluación de impacto y defensa en código e
infraestructura.

## Hallazgos clave
1. **Un ORM no previene SQLi por sí solo.** Usando Sequelize **mal** (`sequelize.query`
   con interpolación, comparar credenciales en SQL) se reintrodujeron dos inyecciones:
   el **bypass de autenticación** en el login y la **extracción de datos por UNION** en el
   buscador. Usando el ORM **bien** (parámetros/`Op`, `bcrypt`, validación), ambas desaparecen.
2. **Los identificadores no se parametrizan.** Aunque el ordenamiento no quedó como
   vulnerabilidad activa, se lo protegió con **whitelist** justamente porque ningún
   *prepared statement* parametriza nombres de columna o dirección de orden: es el punto
   ciego clásico cuando se confía ciegamente en el ORM.
3. **El impacto escala con el privilegio.** Con `FILE`, la inyección del buscador permitió
   leer el sistema de archivos del host de BD (`LOAD_FILE('/etc/passwd')` → 575 bytes) y
   habilitar el intento de `--os-shell`. Con **mínimo privilegio** (`app_least`) ese techo
   desaparece (`LOAD_FILE` → NULL).
4. **El WAF ayuda pero no alcanza.** CRS bloqueó la extracción por UNION incluso con
   tampers (`randomcase`, `space2comment`, `charencode`) → es robusto. Pero el bypass de
   login `admin' -- ` **atravesó el WAF** (302): no cubre el 100% ni reemplaza corregir el
   código.

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
