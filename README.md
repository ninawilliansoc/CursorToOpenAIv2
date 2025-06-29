# CursorToOpenAIv2
Una version modificada de https://github.com/JiuZ-Chn/Cursor-To-OpenAI

# Agregados:
- Api Keys: La posibilidad de utilizar api keys para autenticarse.
- Administracion: Nuevo sitio web de administracion, accesible utilizando /admin.

# ENV (OBLIGATORIO CONFIGURAR)
- RATELIMIT_WORK=true/false (Habilitar o no el ratelimit, visualmente aparecera que sigue habilitado/desactivado pero en realidad estara como lo configures).
- COOKIE_TIME=5s/5m/5h (Tiempo para la rotacion de Cookies, s=segundos, m=minutos, h=horas).
- COOKIE_ROTATION=true/false (Habilitar rotacion de cookies).
- AUTH_COOKIE=COOKIE DE CURSOR.
- PORT=PUERTO DEL SERVIDOR.
- ADMIN_PASSWORD=CONTRASEÑA DEL SITIO WEB DE ADMINISTRACION.
