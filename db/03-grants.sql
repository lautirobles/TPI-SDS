-- ===========================================================================
--  Usuarios de base de datos  ->  demostracion del PRINCIPIO DE MINIMO PRIVILEGIO
-- ===========================================================================
-- (1) app_root : usuario de la APP VULNERABLE.
--     Privilegios excesivos a proposito: ALL + FILE.
--     - FILE habilita LOAD_FILE() e INTO OUTFILE/DUMPFILE  -> --file-read / --file-write
--     - Es la precondicion para intentar --os-shell (UDF / escritura de webshell)
CREATE USER IF NOT EXISTS 'app_root'@'%' IDENTIFIED BY 'app_root_pw';
GRANT ALL PRIVILEGES ON shopdb.* TO 'app_root'@'%';
GRANT FILE ON *.* TO 'app_root'@'%';          -- privilegio global peligroso
GRANT PROCESS ON *.* TO 'app_root'@'%';

-- (2) app_least : usuario de la APP REMEDIADA.
--     Solo lo imprescindible para la logica de negocio (CRUD sobre shopdb).
--     SIN FILE, SIN PROCESS, SIN acceso a otros esquemas (mysql.*, information_schema full, etc.)
--     -> --file-read, --file-write y --os-shell FALLAN aunque exista una inyeccion.
CREATE USER IF NOT EXISTS 'app_least'@'%' IDENTIFIED BY 'app_least_pw';
GRANT SELECT, INSERT, UPDATE, DELETE ON shopdb.* TO 'app_least'@'%';

FLUSH PRIVILEGES;
