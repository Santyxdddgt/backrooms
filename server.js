#!/usr/bin/env node
/* ============================================================
 * BACKROOMS — SERVIDOR MULTIJUGADOR GLOBAL (autoritativo)
 * ------------------------------------------------------------
 * WebSocket server RFC6455 sin dependencias externas (Node puro).
 * También sirve los archivos estáticos del juego por HTTP.
 *
 * USO:
 *   node server.js                 → http://localhost:8787
 *   PORT=9000 node server.js
 *
 * DESPLIEGUE PÚBLICO (cualquier host Node: Render / Railway / Fly.io / VPS):
 *   - Subir server.js + index.html + level2.html
 *   - Comando: node server.js   (usa PORT del entorno)
 *   - Los clientes deben configurar la URL: wss://tu-host (en la pestaña
 *     MODO MULTIJUGADOR del menú) o vía ?mpserver=wss://tu-host
 *
 * MODELO DE AUTORIDAD:
 *   - El servidor es la ÚNICA autoridad de: roomId, playerId, pertenencia,
 *     admin, kick, devMode de sala, currentLevel y estado de sesión.
 *   - Identidad: cada jugador recibe (playerId, token secreto). Toda acción
 *     se valida contra el socket autenticado; jamás se confía en campos
 *     isAdmin enviados por el cliente.
 *   - Reconexión: al recargar/cambiar de página el jugador queda "zombi"
 *     durante GRACE_MS y puede re-entrar con el mismo (playerId, token),
 *     conservando sala, rol y estado.
 * ============================================================ */
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const GRACE_MS = 30000;        // ventana de reconexión (recarga / cambio de nivel)
const ROOM_TTL_MS = 90000;    // red de seguridad: sala vacía se destruye YA (ver
                              // destroyRoomIfEmpty); este TTL queda solo como
                              // respaldo defensivo ante cualquier camino no cubierto
const MAX_ROOMS = 50;
const MAX_CONNECTIONS = 64;
const MOVE_RATE_PER_S = 30;    // límite de mensajes 'move' por segundo
const MAX_PLAYERS_OPTIONS = [2, 4, 8, 12];

/* ---------------- utilidades ---------------- */
const uuid = () => crypto.randomUUID();
function genRoomId() {
  // 6 caracteres sin ambiguos (sin 0/O/1/I)
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[crypto.randomInt(abc.length)];
  return s;
}
function cleanName(s, max) {
  if (typeof s !== 'string') return '';
  // quita caracteres de control y recorta
  let out = s.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (out.length > max) out = out.slice(0, max);
  return out;
}
function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function clampCoord(v) {
  if (!isFiniteNum(v)) return 0;
  return Math.max(-10000, Math.min(10000, v));
}
function now() { return Date.now(); }

/* ---------------- estado de salas ---------------- */
/** roomId -> Room */
const rooms = new Map();

class Player {
  constructor(playerId, token, displayName) {
    this.playerId = playerId;
    this.token = token;
    this.displayName = displayName;
    this.connected = false;
    this.socket = null;
    this.level = '0';
    this.x = 1; this.z = 1; this.y = 0; this.yaw = 0; this.moving = false;
    this.joinedAt = now();
    this.zombieSince = 0;   // timestamp en que quedó desconectado
    this.lastMoveAt = 0;
    this.moveWindow = [];   // rate limiting
  }
}

class Room {
  constructor(roomId, roomName, maxPlayers, creator) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.maxPlayers = maxPlayers;
    this.adminPlayerId = creator.playerId;
    this.devModeEnabled = false;
    this.currentLevel = '0';
    this.createdAt = now();
    this.lastActivity = now();
    this.emptySince = 0;
    this.started = false;
    /** playerId -> Player */
    this.players = new Map();
  }
  playerCount() { return this.players.size; }
  livePlayers() { return [...this.players.values()].filter(p => p.connected); }
  admin() { return this.players.get(this.adminPlayerId) || null; }
  isAdmin(p) { return !!p && p.playerId === this.adminPlayerId; }
  publicState() {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      maxPlayers: this.maxPlayers,
      adminPlayerId: this.adminPlayerId,
      devModeEnabled: this.devModeEnabled,
      currentLevel: this.currentLevel,
      createdAt: this.createdAt,
      started: this.started,
      players: [...this.players.values()].map(p => ({
        playerId: p.playerId,
        displayName: p.displayName,
        isAdmin: this.isAdmin(p),
        connected: p.connected,
        level: p.level,
      })),
    };
  }
}

