# Oficial.pe

Directorio profesional con sitio público y panel privado. El frontend se publica como HTML, CSS y JavaScript estáticos en GitHub Pages; Supabase ofrece PostgreSQL, autenticación y la función de registro; Cloudinary almacena las imágenes.

## Capas

- **Sitio público:** `index.html`, `registro.html`, `contacto.html` y `privacidad.html` en `https://www.oficial.pe`.
- **Panel de administración:** `admin/index.html` en `https://www.oficial.pe/admin/`. La interfaz es pública como archivo estático; Supabase Auth, la lista `admin_users`, los permisos y RLS protegen los datos y operaciones.
- **Datos:** `public.profiles` guarda los perfiles y su estado; `public.locations` guarda el catálogo geográfico; `public.directory_public_profiles` expone únicamente columnas públicas de perfiles `Activo`.
- **Registro:** el navegador sube las imágenes a Cloudinary y envía los datos a la Edge Function `register-profile`. El backend valida ubicación, enlaces, campos, duplicados y frecuencia, y siempre crea el estado `Pendiente`.
- **Administración:** al iniciar sesión, el panel consulta y actualiza perfiles usando la sesión Auth. El rol anónimo no puede leer campos privados ni escribir perfiles.

## Conexión de Supabase

`scripts/supabase-config.js` contiene la URL del proyecto y la clave pública publishable heredada `anon`. La clave pública puede estar en el navegador; no es una contraseña. Nunca incluir `service_role`, `sb_secret` ni credenciales administrativas en archivos publicados. La clave de servicio solo se usa en el entorno de Edge Functions y en procesos locales de migración.

La cuenta administrativa se crea en Supabase Authentication y se autoriza agregando su UUID a `public.admin_users`. No existe registro público de administradores. La primera cuenta ya está autorizada; el panel usa el correo y la contraseña de Supabase Auth.

## Datos migrados

El proyecto conectado es `Publicidad` (`vhsocvvjquikjtmqbkwx`). Se migraron 20 perfiles y se añadió una solicitud sintética de prueba (#23), para un total de 21: 17 activos y 4 pendientes. La prueba está marcada `DEMO` y no aparece en la vista pública. La importación conservó los IDs, estados, marcas demo y separación de datos privados. El catálogo fuente para reconstruir `locations` está en `supabase/seed/locations.csv`.

La exportación de origen con datos personales se conserva únicamente en `supabase/private-profiles.export.json`, ignorada por Git. `scripts/migrate-supabase-data.mjs` permite validar el archivo local; solo su opción explícita `--apply` escribe datos y exige variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. No ejecutes la importación otra vez sobre la base que ya contiene registros.

## Desarrollo y verificación

Requiere Node.js 20 o posterior:

```powershell
npm install
npm run preview
```

Abre `http://127.0.0.1:8000`. Ejecuta `npm test` para las pruebas locales. `npm run check:live` comprueba las rutas publicadas, la vista pública de Supabase y el preflight CORS de la Edge Function. El chequeo en vivo necesita acceso a Internet.

Archivos centrales:

- `scripts/index.js`, `scripts/profile-mapper.js` y `scripts/search.js`: lectura, adaptación y búsqueda de la vista pública.
- `scripts/registro.js` y `scripts/location-picker.js`: formulario, carga de ubicaciones y subida de imágenes.
- `scripts/admin.js`, `styles/admin.css` y `admin/index.html`: panel administrativo con Supabase Auth.
- `supabase/schema.sql`: esquema documentado y RLS.
- `supabase/functions/register-profile/index.ts`: validación y recepción del formulario.
- `scripts/migrate-supabase-data.mjs`: migración local de datos de origen.

Sheets y Apps Script ya no forman parte del flujo activo del código. La actualización del dominio queda pendiente de la publicación GitHub Pages; el sitio publicado seguirá mostrando la versión anterior hasta publicar este conjunto de cambios.
