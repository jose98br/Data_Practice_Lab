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
- Popup inicial para registrar nombre de usuario.
- Contadores de comunidad (visitas y ejercicios realizados).
- Clasificacion global por ejercicios completados.

## Estructura del proyecto
- `index.html`: entrada de la app.
- `src/css/styles.css`: estilos.
- `src/data/exercises.js`: banco de ejercicios y metadatos.
- `src/js/app.js`: logica de UI, runtime Python, progreso, comunidad y ranking.
- `src/js/app-config.js`: URL de backend comunitario.
- `backend/google-apps-script/Code.gs`: backend gratuito para Google Apps Script + Sheets.

## Ejecutar en local
```bash
python3 -m http.server 8000
```
Abre `http://localhost:8000`.

## Hosting en GitHub Pages
La app es estatica (HTML/CSS/JS), asi que se puede publicar directamente en GitHub Pages sin backend.

## Backend gratuito (Google Sheets + Apps Script)
Para persistir visitas, ejercicios globales y clasificacion entre despliegues:

1. Crea una Google Sheet vacia.
2. En `Extensiones > Apps Script`, pega el contenido de `backend/google-apps-script/Code.gs`.
3. Publica como `Web app`:
   - Execute as: `Me`
   - Who has access: `Anyone`
4. Copia la URL del Web App.
5. Pega la URL en `src/js/app-config.js` en `COMMUNITY_API_URL`.
6. Vuelve a desplegar en GitHub Pages.