/* ---------------- WebSocket RFC6455 (server mínimo) ---------------- */
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WSConn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.alive = true;
    this.aliveAt = now();      // último pong/actividad recibido
    this.player = null;   // Player autenticado (tras join/create/rejoin)
    this.room = null;
    this.closed = false;
    socket.on('data', d => this.onData(d));
    socket.on('close', () => this.onClose());
    socket.on('error', () => { try { socket.destroy(); } catch (_) {} });
  }
  send(obj) {
    if (this.closed || !this.socket.writable) return;
    try { this.sendRaw(Buffer.from(JSON.stringify(obj), 'utf8'), 0x1); }
    catch (_) { this.close(); }
  }
  sendRaw(payload, opcode) {
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }
  pong(maskedPayload) { this.sendRaw(maskedPayload, 0xA); }
  close(code = 1000) {
    if (this.closed) return;
    this.closed = true;
    try {
      const body = Buffer.alloc(2);
      body.writeUInt16BE(code, 0);
      this.sendRaw(body, 0x8);
    } catch (_) {}
    try { this.socket.end(); } catch (_) {}
    try { this.socket.destroy(); } catch (_) {}
    // cierre limpio → también desconecta al jugador (zombi de gracia)
    handleDisconnect(this);
  }
  onClose() {
    if (this.closed) return;
    this.closed = true;
    handleDisconnect(this);
  }
  onData(chunk) {
    this.aliveAt = now();   // cualquier tráfico entrante = conexión viva
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (true) {
      const frame = this.tryParseFrame();
      if (!frame) break;
      const { opcode, payload, fin } = frame;
      if (opcode === 0x8) { this.close(); return; }
      else if (opcode === 0x9) { this.pong(payload); }
      else if (opcode === 0xA) { this.aliveAt = now(); }
      else if (opcode === 0x1 || opcode === 0x2) {
        if (!fin) { this.close(1003); return; }
        let text;
        try { text = payload.toString('utf8'); }
        catch (_) { this.close(1007); return; }
        if (text.length > 20000) { this.close(1009); return; }
        try { handleMessage(this, JSON.parse(text)); }
        catch (_) { this.send({ t: 'err', code: 'BAD_JSON', msg: 'MENSAJE INVALIDO' }); }
      }
    }
  }
  tryParseFrame() {
    const buf = this.buf;
    if (buf.length < 2) return null;
    const b0 = buf[0], b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;
    if (len === 126) {
      if (buf.length < 4) return null;
      len = buf.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (buf.length < 10) return null;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(4 * 1024 * 1024)) { this.close(1009); return null; }
      len = Number(big); off = 10;
    }
    if (len > 4 * 1024 * 1024) { this.close(1009); return null; }
    const maskLen = masked ? 4 : 0;
    if (buf.length < off + maskLen + len) return null;
    let payload = buf.subarray(off + maskLen, off + maskLen + len);
    if (masked) {
      const mask = buf.subarray(off, off + 4);
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
      payload = out;
    }
    this.buf = buf.subarray(off + maskLen + len);
    return { fin, opcode, payload };
  }
}

/* ---------------- protocolo de juego ---------------- */
function handleMessage(conn, msg) {
  if (!msg || typeof msg.t !== 'string') return;
  switch (msg.t) {
    case 'ping': conn.send({ t: 'pong', ts: now() }); return;
    case 'list': handleList(conn); return;
    case 'create': handleCreate(conn, msg); return;
    case 'join': handleJoin(conn, msg); return;
    case 'rejoin': handleRejoin(conn, msg); return;
    case 'leave': handleLeave(conn); return;
    case 'move': handleMove(conn, msg); return;
    case 'level': handleLevel(conn, msg); return;
    case 'setLevel': handleSetLevel(conn, msg); return;
    case 'start': handleStart(conn); return;
    case 'dev': handleDevToggle(conn, msg); return;
    case 'kick': handleKick(conn, msg); return;
    case 'dact': handleDevAction(conn, msg); return;
    default: return;
  }
}

