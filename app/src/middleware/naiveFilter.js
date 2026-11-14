'use strict';
/* ===========================================================================
 *  FILTRO INGENUO (blacklist)  -  anti-ejemplo defensivo a nivel aplicacion.
 *  Se activa con NAIVE_FILTER=true SOLO en la app vulnerable.
 *
 *  Modela el ERROR CLASICO: una blacklist de palabras clave comparada de forma
 *  CASE-SENSITIVE (solo mayusculas). Es un "control basico" tipico... y debil.
 *
 *  Por que falla (y como lo evaden los tampers de SQLMap):
 *   - SQL es case-insensitive en las palabras clave -> 'union' = 'UNION'.
 *     La blacklist solo mira mayusculas, asi que 'union select' pasa.
 *     (tamper de SQLMap equivalente: --tamper=lowercase)
 *   - No contempla comentarios inline, codificaciones, etc.
 *
 *  LECCION: el blacklisting no es una mitigacion valida. La solucion real es la
 *  parametrizacion (ver app-secure).  NO USAR ESTO COMO DEFENSA.
 * =========================================================================== */
const BLACKLIST = [
  'UNION', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP',
  'OR', 'AND', 'SLEEP', 'BENCHMARK', 'ORDER BY', 'EXTRACTVALUE', 'UPDATEXML',
];

// Comparacion CASE-SENSITIVE (el fallo deliberado): solo detecta mayusculas.
function scan(value) {
  if (typeof value !== 'string') return false;
  return BLACKLIST.some((kw) => value.includes(kw));
}

function walk(obj) {
  if (!obj) return false;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string' && scan(v)) return true;
    if (typeof v === 'object' && walk(v)) return true;
  }
  return false;
}

module.exports = function naiveFilter(req, res, next) {
  if (walk(req.query) || walk(req.body) || walk(req.params)) {
    return res.status(403).send('403 Forbidden - patron sospechoso detectado (filtro ingenuo / blacklist)');
  }
  next();
};
