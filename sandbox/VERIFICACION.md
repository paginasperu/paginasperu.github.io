# Verificación de esta propuesta

- `npm test`: herramientas, registro, validación del formulario, panel y CSV público correctos (18 perfiles).
- Navegador: cabecera, tarjetas y ficha revisadas en escritorio y móvil; sin desbordamiento horizontal en móvil.
- Búsqueda sin resultados y restablecimiento comprobados. Filtrar por Cusco devuelve dos perfiles y limpiar recupera los 18.
- Formulario: errores junto a los campos, foco en el primero y retirada del error al corregirlo. La confirmación y conservación de datos ante fallo se probaron con transporte simulado, sin crear registros en producción.
- Panel de prueba: aprobar y avanzar, rechazar y avanzar, cola vacía y conservación de notas comprobados. No se modificaron registros reales.
- Consola de las tres vistas: sin errores ni advertencias durante estas pruebas.
- Panel real sincronizado mediante `clasp push`. Cerrar y volver a abrir la barra lateral de Sheets para cargar la nueva interfaz.

La portada propuesta sigue aislada en `sandbox/`. El formulario y los ajustes de accesibilidad están en el código local. No se hizo commit ni publicación de la web en esta etapa.