function handleList(conn) {
  conn.send({
    t: 'rooms',
    rooms: [...rooms.values()].map(r => ({
      roomId: r.roomId,
      roomName: r.roomName,
      players: r.playerCount(),
      maxPlayers: r.maxPlayers,
      currentLevel: r.currentLevel,
      devModeEnabled: r.devModeEnabled,
      status: r.playerCount() >= r.maxPlayers ? 'LLENA' : 'ABIERTA',
    })),
  });
}

function requireNotInRoom(conn) {
  if (conn.room) { conn.send({ t: 'err', code: 'ALREADY_IN_ROOM', msg: 'YA ESTAS EN UNA SALA' }); return false; }
  return true;
}

function handleCreate(conn, msg) {
  if (!requireNotInRoom(conn)) return;
  const roomName = cleanName(msg.room, 24);
  const playerName = cleanName(msg.name, 16);
  const maxPlayers = MAX_PLAYERS_OPTIONS.includes(msg.max) ? msg.max : 8;
  if (!roomName) { conn.send({ t: 'err', code: 'BAD_ROOM_NAME', msg: 'NOMBRE DE SALA INVALIDO' }); return; }
  if (!playerName) { conn.send({ t: 'err', code: 'BAD_NAME', msg: 'NOMBRE DE JUGADOR INVALIDO' }); return; }
  if (rooms.size >= MAX_ROOMS) { conn.send({ t: 'err', code: 'ROOM_LIMIT', msg: 'LIMITE DE SALAS ALCANZADO' }); return; }
  let roomId = genRoomId();
  while (rooms.has(roomId)) roomId = genRoomId();
  const player = new Player(uuid(), uuid(), playerName);
  const room = new Room(roomId, roomName, maxPlayers, player);
  room.players.set(player.playerId, player);
  rooms.set(roomId, room);   // ← registra la sala en el listado global
  attachPlayer(conn, room, player);
  broadcastRoom(room, null);
  conn.send({
    t: 'joined',
    roomId: room.roomId,
    playerId: player.playerId,
    token: player.token,
    room: room.publicState(),
  });
}

function handleJoin(conn, msg) {
  if (!requireNotInRoom(conn)) return;
  const roomId = String(msg.roomId || '').toUpperCase().trim();
  const playerName = cleanName(msg.name, 16);
  if (!playerName) { conn.send({ t: 'err', code: 'BAD_NAME', msg: 'NOMBRE DE JUGADOR INVALIDO' }); return; }
  const room = rooms.get(roomId);
  if (!room) { conn.send({ t: 'err', code: 'ROOM_NOT_FOUND', msg: 'SALA NO ENCONTRADA' }); return; }
  if (room.playerCount() >= room.maxPlayers) { conn.send({ t: 'err', code: 'ROOM_FULL', msg: 'SALA LLENA' }); return; }
  const player = new Player(uuid(), uuid(), playerName);
  room.players.set(player.playerId, player);
  attachPlayer(conn, room, player);
  broadcastRoom(room, null);
  conn.send({
    t: 'joined',
    roomId: room.roomId,
    playerId: player.playerId,
    token: player.token,
    room: room.publicState(),
  });
}

function handleRejoin(conn, msg) {
  if (!requireNotInRoom(conn)) return;
  const roomId = String(msg.roomId || '').toUpperCase().trim();
  const pid = String(msg.pid || '');
  const tok = String(msg.tok || '');
  const room = rooms.get(roomId);
  if (!room) { conn.send({ t: 'err', code: 'ROOM_NOT_FOUND', msg: 'SALA NO ENCONTRADA' }); return; }
  const player = room.players.get(pid);
  if (!player || player.token !== tok) {
    conn.send({ t: 'err', code: 'SESSION_LOST', msg: 'SESION NO VALIDA' });
    return;
  }
  if (player.connected && player.socket && player.socket !== conn) {
    // solo una conexión viva por jugador
    try { player.socket.close(); } catch (_) {}
  }
  attachPlayer(conn, room, player);
  room.lastActivity = now();
  broadcastRoom(room, null);
  conn.send({
    t: 'joined',
    roomId: room.roomId,
    playerId: player.playerId,
    token: player.token,
    room: room.publicState(),
  });
}

