# Data Practice Lab

Web educativa para practicar Python orientado a Data Science en espanol.

## Funcionalidades
- Ejercicios por tema: `Python`, `Programacion Funcional`, `Manejo de Errores`, `NumPy`, `Pandas`, `POO`.
- Orden por dificultad dentro de cada tema: `Basico -> Intermedio -> Avanzado`.
- Editor con resaltado de sintaxis (`Ace Editor`).
- Ejecucion de codigo Python en navegador (`Pyodide`).
- Validacion automatica por tests.
- Pistas progresivas.
- Boton de solucion automatica.
- Seguimiento de progreso: ejercicios marcados como hechos (persisten en `localStorage`).
- Descarga del codigo actual en `.py` para abrirlo en cualquier IDE.
- Seccion de autoria visible en la pagina (nombre + LinkedIn).

## Estructura del proyecto
- `index.html`: entrada de la app.
- `src/css/styles.css`: estilos.
- `src/data/exercises.js`: banco de ejercicios y metadatos.
- `src/js/app.js`: logica de UI, runtime Python, progreso y descarga.

## Ejecutar en local
```bash
cd "/home/jose/Documentos/Proyecto de Data"
python3 -m http.server 8000
```
Abre `http://localhost:8000`.

## Hosting en GitHub Pages
La app es estatica (HTML/CSS/JS), asi que se puede publicar directamente en GitHub Pages sin backend.
