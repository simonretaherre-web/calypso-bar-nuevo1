CALYPSO BAR NUEVO 1 — archivos del proyecto

Incluye:
- index.html: carta pública, filtros y recomendación.
- admin.html: panel de administración con recetas, preparaciones privadas, inventario y escáner.
- firebase-config.js: configuración Firebase y correo administrador.
- firestore.rules: reglas de seguridad de Firestore.
- manifest.webmanifest: base para instalar el menú en el teléfono.
- netlify.toml: configuración básica de publicación.

ANTES DE USAR:
1. En firebase-config.js, cambia ADMIN_EMAIL por el correo exacto de tu mamá.
2. En firestore.rules, cambia CAMBIA_POR_EL_CORREO_DE_TU_MAMA por ese mismo correo.
3. Publica las reglas en Firebase Console > Firestore Database > Rules.
4. En Firebase Console > Authentication > Sign-in method, activa Email/Password.
5. En Authentication > Users, crea la cuenta de tu mamá con su correo y contraseña.
6. En Firebase Console > Authentication > Settings > Authorized domains, añade el dominio de Netlify cuando publiques.
7. Sube TODOS estos archivos a la raíz del nuevo repositorio de GitHub y conéctalo a Netlify.

IMPORTANTE:
- La configuración Firebase identifica el proyecto existente `calypso-bar`; confirma que quieres reutilizarlo antes de cargar datos reales.
- El formulario de login usa Firebase Authentication; no puede iniciar sesión hasta que habilites Email/Password y crees la cuenta.
- La carta tiene 16 recetas de muestra como respaldo. Las recetas de Firestore aparecerán cuando existan documentos en `recipesPublic`.
- Las preparaciones se guardan en `recipesPrivate` y el inventario en `inventory`, protegidos por las reglas indicadas.
- El escáner usa BarcodeDetector; no está disponible en todos los navegadores. Si no funciona, el campo permite escribir el código manualmente.
- No hay consumo automático de ingredientes al preparar un cóctel, ni subida de fotos todavía.
- Revisa las reglas y prueba con una cuenta de invitado antes de usar el sitio públicamente.