function attachPlayer(conn, room, player) {
  player.connected = true;
  player.socket = conn;
  player.zombieSince = 0;
  conn.player = player;
  conn.room = room;
  room.lastActivity = now();
}

function handleLeave(conn) {
  const room = conn.room, player = conn.player;
  if (!room || !player) { conn.send({ t: 'left' }); return; }
  removePlayer(room, player, 'left');
  conn.send({ t: 'left' });
}

/* [CIERRE AUTOMÁTICO] elimina YA del servidor una sala que quedó realmente en
   0 jugadores (players.size === 0: nadie conectado y sin sesiones zombi
   recuperables dentro de la ventana de gracia).
   - Usa la estructura real del proyecto: rooms.delete(roomId).
   - Solo borra si el Map global sigue apuntando a ESTA sala (evita manipular
     una sala nueva que reutilizara el mismo roomId).
   - Limpia el estado residual (emptySince) para que ningún sweep posterior
     intente tocar una sala ya eliminada.
   - Con players vacío no quedan sockets, zombis ni timers de sala que limpiar
     (los intervalos globales iteran el Map y ya no la verán). */
function destroyRoomIfEmpty(room) {
  if (!room || room.players.size !== 0) return false;
  room.emptySince = 0;
  if (rooms.get(room.roomId) === room) rooms.delete(room.roomId);
  return true;
}

function removePlayer(room, player, reason) {
  const wasAdmin = room.isAdmin(player);
  room.players.delete(player.playerId);
  if (player.socket) { player.socket.player = null; player.socket.room = null; }
  if (room.players.size === 0) {
    // [CIERRE AUTOMÁTICO] era el último jugador válido (leave/kick) → la sala
    // deja de existir YA en memoria; NO espera ROOM_TTL_MS ni se oculta del
    // list: se elimina realmente. Un zombi en gracia NO pasa por aquí (la
    // desconexión temporal no borra al jugador del Map), por lo que la
    // ventana de rejoin queda intacta.
    destroyRoomIfEmpty(room);
  } else if (wasAdmin) {
    // política: el admin que se va transfiere el rol al jugador conectado más antiguo
    const next = room.livePlayers().sort((a, b) => a.joinedAt - b.joinedAt)[0]
      || [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) {
      room.adminPlayerId = next.playerId;
      broadcastRoom(room, null);
      broadcastTo(room, { t: 'sys', msg: `ADMIN TRANSFERIDO A ${next.displayName}` });
    }
  } else {
    broadcastRoom(room, null);
  }
}

function handleDisconnect(conn) {
  if (conn.disconnected) return;   // guard anti-doble-disconnect
  conn.disconnected = true;
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  // queda como zombi durante GRACE_MS para permitir recarga / transición
  player.connected = false;
  player.socket = null;
  player.zombieSince = now();
  room.lastActivity = now();
  broadcastRoom(room, null);
}

function handleMove(conn, msg) {
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  // rate limit por jugador
  const t = now();
  player.moveWindow = player.moveWindow.filter(ts => t - ts < 1000);
  if (player.moveWindow.length >= MOVE_RATE_PER_S) return;
  player.moveWindow.push(t);
  if (!isFiniteNum(msg.x) || !isFiniteNum(msg.z)) return;
  player.x = clampCoord(msg.x);
  player.z = clampCoord(msg.z);
  player.y = isFiniteNum(msg.y) ? Math.max(-10, Math.min(50, msg.y)) : 0;
  player.yaw = isFiniteNum(msg.yaw) ? Math.max(-100, Math.min(100, msg.yaw)) : 0;
  player.moving = !!msg.mov;
  // broadcast al resto (no al emisor)
  const payload = {
    t: 'pm',
    id: player.playerId,
    x: player.x, z: player.z, y: player.y,
    yaw: player.yaw, mov: player.moving,
  };
  for (const p of room.players.values()) {
    if (p.connected && p.socket && p.socket !== conn) p.socket.send(payload);
  }
}

