# Directorio Oficial de Publicidad

Sitio estático para descubrir perfiles profesionales y recibir solicitudes de registro en `oficial.pe`.

## Estructura

- `index.html`: directorio público.
- `assets/css/`: estilos del sitio, registro y privacidad.
- `assets/js/`: scripts del sitio, registro y configuración pública.
- `registro/` y `privacidad/`: páginas del formulario y la política.
- `data/perfiles.csv`: datos públicos del directorio.
- `data/distritos.csv`: catálogo de ubicación del formulario.
- `CNAME`: dominio personalizado `oficial.pe`.
- `404.html`: página de enlaces y error 404.

El formulario valida en el navegador y Apps Script vuelve a validar antes de guardar en la hoja privada. Las imágenes se cargan en Cloudinary. La configuración del cliente solo contiene valores públicos: no agregues API Secrets, contraseñas ni credenciales privadas.

Para actualizar perfiles, reemplaza `data/perfiles.csv` por una exportación de la vista pública de la hoja.

