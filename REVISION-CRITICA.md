# Revisión crítica — 11 de octubre de 2026

Se mantiene el sitio estático y el diseño existente. Identidad visual y mejoras estéticas del panel quedan fuera de esta revisión.

## Cambios y comprobaciones

- Registro: validación en servidor, campos administrativos forzados a Pendiente/no verificado/no destacado, control de duplicados, límite de tamaño y combinaciones reales de departamento/provincia/distrito.
- Protección básica: campo trampa, tiempo mínimo de llenado y límite de intentos por contacto y global. No sustituye CAPTCHA ni evita ataques distribuidos o consumo de cuotas de Google.
- Envío: validación previa antes de subir imágenes; ID estable para reintentos; recuperación de respuesta perdida sin duplicar filas. Confirmaciones retenidas hasta 24 horas y 40 solicitudes recientes. Los contactos duplicados siguen bloqueados después de ese periodo.
- Sheets: los registros nuevos ocupan la primera fila completamente disponible, aunque existan casillas preparadas al final. Las filas parcialmente completadas se preservan.
- Imágenes: preset unsigned `directorio`, JPG, nombres aleatorios, sin sobrescritura, transformación entrante `c_limit,w_1200,h_1500/f_jpg,q_85`, devolución de token temporal de eliminación. Carga y limpieza verificadas contra Cloudinary; una imagen técnica de 2.000×2.000 se almacenó como JPG de 1.200×1.200.
- El formulario reutiliza imágenes en reintentos y limpia cargas descartadas cuando puede confirmar que no fueron usadas. Si el guardado es incierto, conserva las imágenes para no borrar un recurso posiblemente referenciado.
- Publicación: exportación desde `perfiles` con estado exactamente `Activo`, 22 campos permitidos e IDs únicos. No se publican correo, teléfono interno, fecha de nacimiento, notas ni estado administrativo.
- Demostraciones: perfiles 1–16 conservados, señalados como demostración y sin botones de contacto. Sus IDs se mantienen en `data/perfiles-demo.json`.
- Visibilidad y rendimiento: canonical y URL social de las cuatro páginas, robots y sitemap; imágenes ajustadas a 150×150 y 540×720, carga diferida y tamaño reservado. Las fichas con hash no tienen documentos HTML individuales para indexación.
- Pruebas: validaciones, inyección de campos administrativos, duplicados, respuesta perdida, reintentos, fila con casillas, aislamiento de exportación, CSV y metadatos. Navegador: búsqueda, favoritos, recarga de ficha directa y formulario en 390 px; ficha y formulario sin desbordamiento en 320 px.
- Prueba real: registro técnico enviado desde navegador, confirmado como Pendiente y retirado después. Segunda prueba contra versión 12: escritura en la fila 20 y reintento con el mismo ID sin filas adicionales; se limpió solo esa fila preservando sus validaciones. Ninguna aprobación ni publicación de datos de prueba. Imágenes técnicas eliminadas tras comprobar la carga.

## Respaldo y recuperación

- Copia nativa de Sheets, incluyendo las tres pestañas, comprobada con los 18 IDs originales: [respaldo previo](https://docs.google.com/spreadsheets/d/1xGuXgNo_z5hTvvmUqs8FKYpYwV-JNTC8yjy8tSWS-ds/edit).
- CSV, clasificación de demostraciones y 36 imágenes públicas originales con manifiesto SHA-256: [archivo en Drive](https://drive.google.com/file/d/1WaIt7v_XjUhMsSYPa7qSTAnlyRGQwatN/view). Se extrajo el ZIP y se comprobaron nuevamente los 36 hashes.
- Para generar otra copia pública: `npm run backup:public`. `backups/` está excluido de Git. Este respaldo cubre imágenes referenciadas en la web; no todo el inventario de Cloudinary.
- Para recuperar la web, restaurar una revisión de Git y volver a publicar. Para recuperar datos, copiar primero la hoja de respaldo y revisar diferencias antes de sustituir datos de producción.
- Si desaparece una imagen, recuperarla desde el ZIP, subirla a Cloudinary y actualizar su URL en Sheets y CSV. La URL original no está garantizada al recrear un recurso.
- Backend y panel tienen código versionado; recuperar una revisión requiere subirla con clasp. El backend público también requiere desplegar una versión en la implementación existente. La versión 10 precede esta revisión; la 12 incluye los cambios actuales.
- Las credenciales de Google son locales, están excluidas de Git y deben autorizarse de nuevo en otra computadora.

## Límites que siguen requiriendo atención

1. Cloudinary unsigned permite cargas directas fuera del formulario. El límite de 1 MB se aplica en el navegador, no como cuota del preset. La normalización no impide consumo de recursos; protección fuerte requiere carga firmada y, si hay abuso, CAPTCHA. El token de borrado dura 10 minutos y no reemplaza una revisión del inventario.
2. `npm audit` informa tres alertas altas por una sola dependencia transitiva `braces` de clasp 3.4.1. El [aviso oficial](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) no tiene versión corregida. Se probó clasp 2.5.0 y produjo diez alertas, por lo que se descartó. `scripts/protect-tooling.mjs`, ejecutado automáticamente después de `npm ci`, limita a 128 niveles la profundidad del árbol que genera el parser de braces. Las pruebas rechazan patrones con 3.000 niveles dentro del límite de longitud del paquete y conservan patrones normales; se comprobó acceso a Google después de aplicar el parche. Es una mitigación local para los patrones de clasp, no una versión corregida oficial ni protección para árboles AST construidos externamente. Al actualizar la dependencia, revisar y retirar el parche cuando corresponda. La herramienta no se carga en el sitio ni en Apps Script. No se oculta la alerta ni se afirma una auditoría sin vulnerabilidades.
3. Las mediciones HTTP fueron de 118–265 ms para páginas y CSV en una comprobación desde este equipo. Una carga local con caché alcanzó DOMContentLoaded en 99 ms; no incluye la finalización de todas las imágenes asíncronas. Son muestras de diagnóstico, no resultados de Lighthouse/Core Web Vitals ni garantía para todas las redes.

## Comandos de verificación

`npm test` ejecuta las pruebas reproducibles. `npm run check:live` comprueba las páginas, CSV y versión del servicio publicado. GitHub Actions ejecuta `npm ci` y `npm test` en cada push y pull request.

Orden de despliegue: backend compatible primero, formulario después. Una versión antigua del backend no entiende la validación previa y no debe combinarse con el formulario nuevo.