function handleLevel(conn, msg) {
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  const lv = String(msg.lv || '0').slice(0, 16);
  if (player.level === lv && room.currentLevel === lv) return;
  player.level = lv;
  // [AUTORIDAD] la sala solo avanza con su ADMIN (transición natural del
  // creador): el auto-reporte de un jugador normal actualiza SU nivel de
  // avatar (visibilidad entre niveles) pero NO cambia el nivel de la sala.
  // El cambio dirigido de nivel es exclusivo de 'setLevel' (valida admin).
  if (room.isAdmin(player) && room.currentLevel !== lv) room.currentLevel = lv;
  // SIEMPRE difundir el cambio de nivel de un jugador (los demás deben
  // mostrar u ocultar su avatar según el nivel en el que esté cada uno)
  broadcastRoom(room, null);
}

// [SELECTOR DE NIVELES] cambio de nivel dirigido por el ADMIN de la sala.
// El servidor es la única autoridad: valida que el emisor sea el admin
// (jamás confía en campos del cliente como isAdmin), fija currentLevel
// y hace broadcast para que TODOS los clientes realicen la transición.
function handleSetLevel(conn, msg) {
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  if (!room.isAdmin(player)) {
    conn.send({ t: 'err', code: 'NOT_ADMIN', msg: 'SOLO EL ADMIN ELIGE EL NIVEL' });
    return;
  }
  const lv = String(msg.lv || '').slice(0, 16);
  if (!lv) return;
  if (room.currentLevel === lv && player.level === lv) return;
  player.level = lv;
  if (room.currentLevel !== lv) room.currentLevel = lv;
  room.lastActivity = now();
  broadcastRoom(room, null);
  broadcastTo(room, { t: 'sys', msg: 'EL ADMIN MOVIÓ LA SALA AL NIVEL ' + lv });
}

function handleStart(conn) {
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  if (!room.isAdmin(player)) {
    conn.send({ t: 'err', code: 'NOT_ADMIN', msg: 'SOLO EL ADMIN PUEDE EMPEZAR' });
    return;
  }
  room.started = true;
  room.lastActivity = now();
  broadcastTo(room, { t: 'started', room: room.publicState() });
}

function handleDevToggle(conn, msg) {
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  if (!room.isAdmin(player)) {
    conn.send({ t: 'err', code: 'NOT_ADMIN', msg: 'SOLO EL ADMIN CONTROLA EL MODO DEV' });
    return;
  }
  const on = !!msg.on;
  if (room.devModeEnabled === on) return;
  room.devModeEnabled = on;
  room.lastActivity = now();
  broadcastTo(room, { t: 'dev', on, room: room.publicState() });
}

function handleKick(conn, msg) {
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  if (!room.isAdmin(player)) {
    conn.send({ t: 'err', code: 'NOT_ADMIN', msg: 'SOLO EL ADMIN PUEDE EXPULSAR' });
    return;
  }
  const targetId = String(msg.pid || '');
  const target = room.players.get(targetId);
  if (!target) {
    conn.send({ t: 'err', code: 'NO_SUCH_PLAYER', msg: 'JUGADOR NO ENCONTRADO' });
    return;
  }
  if (target.playerId === player.playerId) {
    conn.send({ t: 'err', code: 'CANT_KICK_SELF', msg: 'NO PUEDES EXPULSARTE A TI MISMO' });
    return;
  }
  const tsock = target.connected ? target.socket : null;
  const tname = target.displayName;
  removePlayer(room, target, 'kicked');
  if (tsock && !tsock.closed) {
    tsock.send({ t: 'kicked', reason: 'HAS SIDO EXPULSADO DE LA SALA' });
  }
  broadcastTo(room, { t: 'sys', msg: `${tname} FUE EXPULSADO DE LA SALA` });
}

function handleDevAction(conn, msg) {
  const room = conn.room, player = conn.player;
  if (!room || !player) return;
  if (!room.isAdmin(player)) {
    conn.send({ t: 'err', code: 'NOT_ADMIN', msg: 'ACCION DEV RECHAZADA' });
    return;
  }
  if (!room.devModeEnabled) return;
  const a = String(msg.a || '').slice(0, 24);
  if (!a) return;
  broadcastTo(room, { t: 'dact', a, by: player.displayName });
}

