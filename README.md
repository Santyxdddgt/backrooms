# BACKROOMS MULTIJUGADOR — Paquete completo

## Contenido
- `index.html` — Nivel 0 (hub) con multijugador funcional + selector de niveles para admin
- `level2.html` — Nivel 2 con panel "■ MODO MULTIJUGADOR" completo + chip DEV en partida
- `server.js` — Backend WebSocket (Node.js) con validación server-side de admin

## Cómo ejecutar
1. Descomprime los 3 archivos en la misma carpeta.
2. Instala dependencias del servidor (ninguna externa: solo módulos nativos de Node).
3. Inicia el servidor:
   ```bash
   node server.js
   ```
4. Abre `http://localhost:3000` en dos navegadores/pestañas distintas (usa ventanas de incógnito o navegadores diferentes para probar el multijugador con localStorage aislado).

## Flujo multijugador
1. En el menú de `index.html`, pestaña "■ MODO MULTIJUGADOR": escribe tu nombre y **CREAR SALA**.
2. El primer jugador en unirse es el **ADMIN** (badge dorado).
3. Comparte el código de sala (botón copiar) con el segundo jugador → **UNIRSE**.
4. Al avanzar de nivel (index → level2), la sesión se conserva automáticamente (misma pestaña).
5. En la pestaña MP de `level2.html` puedes: ver estado de conexión, sala, playerId, rol, jugadores conectados, abandonar, o **REANUDAR** sesión tras un refresh.

## Funciones de ADMIN
- **NIVELES DISPONIBLES**: solo muestra niveles completados según tu progreso local (`BACKROOMS_SAVE_V1.levelsCompleted`, solo lectura). Al seleccionar uno, el servidor valida que seas admin y hace broadcast → todos los clientes hacen la transición.
- **Botón [ DEV: OFF / ON ]** en partida (chip en HUD, también en pausa): alterna el modo DEV de la SALA en tiempo real sin reiniciar ni perder posición. El servidor valida que solo el admin pueda cambiarlo.
- **KICK**: expulsar jugadores desde el panel de pausa.

## Seguridad (server-side)
- `setLevel`, `dev`, `kick`, `start` solo aceptan si el remitente es el admin de la sala.
- Un cliente normal NO puede elevarse con `isAdmin:true` desde DevTools: el rol se determina en el servidor.
- Reingreso (rejoin) con token: 30 s de gracia "zombi" antes de eliminar al jugador.

## Notas técnicas
- Sesión persistida en `localStorage`: `BACKROOMS_MP_SESSION` (roomId, playerId, token, name).
- El parche anti-carrera de WebSocket (3 guards: `closedByUs`, `ws !== st.ws`, readyState) está aplicado en ambos clientes.
- `BACKROOMS_SAVE_V1` (progreso individual) NO se modifica jamás por el modo multijugador.
Multi Caca Doors: https://backrooms-mp.onrender.com/
