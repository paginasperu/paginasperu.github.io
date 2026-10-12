# Migración a Supabase

## Resultado

El flujo de aplicación ya usa GitHub Pages para servir sitio y panel, Supabase para PostgreSQL, Auth y el registro en servidor, y Cloudinary para las imágenes. El código de Apps Script, la administración de Sheets, el CSV operativo y los prototipos se retiraron del árbol publicable. Se conservaron copias locales ignoradas en `backups/legacy-*` para recuperación.

## Datos y protección

- 20 perfiles migrados y 1 envío de prueba sintético (#23); total 21, con 17 activos y 4 pendientes. La solicitud de prueba está marcada `DEMO` y no se muestra al público.
- 1,891 ubicaciones importadas para el formulario.
- Los 18 perfiles demo conservan su marca; la vista pública devuelve solo los 17 activos.
- La vista usa lista explícita de campos públicos. RLS bloquea a visitantes de los datos privados y de escrituras; el panel necesita una sesión Auth y una membresía en `admin_users`.
- La cuenta Auth del administrador está confirmada y tiene una fila en `admin_users`. La función `register-profile` tiene permisos mínimos para leer ubicaciones/perfiles e insertar perfiles y límites de envío.
- La clave pública de Supabase está en el frontend; la clave de servicio queda en Supabase y en variables locales de migración, nunca en la web.

## Verificación

`npm test` verifica el backend de registro, las validaciones del formulario, el catálogo, la búsqueda, los campos públicos, el panel y las rutas locales. En navegador se comprobó la carga de 17 perfiles con imágenes y el envío real de una solicitud sintética: el registro quedó pendiente y marcado como demo. El asesor de seguridad no detecta problemas de RLS, pero avisa que la protección de contraseñas filtradas está desactivada; en el plan Free esta opción requiere Pro. El asesor de rendimiento marca dos índices como `INFO` porque aún no han recibido carga real.

## Antes del corte público

1. Iniciar sesión en el panel con el correo y contraseña creados en Supabase Auth para verificar la sesión desde el navegador.
2. Publicar el conjunto local en GitHub Pages para que `www.oficial.pe` sirva la versión conectada a Supabase. Hasta ese corte, el dominio público conserva la versión anterior.
3. Ejecutar `npm run check:live` desde un equipo con acceso de red para validar las rutas publicadas, la vista pública y CORS del endpoint.

La antigua exportación de Sheets permanece excluida de Git en `supabase/private-profiles.export.json` como fuente de trazabilidad. No vuelvas a ejecutar el importador sobre la base ya poblada: se detiene si detecta perfiles existentes.