function broadcastRoom(room, exceptConn) {
  const state = { t: 'room', room: room.publicState() };
  broadcastTo(room, state, exceptConn);
}
function broadcastTo(room, payload, exceptConn) {
  for (const p of room.players.values()) {
    if (p.connected && p.socket && p.socket !== exceptConn) {
      p.socket.send(payload);
    }
  }
}

/* ---------------- limpieza periódica ---------------- */
setInterval(() => {
  const t = now();
  for (const room of [...rooms.values()]) {
    // expirar zombis
    for (const p of [...room.players.values()]) {
      if (!p.connected && p.zombieSince && t - p.zombieSince > GRACE_MS) {
        const wasAdmin = room.isAdmin(p);
        room.players.delete(p.playerId);
        if (room.players.size === 0) {
          // [CIERRE AUTOMÁTICO] la última sesión de gracia expiró sin volver →
          // sala eliminada YA (el broadcast posterior itera 0 jugadores:
          // no-op seguro sobre una sala destruida).
          destroyRoomIfEmpty(room);
        } else if (wasAdmin) {
          const next = room.livePlayers().sort((a, b) => a.joinedAt - b.joinedAt)[0]
            || [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
          if (next) {
            room.adminPlayerId = next.playerId;
            broadcastTo(room, { t: 'sys', msg: `ADMIN TRANSFERIDO A ${next.displayName}` });
          }
        }
        broadcastRoom(room, null);
      }
    }
    // destruir salas vacías
    if (room.players.size === 0 && room.emptySince && t - room.emptySince > ROOM_TTL_MS) {
      rooms.delete(room.roomId);
    }
  }
}, 5000).unref();

/* ping/keepalive WebSocket + purga de conexiones muertas
   ping cada 2s: en este entorno el close TCP solo se detecta al escribir (EPIPE),
   así que el ping frecuente ES el detector de desconexión (1-4s). */
setInterval(() => {
  const t = now();
  for (const room of rooms.values()) {
    for (const p of [...room.players.values()]) {
      try {
        if (p.connected && p.socket) {
          if (t - p.socket.aliveAt > 10000) {
            // conexión zombi TCP: cerrar y marcar desconexión
            // capturar referencia ANTES: close() → handleDisconnect → player.socket = null
            const dead = p.socket;
            try { dead.close(); } catch (_) {}   // close() ya invoca handleDisconnect
            handleDisconnect(dead);              // guard 'disconnected' evita doble
          } else {
            try { p.socket.sendRaw(Buffer.alloc(0), 0x9); } catch (_) {}
          }
        }
      } catch (_) {} // nunca dejar que la purga tumba el servidor
    }
  }
}, 2000).unref();

/* ---------------- HTTP estático ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};
const ROOT = __dirname;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '') p = '/index.html';
  if (p === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((a, r) => a + r.playerCount(), 0), uptime: Math.floor(process.uptime()) }));
    return;
  }
  const file = path.normalize(path.join(ROOT, path.normalize(p)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('FORBIDDEN'); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA: rutas no encontradas caen al índice (excepto assets)
      if (!path.extname(p)) {
        fs.readFile(path.join(ROOT, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('NO ENCONTRADO'); return; }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(d2);
        });
        return;
      }
      res.writeHead(404); res.end('NO ENCONTRADO');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }
  // límite global de conexiones
  let live = 0;
  for (const r of rooms.values()) for (const p of r.players.values()) if (p.connected) live++;
  if (live >= MAX_CONNECTIONS) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);
  new WSConn(socket);
});

server.listen(PORT, () => {
  console.log(`[BACKROOMS-MP] servidor escuchando en http://localhost:${PORT}`);
  console.log(`[BACKROOMS-MP] websocket en ws://localhost:${PORT} (misma URL http)`);
});

// red de seguridad: un error no capturado NO debe tumbar el servidor de salas
process.on('uncaughtException', (e) => {
  console.error('[BACKROOMS-MP] uncaughtException (servidor sigue vivo):', e && e.message);
});
