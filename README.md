# Data Practice Lab

Web educativa para practicar Python orientado a Data Science en espanol.

## Funcionalidades
- Ejercicios por tema: `Python`, `Programacion Funcional`, `Manejo de Errores`, `NumPy`, `Pandas`, `POO`.
- Orden por dificultad dentro de cada tema: `Basico -> Intermedio -> Avanzado`.
- Editor con resaltado de sintaxis (`Ace Editor`).
- Ejecucion de codigo Python en navegador (`Pyodide`).
- Validacion automatica por tests.
- Pistas progresivas.
- Seguimiento de progreso: ejercicios marcados como hechos (persisten en `localStorage`).
- Descarga del codigo actual en `.py` para abrirlo en cualquier IDE.
- Seccion de autoria visible en la pagina (nombre + LinkedIn).
- Popup inicial con acceso opcional a clasificacion:
  - Registro/Login con nombre completo + contraseña.
  - O continuar sin clasificacion.
- Contadores de comunidad (visitas y ejercicios realizados).
- Clasificacion global por ejercicios completados.

## Estructura del proyecto
- `index.html`: entrada de la app.
- `src/css/styles.css`: estilos.
- `src/data/exercises.js`: banco de ejercicios y metadatos.
- `src/js/app.js`: logica de UI, runtime Python, progreso, comunidad y ranking.
- `src/js/app-config.js`: configuracion de Supabase (URL + clave publicable).

## Ejecutar en local
```bash
python3 -m http.server 8000
```
Abre `http://localhost:8000`.

## Hosting en GitHub Pages
La app es estatica (HTML/CSS/JS), asi que se puede publicar directamente en GitHub Pages sin backend.

## Backend con Supabase
Para persistir visitas, ejercicios globales y clasificacion entre despliegues:

1. En Supabase abre `SQL Editor` y ejecuta `backend/supabase/schema.sql`.
2. Pega en `src/js/app-config.js`:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
3. Vuelve a desplegar en GitHub Pages.

### Nota sobre autenticacion
El frontend usa clave publicable de Supabase (segura para cliente) y endpoints de Auth.
Para evitar bloqueos en registro/login simple, revisa en Supabase Auth si necesitas desactivar confirmacion de email para este flujo.
