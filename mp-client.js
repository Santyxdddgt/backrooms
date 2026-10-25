/* ============================================================
   BACKROOMS — MP CLIENT COMPARTIDO (v2.1)
   ------------------------------------------------------------
   Multijugador online idéntico al del Nivel 0 para TODOS los
   niveles: botón "MODO MULTIJUGADOR — ONLINE" (wss://backrooms-
   mp.onrender.com), lista de servidores globales, crear/unirse
   a salas, admin + kick, EMPEZAR con spawn en anillo, avatares
   remotos con color de sesión y nametag, chat global (T / botón
   táctil), salida con confirmación, reconexión por token,
   sesión conservada al saltar de nivel y selector de nivel de
   sala para el admin.

   Integración por nivel (adaptador):
     MPClient.init({ level:'31', theme:'neon', eye:1.62,
       spawn:{x:0,z:0}, leftHost:'#start .startLeft',
       tabsHost:'#start .tabsRk', tabClass:'tabRk', tabOnClass:'on',
       paneHost:'#start .briefRk', paneClass:'tabPaneRk', paneHidden:'hidden',
       interop:'datapane', getThree:()=>THREE, getScene:()=>scene,
       getPos:()=>({x,z,feet,yaw}), isPlaying:()=>S.started,
       autoEnter:(pos,record)=>{}, returnToMenu:()=>{},
       pauseIfPlaying:()=>{}, toast:(m)=>{}, playTime:()=>0 });

   El cliente se autocontiene: inyecta su CSS, su pestaña, su
   panel, el botón ONLINE, el modal de confirmación, el chat y
   los botones de SALIR. No requiere tocar el loop del juego
   (corre su propio requestAnimationFrame a 10 Hz de envío).
   ============================================================ */
(function () {
  'use strict';
  if (window.MPClient) return;   // doble inclusión: ignorar

  var DEFAULT_SERVER = 'wss://backrooms-mp.onrender.com';

  /* Todos los niveles reales del juego (selector admin + navegación de sala) */
  var DEFAULT_LEVELS = [
    { id: '0',       file: 'index.html',                 label: 'NIVEL 0 — THE LOBBY' },
    { id: '2',       file: 'level2.html',                label: 'NIVEL 2 — PIPE DREAMS' },
    { id: '3',       file: 'level3.html',                label: 'NIVEL 3 — ERROR 404' },
    { id: '31',      file: 'level31.html',               label: 'NIVEL 31 — ROLLER RINK' },
    { id: '31_post', file: 'level31_postblackout.html',  label: 'NIVEL 31 — POST-BLACKOUT' },
    { id: '37',      file: 'poolrooms.html',             label: 'NIVEL 37 — POOLROOMS' },
    { id: '37_2',    file: 'level37-2.html',             label: 'NIVEL 37.2 — DARK POOLROOMS' },
    { id: 'hub',     file: 'the-hub.html',               label: 'THE HUB' }
  ];

  /* Paletas por nivel (borde/acento, texto, fondo de panel) */
  var THEMES = {
    green: { a: '#8cdca0', aDim: 'rgba(140,220,160,.42)', aBg: 'rgba(16,40,22,.88)', aBg2: 'rgba(6,16,9,.94)', txt: '#d8f5de', txt2: '#b8d8c0', glow: 'rgba(120,255,160,.30)', admin: '#ffd27a', warn: '#f0b8b8', warnBg: 'rgba(40,12,12,.9)' },
    cyan:  { a: '#7ff3ff', aDim: 'rgba(125,243,255,.40)', aBg: 'rgba(8,50,66,.88)',  aBg2: 'rgba(5,40,54,.94)',  txt: '#dffcff', txt2: '#9fd8e8', glow: 'rgba(125,243,255,.30)', admin: '#ffd9a0', warn: '#ffb0a0', warnBg: 'rgba(40,12,12,.9)' },
    gold:  { a: '#cfc27a', aDim: 'rgba(207,194,122,.42)', aBg: 'rgba(30,27,11,.88)', aBg2: 'rgba(18,16,6,.94)',  txt: '#e8dc96', txt2: '#b8ad78', glow: 'rgba(230,210,140,.25)', admin: '#ffd27a', warn: '#ffb0a0', warnBg: 'rgba(40,12,12,.9)' },
    neon:  { a: '#ff5fd2', aDim: 'rgba(255,95,210,.42)',  aBg: 'rgba(42,10,38,.88)', aBg2: 'rgba(26,5,24,.94)',  txt: '#ffd9f4', txt2: '#d8a8cc', glow: 'rgba(255,95,210,.35)', admin: '#ffd27a', warn: '#ffb0d8', warnBg: 'rgba(48,8,30,.9)', alt: '#5fe8ff' },
    blood: { a: '#ff8d7d', aDim: 'rgba(216,82,82,.45)',   aBg: 'rgba(40,4,4,.88)',   aBg2: 'rgba(24,3,3,.94)',   txt: '#ffd9d0', txt2: '#d8a8a0', glow: 'rgba(255,80,60,.30)', admin: '#ffd27a', warn: '#ffb0a0', warnBg: 'rgba(48,8,8,.9)' }
  };

  var cfg = null;
  var T = null;               // tema activo
  var MP_LEVELS = DEFAULT_LEVELS;
  var st = null;
  var rafId = 0, lastFrame = 0;
  var chatOpen = false;
  var lastPos = { x: 0, z: 0 };
  var levelNavLock = false;

  function $id(i) { return document.getElementById(i); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hideEl(el) { if (el) el.classList.add('mpx-hide'); }
  function showEl(el) { if (el) el.classList.remove('mpx-hide'); }

  /* ============ CSS (autocontenido, con variables del tema) ============ */
  function injectCSS() {
    var s = document.createElement('style');
    s.id = 'mpx-css';
    s.textContent = ''
      + '.mpx-hide{display:none !important}'
      /* ---- fila de tabs creada para niveles sin tabs ---- */
      + '.mpx-tabs{display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.55rem}'
      + '.mpx-tabbtn{font-family:inherit;font-size:.68rem;letter-spacing:.18em;color:' + T.txt2
      + ';background:rgba(0,0,0,.45);border:1px solid ' + T.aDim + ';padding:.34em .7em;cursor:pointer;'
      + '-webkit-tap-highlight-color:transparent}'
      + '.mpx-tabbtn:hover{border-color:' + T.a + '}'
      + '.mpx-tabbtn.on{color:' + T.txt + ';background:' + T.aBg + ';border-color:' + T.a + '}'
      /* ---- botón ONLINE + nota (columna izquierda de la portada) ---- */
      + '.mpx-online-cta{font-family:inherit;border:1px solid ' + T.aDim + ';background:' + T.aBg + ';color:' + T.txt
      + ';padding:.5em .9em;font-size:.78rem;margin-top:.45em;cursor:pointer;letter-spacing:.1em;'
      + 'text-shadow:0 0 8px ' + T.glow + ';box-shadow:0 0 12px ' + T.glow + ';-webkit-tap-highlight-color:transparent;'
      + 'touch-action:manipulation;text-align:center;max-width:22rem}'
      + '.mpx-online-cta:hover,.mpx-online-cta:active{filter:brightness(1.25);color:#fff}'
      + '.mpx-online-note{font-size:.6rem;color:' + T.a + ';opacity:.7;letter-spacing:.06em;margin-top:.3em}'
      /* ---- modal ONLINE ---- */
      + '#mp-online-modal{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;'
      + 'padding:1rem;background:rgba(0,0,0,.82)}'
      + '#mp-online-modal .mpx-qm-box{border:2px solid ' + T.aDim + ';background:' + T.aBg2 + ';padding:1.3rem 1.5rem 1.1rem;'
      + 'max-width:min(30rem,92vw);text-align:center;color:' + T.txt + ';box-shadow:0 0 26px ' + T.glow + '}'
      + '#mp-online-modal .mpx-qm-title{font-size:clamp(1.05rem,4vw,1.5rem);letter-spacing:.12em;line-height:1.25;'
      + 'color:' + T.a + ';text-shadow:2px 0 ' + T.glow + ';margin-bottom:.5rem}'
      + '#mp-online-modal .mpx-qm-sub{font-size:.78rem;letter-spacing:.08em;color:' + T.txt2 + ';margin-bottom:.9rem;line-height:1.8}'
      + '#mp-online-modal .mpx-qm-sub b{color:' + T.a + ';letter-spacing:.12em}'
      + '.mpx-qm-btn{font-size:1rem;letter-spacing:.18em;padding:.42em 1.2em;cursor:pointer;margin:0 .3rem;'
      + '-webkit-tap-highlight-color:transparent;touch-action:manipulation;font-family:inherit}'
      + '.mpx-qm-btn.yes{background:' + T.aBg + ';border:1px solid ' + T.aDim + ';color:' + T.txt + ';text-shadow:0 0 8px ' + T.glow + '}'
      + '.mpx-qm-btn.yes:hover,.mpx-qm-btn.yes:active{filter:brightness(1.3);color:#fff}'
      + '.mpx-qm-btn.no{background:rgba(30,26,10,.92);border:1px solid rgba(207,194,122,.6);color:#cfc27a}'
      + '.mpx-qm-btn.no:hover,.mpx-qm-btn.no:active{background:rgba(90,80,30,.9);color:#fff}'
      /* ---- panel MP (pestaña) ---- */
      + '#mp-pane{min-width:0;width:100%}'
      + '#mp-pane .mpx-status{font-size:.74rem;letter-spacing:.08em;color:' + T.a + ';margin-bottom:.35rem}'
      + '#mp-pane .mpx-status.bad{color:' + T.warn + '}'
      + '#mp-pane .mpx-msg{font-size:.7rem;letter-spacing:.08em;color:' + T.warn + ';border:1px dotted ' + T.warnBg
      + ';padding:.3em .5em;margin:.35rem 0;display:inline-block}'
      + '#mp-pane .mpx-box{border:1px solid ' + T.aDim + ';background:rgba(0,0,0,.32);padding:.6rem .75rem;margin-top:.6rem;max-height:none}'
      + '#mp-pane .mpx-title{font-size:.72rem;letter-spacing:.22em;color:' + T.a + ';margin-bottom:.4rem}'
      + '#mp-pane .mpx-empty{font-size:.7rem;opacity:.6;letter-spacing:.08em;padding:.4em 0}'
      + '#mp-pane .mpx-room-row{border:1px dotted ' + T.aDim + ';padding:.5em .7em;margin:.4rem 0;display:flex;flex-wrap:wrap;'
      + 'gap:.35em .6em;align-items:center;cursor:default}'
      + '#mp-pane .mpx-room-row b{color:#fff;letter-spacing:.12em;font-weight:700}'
      + '#mp-pane .mpx-join{font-family:inherit;font-size:.7rem;letter-spacing:.1em;background:' + T.aBg
      + ';border:1px solid ' + T.aDim + ';color:' + T.txt + ';padding:.32em .8em;cursor:pointer;margin-left:auto;'
      + '-webkit-tap-highlight-color:transparent}'
      + '#mp-pane .mpx-join:hover,#mp-pane .mpx-join:active{filter:brightness(1.3);color:#fff}'
      + '#mp-pane .mpx-join:disabled{opacity:.35;cursor:not-allowed}'
      + '#mp-pane .mpx-cta{width:100%;font-family:inherit;font-size:.78rem;letter-spacing:.14em;background:' + T.aBg
      + ';border:1px solid ' + T.aDim + ';color:' + T.txt + ';padding:.45em .8em;cursor:pointer;margin-top:.45rem;'
      + '-webkit-tap-highlight-color:transparent}'
      + '#mp-pane .mpx-cta:hover,#mp-pane .mpx-cta:active{filter:brightness(1.3);color:#fff}'
      + '#mp-pane .mpx-cta.warn{border-color:rgba(255,120,120,.5);color:' + T.warn + ';background:' + T.warnBg + '}'
      + '#mp-pane .mpx-hint{font-size:.62rem;letter-spacing:.06em;opacity:.65;margin-top:.45rem}'
      + '#mp-pane .mpx-input{width:100%;font-family:\'VT323\',\'Courier New\',monospace;font-size:.95rem;letter-spacing:.08em;'
      + 'background:rgba(0,0,0,.5);border:1px solid ' + T.aDim + ';color:' + T.txt + ';padding:.3em .55em;margin-top:.2rem;'
      + 'box-sizing:border-box;outline:none}'
      + '#mp-pane .mpx-input:focus{border-color:' + T.a + '}'
      + '#mp-pane .mpx-input::placeholder{color:rgba(160,160,160,.4)}'
      + '#mp-pane select.mpx-input{appearance:none;-webkit-appearance:none}'
      + '#mp-pane .mpx-pl{display:flex;align-items:center;gap:.5em;padding:.28em .5em;border-bottom:1px dotted ' + T.aDim + ';flex-wrap:wrap;font-size:.8rem}'
      + '#mp-pane .mpx-pl .nm{color:#fff}'
      + '#mp-pane .mpx-pl .admtag{color:' + T.admin + ';letter-spacing:.1em;font-size:.62rem;border:1px solid ' + T.admin + ';padding:.05em .4em}'
      + '#mp-pane .mpx-pl .zombie{color:' + T.warn + ';font-size:.62rem;letter-spacing:.08em}'
      + '#mp-pane .mpx-pl .kick, #mp-pane .mpx-lvl .kick{margin-left:auto;font-family:inherit;font-size:.6rem;letter-spacing:.12em;'
      + 'background:' + T.warnBg + ';border:1px solid rgba(255,120,120,.5);color:' + T.warn + ';padding:.25em .7em;cursor:pointer;'
      + '-webkit-tap-highlight-color:transparent}'
      + '#mp-pane .mpx-pl .kick:hover,#mp-pane .mpx-lvl .kick:active{background:rgba(160,50,50,.9);color:#fff}'
      + '#mp-pane .mpx-lvl{display:flex;align-items:center;gap:.5em;padding:.28em .5em;border-bottom:1px dotted ' + T.aDim + ';flex-wrap:wrap;font-size:.8rem}'
      + '#mp-pane .mpx-lvl.cur .nm{color:' + T.a + '}'
      + '#mp-pane .mpx-lvl .nm{color:#fff}'
      + '#mp-pane .mpx-lvl .mpx-join{margin-left:auto}'
      /* ---- pestaña inyectada: hereda la clase del nivel, solo desactivar herencia extra ---- */
      + '.mpx-tab{cursor:pointer;-webkit-tap-highlight-color:transparent}'
      /* ---- CHAT ---- */
      + '#mpx-chat{position:fixed;left:1rem;bottom:7.2rem;width:min(400px,74vw);z-index:60;pointer-events:none;'
      + 'font-family:\'VT323\',\'Courier New\',monospace;font-size:.92rem;color:#fff}'
      + '#mpx-chat-log{display:flex;flex-direction:column;gap:2px;max-height:30vh;overflow:hidden;justify-content:flex-end}'
      + '.mpx-chat-line{background:rgba(0,0,0,.45);border-left:3px solid ' + T.a + ';padding:.14em .45em;line-height:1.25;'
      + 'letter-spacing:.03em;word-break:break-word;transition:opacity .6s}'
      + '.mpx-chat-line.old{opacity:.55}'
      + '#mpx-chat.log-open .mpx-chat-line.old{opacity:1}'
      + '#mpx-chat-input-row{display:none;margin-top:6px;pointer-events:auto}'
      + '#mpx-chat-input-row.open{display:flex;gap:6px}'
      + '#mpx-chat-input{flex:1;min-width:0;background:rgba(0,0,0,.75);border:1px solid ' + T.aDim + ';color:' + T.txt
      + ';font-family:inherit;font-size:.95rem;padding:.3em .55em;outline:none;letter-spacing:.04em}'
      + '#mpx-chat-send{background:' + T.aBg + ';border:1px solid ' + T.aDim + ';color:' + T.txt
      + ';font-family:inherit;font-size:.85rem;letter-spacing:.1em;padding:0 .9em;cursor:pointer;'
      + '-webkit-tap-highlight-color:transparent}'
      + '#mpx-chat-send:active{filter:brightness(1.4)}'
      + 'body.touch #mpx-chat{bottom:10.6rem;width:min(340px,62vw)}'
      + '#mpx-btn-chat{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(.55rem + env(safe-area-inset-bottom,0px));'
      + 'z-index:59;width:52px;height:40px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid ' + T.aDim
      + ';color:' + T.txt + ';font-size:1rem;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;'
      + 'display:flex;align-items:center;justify-content:center;opacity:.85}'
      + '#mpx-btn-chat:hover,#mpx-btn-chat:active{opacity:1;filter:brightness(1.3)}'
      /* ---- SALIR ---- */
      + '#mp-quit-btn{position:fixed;top:calc(.5rem + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);'
      + 'z-index:61;font-size:.78rem;letter-spacing:.18em;color:#ffd6d6;background:rgba(120,14,14,.88);'
      + 'border:1px solid rgba(255,80,80,.55);padding:.34em 1em;cursor:pointer;-webkit-tap-highlight-color:transparent}'
      + '#mp-quit-btn:hover,#mp-quit-btn:active{background:rgba(205,28,28,1);color:#fff}'
      + '#mp-pause-quit{margin:.6rem auto 0;max-width:24rem;font-family:inherit;font-size:.78rem;letter-spacing:.14em;'
      + 'background:' + T.warnBg + ';border:1px solid rgba(255,120,120,.5);color:' + T.warn + ';padding:.45em .8em;'
      + 'cursor:pointer;display:block;-webkit-tap-highlight-color:transparent}'
      + '#mp-quit-modal{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;'
      + 'padding:1rem;background:rgba(0,0,0,.8)}'
      + '#mp-quit-modal .mpx-qm-box2{display:flex;flex-direction:column;gap:.6rem;align-items:center;background:' + T.aBg2
      + ';border:1px solid ' + T.aDim + ';padding:1.2rem 1.4rem;max-width:min(24rem,92vw);width:100%;'
      + 'box-shadow:0 0 24px ' + T.glow + ';color:' + T.txt + '}'
      + '#mp-quit-modal .mpx-qm-title{font-size:.85rem;letter-spacing:.16em;color:' + T.txt + '}'
      + '#mp-quit-modal .mpx-qm-sub{font-size:.7rem;opacity:.7;margin-top:-.3rem;color:' + T.txt2 + '}'
      + '#mp-quit-modal .mpx-qm-row{display:flex;gap:.6rem;width:100%}'
      + '#mp-quit-modal .mpx-qm-btn{flex:1}'
      /* ---- admin en pausa ---- */
      + '#mp-pause-admin{display:flex;flex-direction:column;gap:.4rem;max-width:26rem;margin:.6rem auto 0;width:100%}'
      + '#mp-pause-admin .mpx-title{font-size:.72rem;letter-spacing:.22em;color:' + T.a + ';text-align:left}'
      + '#mp-pause-admin .mpx-pl{border:1px dotted ' + T.aDim + ';margin:.15rem 0}'
      + '@media (orientation:landscape) and (max-height:480px){'
      + '.mpx-online-cta{font-size:.68rem;padding:.4em .8em}.mpx-online-note{font-size:.54rem}'
      + '#mp-online-modal .mpx-qm-box{padding:.7rem 1rem .6rem}}';
    document.head.appendChild(s);
  }

  /* ============ DOM: botón ONLINE + pestaña + panel + modales + chat ============ */
  function buildUI() {
    /* nivel SIN tabs: crear fila INFORME / MODO MULTIJUGADOR sobre el panel */
    if (cfg.tabsMode === 'create') {
      var right = document.querySelector(cfg.paneHost);
      if (right && !$id('mpx-tabs')) {
        var row = document.createElement('div');
        row.id = 'mpx-tabs';
        row.className = 'mpx-tabs mpx-keep';
        var infoBtn = document.createElement('button');
        infoBtn.type = 'button';
        infoBtn.id = 'mpx-tab-info';
        infoBtn.className = 'mpx-tabbtn on';
        infoBtn.textContent = cfg.infoTabLabel || '■ INFORME';
        infoBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          showInfoPane();
        });
        row.appendChild(infoBtn);
        var mpBtn = document.createElement('button');
        mpBtn.type = 'button';
        mpBtn.id = 'mp-tab-btn';
        mpBtn.className = 'mpx-tabbtn';
        mpBtn.textContent = cfg.tabLabel || '■ MODO MULTIJUGADOR';
        mpBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          activateMyTab();
        });
        row.appendChild(mpBtn);
        right.insertBefore(row, right.firstChild);
      }
    }

    /* botón ONLINE en la columna izquierda de la portada */
    var left = document.querySelector(cfg.leftHost);
    if (left && !$id('mp-online-btn')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mpx-online-cta';
      b.id = 'mp-online-btn';
      b.textContent = '▶ MODO MULTIJUGADOR — ONLINE';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        showEl($id('mp-online-modal'));
      });
      left.appendChild(b);
      var n = document.createElement('div');
      n.className = 'mpx-online-note';
      n.id = 'mp-online-note';
      n.textContent = 'REQUIERE INTERNET · backrooms-mp.onrender.com';
      left.appendChild(n);
    }

    /* pestaña MODO MULTIJUGADOR */
    var tabsHost = document.querySelector(cfg.tabsHost);
    if (tabsHost && !$id('mp-tab-btn')) {
      var tb = document.createElement('button');
      tb.type = 'button';
      tb.id = 'mp-tab-btn';
      tb.className = (cfg.tabClass || 'tab') + ' mpx-tab';
      if (cfg.dataPane) tb.setAttribute('data-pane', cfg.dataPane);
      tb.textContent = cfg.tabLabel || '■ MODO MULTIJUGADOR';
      tb.addEventListener('click', function (e) {
        e.stopPropagation();
        activateMyTab();
      });
      tabsHost.appendChild(tb);
    }

    /* panel (pane) MP */
    var paneHost = document.querySelector(cfg.paneHost);
    if (paneHost && !$id('mp-pane') && !(cfg.dataPane && $id(cfg.dataPane))) {
      var pane = document.createElement('div');
      pane.id = cfg.dataPane || 'mp-pane';
      if (cfg.paneClass) pane.className = cfg.paneClass;
      pane.classList.add('mpx-pane');
      if (cfg.tabsMode === 'create') pane.classList.add('mpx-pane-create');
      pane.classList.add('mpx-hide');
      if (cfg.paneHidden === 'hidden') pane.classList.add('hidden');
      pane.innerHTML = ''
        + '<div class="mpx-title">■ MODO MULTIJUGADOR — SEÑAL GLOBAL</div>'
        + '<div class="mpx-status" id="mp-conn">CONECTANDO...</div>'
        + '<div id="mp-msg" class="mpx-hide"></div>'
        + '<div class="mpx-box" id="mp-lobby">'
        + '<div class="mpx-title">SERVIDORES GLOBALES</div>'
        + '<div id="mp-rooms"><div class="mpx-empty">CARGANDO SERVIDORES...</div></div>'
        + '<button type="button" class="mpx-cta" id="mp-create-btn">▶ CREAR SERVIDOR GLOBAL</button>'
        + '</div>'
        + '<div class="mpx-box mpx-hide" id="mp-form">'
        + '<div class="mpx-title" id="mp-f-title">CREAR SERVIDOR GLOBAL</div>'
        + '<div id="mp-f-roomrow">'
        + '<div class="mpx-hint">NOMBRE DE LA SALA</div>'
        + '<input class="mpx-input" id="mp-f-room" maxlength="24" placeholder="LA SALA DEL PASILLO" autocomplete="off" spellcheck="false">'
        + '</div>'
        + '<div class="mpx-hint">TU NOMBRE DE JUGADOR</div>'
        + '<input class="mpx-input" id="mp-f-name" maxlength="16" placeholder="SANTY" autocomplete="off" spellcheck="false">'
        + '<div id="mp-f-maxrow">'
        + '<div class="mpx-hint">LÍMITE DE JUGADORES</div>'
        + '<select class="mpx-input" id="mp-f-max">'
        + '<option value="2">2 JUGADORES</option>'
        + '<option value="4">4 JUGADORES</option>'
        + '<option value="8" selected>8 JUGADORES</option>'
        + '<option value="12">12 JUGADORES</option>'
        + '</select>'
        + '</div>'
        + '<button type="button" class="mpx-cta" id="mp-f-go">▶ CREAR</button>'
        + '<button type="button" class="mpx-cta warn" id="mp-f-cancel">✕ CANCELAR</button>'
        + '</div>'
        + '<div class="mpx-box mpx-hide" id="mp-room">'
        + '<div class="mpx-title" id="mp-room-name">—</div>'
        + '<div class="mpx-status" id="mp-room-info">—</div>'
        + '<div id="mp-room-players"></div>'
        + '<div id="mp-levels"></div>'
        + '<button type="button" class="mpx-cta mpx-hide" id="mp-start-btn">▶ EMPEZAR</button>'
        + '<div class="mpx-empty mpx-hide" id="mp-waiting">ESPERANDO A QUE EL ADMIN EMPIECE...</div>'
        + '<button type="button" class="mpx-cta warn" id="mp-leave-btn">✕ SALIR DE LA SALA</button>'
        + '</div>'
        + '<div class="mpx-hint">SUGERIDO: ' + DEFAULT_SERVER + ' (servidor global). Desplegá tu propio server.js si querés otro.</div>'
        + '<div class="mpx-hint" id="mp-server-url" style="opacity:.75">—</div>'
        + '<input class="mpx-input" id="mp-server-input" placeholder="' + DEFAULT_SERVER + '" autocomplete="off" spellcheck="false">'
        + '<button type="button" class="mpx-cta" id="mp-server-save">▶ CONECTAR A ESTE SERVIDOR</button>';
      paneHost.appendChild(pane);
    }

    /* interop de pestañas del nivel */
    buildTabInterop();

    /* modal ONLINE (confirmación) */
    if (!$id('mp-online-modal')) {
      var m = document.createElement('div');
      m.id = 'mp-online-modal';
      m.className = 'mpx-hide';
      m.innerHTML = ''
        + '<div class="mpx-qm-box">'
        + '<div class="mpx-qm-title">¿CONECTAR AL SERVIDOR GLOBAL?</div>'
        + '<div class="mpx-qm-sub">EL MODO MULTIJUGADOR <b>NECESITA CONEXIÓN A INTERNET</b>.<br>'
        + 'Se usará el servidor global <b>backrooms-mp.onrender.com</b>.<br>'
        + 'El juego local sigue siendo 100% offline.</div>'
        + '<button type="button" id="mp-online-cancel" class="mpx-qm-btn no">CANCELAR</button>'
        + '<button type="button" id="mp-online-go" class="mpx-qm-btn yes">▶ CONECTAR</button>'
        + '</div>';
      document.body.appendChild(m);
      $id('mp-online-cancel').addEventListener('click', function () { hideEl(m); });
      $id('mp-online-go').addEventListener('click', function () {
        hideEl(m);
        window.__mpUseOnline();
      });
    }

    /* chat */
    if (!$id('mpx-chat')) {
      var ch = document.createElement('div');
      ch.id = 'mpx-chat';
      ch.className = 'mpx-hide';
      ch.innerHTML = ''
        + '<div id="mpx-chat-log"></div>'
        + '<div id="mpx-chat-input-row">'
        + '<input id="mpx-chat-input" maxlength="120" placeholder="ESCRIBE Y PULSA ENTER..." autocomplete="off">'
        + '<button type="button" id="mpx-chat-send">▶</button>'
        + '</div>';
      document.body.appendChild(ch);
    }
    if (!$id('mpx-btn-chat')) {
      var cb = document.createElement('button');
      cb.type = 'button';
      cb.id = 'mpx-btn-chat';
      cb.className = 'mpx-hide';
      cb.textContent = '💬';
      cb.title = 'Chat (T)';
      document.body.appendChild(cb);
      bindTap(cb, function () { openChat(); });
    }
    bindTap($id('mpx-chat-send'), function () { closeChat(true); });

    /* SALIR: botón HUD + botón pausa + modal confirmación */
    if (!$id('mp-quit-btn')) {
      var qb = document.createElement('button');
      qb.type = 'button';
      qb.id = 'mp-quit-btn';
      qb.className = 'mpx-hide';
      qb.textContent = '✕ SALIR';
      bindTap(qb, quitRequest);
      document.body.appendChild(qb);
    }
    var pauseHost = document.querySelector(cfg.pauseHost || '#pause');
    if (pauseHost && !$id('mp-pause-quit')) {
      var pb = document.createElement('button');
      pb.type = 'button';
      pb.id = 'mp-pause-quit';
      pb.className = 'mpx-hide';
      pb.textContent = '✕ SALIR DE LA SALA';
      bindTap(pb, quitRequest);
      pauseHost.appendChild(pb);
    }
    if (!$id('mp-quit-modal')) {
      var qm = document.createElement('div');
      qm.id = 'mp-quit-modal';
      qm.className = 'mpx-hide';
      qm.innerHTML = ''
        + '<div class="mpx-qm-box2">'
        + '<div class="mpx-qm-title">¿SEGURO QUE QUIERES SALIR DE LA SALA?</div>'
        + '<div class="mpx-qm-sub">Saldrás de la partida multiplayer actual.</div>'
        + '<div class="mpx-qm-row">'
        + '<button type="button" id="mp-qm-cancel" class="mpx-qm-btn no">CANCELAR</button>'
        + '<button type="button" id="mp-qm-confirm" class="mpx-qm-btn yes">SALIR</button>'
        + '</div>'
        + '</div>';
      document.body.appendChild(qm);
      bindTap($id('mp-qm-cancel'), quitCancel);
      bindTap($id('mp-qm-confirm'), quitConfirm);
    }
  }

  /* activa MI pestaña respetando el sistema de tabs del nivel */
  function activateMyTab() {
    try { if (cfg.stopAuto) cfg.stopAuto(); } catch (_) {}
    if (cfg.tabsMode === 'create') {
      /* nivel sin tabs propio: INFORME ↔ MP */
      var brief = document.querySelector(cfg.briefSel);
      if (brief) hideEl(brief);
      var myPane0 = $id('mp-pane');
      if (myPane0) {
        myPane0.classList.remove('mpx-hide');
        if (cfg.paneHidden === 'hidden') myPane0.classList.remove('hidden');
      }
      var ib = $id('mpx-tab-info');
      if (ib) ib.classList.remove('on');
      var mb = $id('mp-tab-btn');
      if (mb) mb.classList.add('on');
      if (!st.room) send({ t: 'list' });
      return;
    }
    var root = document.querySelector(cfg.startRoot) || document;
    /* apagar todas las pestañas del contenedor */
    var tabs = (document.querySelector(cfg.tabsHost) || root).querySelectorAll('button');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].id === 'mp-tab-btn') tabs[i].classList.add(cfg.tabOnClass || 'on');
      else tabs[i].classList.remove(cfg.tabOnClass || 'on');
    }
    /* ocultar todos los panes hermanos y mostrar el mío */
    var host = document.querySelector(cfg.paneHost);
    if (host) {
      var kids = host.children;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].classList.contains('mpx-keep')) continue;
        var isMine = (kids[k].id === 'mp-pane') || (cfg.dataPane && kids[k].id === cfg.dataPane);
        if (isMine) {
          kids[k].classList.remove('mpx-hide');
          if (cfg.paneHidden === 'hidden') kids[k].classList.remove('hidden');
        } else {
          if (cfg.paneHidden === 'hidden') kids[k].classList.add('hidden');
          else kids[k].classList.add('mpx-hide');
        }
      }
    }
    var myPane = cfg.dataPane ? $id(cfg.dataPane) : $id('mp-pane');
    if (myPane) {
      myPane.classList.remove('mpx-hide');
      if (cfg.paneHidden === 'hidden') myPane.classList.remove('hidden');
    }
    /* refrescar lista de salas */
    if (!st.room) send({ t: 'list' });
  }

  /* vuelve al panel INFORME original (tabs creadas) */
  function showInfoPane() {
    var brief = document.querySelector(cfg.briefSel);
    if (brief) {
      brief.classList.remove('mpx-hide');
      if (cfg.paneHidden === 'hidden') brief.classList.remove('hidden');
    }
    var myPane = $id('mp-pane');
    if (myPane) {
      myPane.classList.add('mpx-hide');
      if (cfg.paneHidden === 'hidden') myPane.classList.add('hidden');
    }
    var ib = $id('mpx-tab-info');
    if (ib) ib.classList.add('on');
    var mb = $id('mp-tab-btn');
    if (mb) mb.classList.remove('on');
  }

  /* interop: clicks en otras pestañas ocultan mi pane */
  function buildTabInterop() {
    var tabsHost = document.querySelector(cfg.tabsHost);
    if (!tabsHost) return;
    tabsHost.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null;
      if (!t || t.id === 'mp-tab-btn') return;
      /* pestaña nativa: ocultar mi pane (su propio handler muestra el suyo) */
      var myPane = cfg.dataPane ? $id(cfg.dataPane) : $id('mp-pane');
      if (myPane) {
        if (cfg.paneHidden === 'hidden') myPane.classList.add('hidden');
        else myPane.classList.add('mpx-hide');
      }
      var mtb = $id('mp-tab-btn');
      if (mtb) mtb.classList.remove(cfg.tabOnClass || 'on');
    }, true);
    /* teclas de rotación de tabs (flechas / números) mientras mi pane está abierto */
    document.addEventListener('keydown', function (e) {
      var myPane = cfg.dataPane ? $id(cfg.dataPane) : $id('mp-pane');
      if (!myPane || myPane.classList.contains('mpx-hide')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || (e.key >= '1' && e.key <= '9')) {
        myPane.classList.add('mpx-hide');
        if (cfg.paneHidden === 'hidden') myPane.classList.add('hidden');
        var mtb = $id('mp-tab-btn');
        if (mtb) mtb.classList.remove(cfg.tabOnClass || 'on');
      }
    });
  }

  /* ============ sesión y conexión ============ */
  function detectUrl() {
    try {
      var q = new URLSearchParams(location.search).get('mpserver');
      if (q) return q.trim();
      var saved = localStorage.getItem('BACKROOMS_MP_SERVER');
      if (saved) return saved.trim();
      if (location.protocol === 'http:' || location.protocol === 'https:') {
        if (/(^|\.)github\.io$/i.test(location.hostname) || /(^|\.)androidplatform\.net$/i.test(location.hostname)) return '';
        return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
      }
    } catch (_) {}
    return 'ws://localhost:8787';
  }
  function saveSession() {
    try {
      if (st.room && st.playerId) {
        localStorage.setItem('BACKROOMS_MP_SESSION', JSON.stringify({
          roomId: st.room.roomId, playerId: st.playerId, token: st.token, name: st.name
        }));
      } else localStorage.removeItem('BACKROOMS_MP_SESSION');
    } catch (_) {}
  }
  function loadSession() {
    try {
      var raw = localStorage.getItem('BACKROOMS_MP_SESSION');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s.roomId && s.playerId && s.token) return s;
    } catch (_) {}
    return null;
  }
  function clearSession() {
    st.room = null; st.playerId = null; st.token = null;
    try { localStorage.removeItem('BACKROOMS_MP_SESSION'); } catch (_) {}
    syncQuitButtons();
  }
  function send(o) {
    if (st.ws && st.ws.readyState === 1) { try { st.ws.send(JSON.stringify(o)); } catch (_) {} }
  }
  function setStatus(txt, bad) {
    st.status = txt;
    var el = $id('mp-conn');
    if (el) { el.textContent = txt; el.classList.toggle('bad', !!bad); el.classList.toggle('mpx-status-bad', !!bad); }
  }
  function setMsg(m) {
    st.msg = m || '';
    var el = $id('mp-msg');
    if (el) {
      el.textContent = st.msg;
      if (st.msg) el.classList.remove('mpx-hide'); else el.classList.add('mpx-hide');
      if (st.msg) setTimeout(function () {
        if (st.msg === m) { st.msg = ''; el.classList.add('mpx-hide'); }
      }, 5000);
    }
  }
  function connect() {
    st.url = detectUrl();
    renderServerCfg();
    if (!st.url) {
      setStatus('SERVIDOR NO CONFIGURADO — PULSA EL BOTÓN ONLINE O ESCRIBE EL ENLACE ABAJO', true);
      return;
    }
    setStatus('CONECTANDO...', true);
    /* neutralizar handlers del socket viejo antes de cerrarlo (bucle WS) */
    var prev = st.ws;
    if (prev) {
      try { prev.onopen = prev.onmessage = prev.onclose = prev.onerror = null; } catch (_) {}
      try { st.closedByUs = true; prev.close(); } catch (_) {}
      st.closedByUs = false;
    }
    var ws;
    try { ws = new WebSocket(st.url); } catch (_) { scheduleReconnect(); return; }
    st.ws = ws;
    ws.onopen = function () {
      st.everConnected = true;
      st.backoff = 800;
      setStatus('CONECTADO', false);
      if (st.pendingRejoin) {
        var r = st.pendingRejoin;
        st.pendingRejoin = null;
        send({ t: 'rejoin', roomId: r.roomId, pid: r.playerId, tok: r.token });
      } else if (!st.room) send({ t: 'list' });
      else send({ t: 'level', lv: cfg.level });
    };
    ws.onmessage = onMessage;
    ws.onclose = function () {
      if (ws !== st.ws) return;
      if (st.closedByUs) return;
      setStatus('CONEXIÓN PERDIDA', true);
      if (st.room) setMsg('CONEXIÓN PERDIDA — RECONECTANDO...');
      scheduleReconnect();
    };
    ws.onerror = function () {};
  }
  function scheduleReconnect() {
    if (st.reconnectT) return;
    var wait = Math.min(8000, st.backoff);
    st.backoff = Math.min(8000, st.backoff * 1.7);
    st.reconnectT = setTimeout(function () {
      st.reconnectT = 0;
      if (st.ws && (st.ws.readyState === 0 || st.ws.readyState === 1)) return;
      var s = st.room ? { roomId: st.room.roomId, playerId: st.playerId, token: st.token } : null;
      if (s && s.roomId && s.playerId && s.token) st.pendingRejoin = s;
      connect();
    }, wait);
  }

  /* ============ mensajes del servidor ============ */
  function onMessage(ev) {
    var m;
    try { m = JSON.parse(ev.data); } catch (_) { return; }
    switch (m.t) {
      case 'rooms': st.rooms = m.rooms || []; renderRooms(); break;
      case 'joined': onJoined(m); break;
      case 'room': st.room = m.room; renderRoom(); syncRemotes(); checkRoomLevel(); break;
      case 'pm': onRemoteMove(m); break;
      case 'chat': onNetChat(m); break;
      case 'started': onStarted(m); break;
      case 'kicked': onKicked(m.reason); break;
      case 'sys': try { if (cfg.toast) cfg.toast(m.msg); } catch (_) {} break;
      case 'left': onLeft(); break;
      case 'err': onErr(m); break;
    }
  }
  function onJoined(m) {
    st.room = m.room;
    st.playerId = m.playerId;
    st.token = m.token;
    var me = st.room.players.find(function (p) { return p.playerId === st.playerId; });
    st.name = me ? me.displayName : '';
    saveSession();
    send({ t: 'level', lv: cfg.level });
    setStatus('CONECTADO — EN SALA ' + m.roomId, false);
    setMsg('');
    renderRoom();
    syncRemotes();
    syncChatVisibility();
    addChatLine(null, null, 'TE HAS UNIDO A "' + st.room.roomName + '" — T PARA CHATEAR', true);
    if (st.room.started) autoEnter(false);
  }
  function onErr(m) {
    switch (m.code) {
      case 'ROOM_FULL': setMsg('SALA LLENA'); break;
      case 'ROOM_NOT_FOUND': setMsg('SALA NO ENCONTRADA'); clearSession(); break;
      case 'SESSION_LOST': setMsg('TU SESIÓN EXPIRÓ'); clearSession(); break;
      case 'NOT_ADMIN': setMsg('SOLO EL ADMIN PUEDE HACER ESO'); break;
      default: setMsg(m.msg || 'ERROR');
    }
    if (st.ws && st.ws.readyState === 1) {
      if (st.room && st.room.roomId) setStatus('CONECTADO — EN SALA ' + st.room.roomId, false);
      else setStatus('CONECTADO', false);
    }
    renderAll();
  }
  function onKicked(reason) {
    clearSession();
    st.pendingRejoin = null;
    disposeAllRemotes();
    try { if (cfg.returnToMenu) cfg.returnToMenu(); } catch (_) {}
    setMsg(reason || 'HAS SIDO EXPULSADO DE LA SALA');
    renderAll();
    syncChatVisibility();
  }
  function onLeft() {
    clearSession();
    st.pendingRejoin = null;
    disposeAllRemotes();
    syncChatVisibility();
    renderAll();
  }
  function onStarted(m) {
    if (m && m.room) st.room = m.room;
    try { if (cfg.toast) cfg.toast('LA PARTIDA EMPIEZA'); } catch (_) {}
    autoEnter(true);
  }

  /* ============ entrada al juego (spawn en anillo como Nivel 0/37) ============ */
  function myRoomIndex() {
    if (!st.room) return 0;
    var i = st.room.players.findIndex(function (p) { return p.playerId === st.playerId; });
    return i < 0 ? 0 : i;
  }
  function autoEnter(record) {
    var idx = myRoomIndex();
    var ang = 0.9 + idx * 2.4;
    var rr = idx === 0 ? 0 : 0.9 + 0.3 * Math.min(idx, 8);
    var sx = (cfg.spawn ? cfg.spawn.x : 0) + Math.cos(ang) * rr;
    var sz = (cfg.spawn ? cfg.spawn.z : 0) + Math.sin(ang) * rr;
    try { if (cfg.autoEnter) cfg.autoEnter({ x: sx, z: sz }, !!record, idx); } catch (_) {}
  }

  /* ============ avatares remotos ============ */
  function hexA(hex, a) {
    var h = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!h) return 'rgba(140,220,160,' + a + ')';
    var n = parseInt(h[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function makeNameTag(name, isAdmin, color) {
    var THREE_ = cfg.getThree();
    var col = color || (isAdmin ? T.admin : T.a);
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillRect(0, 0, 256, 64);
    x.strokeStyle = isAdmin ? 'rgba(255,210,122,0.95)' : hexA(col, 0.85);
    x.lineWidth = 4;
    x.strokeRect(2, 2, 252, 60);
    x.font = '32px "VT323", monospace';
    x.fillStyle = col;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText((isAdmin ? '■ ' : '') + name, 128, 34);
    var tex = new THREE_.CanvasTexture(c);
    tex.magFilter = THREE_.LinearFilter;
    var spr = new THREE_.Sprite(new THREE_.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(1.5, 0.38, 1);
    spr.position.y = 2.15;
    return spr;
  }
  function makeRemoteBody(color) {
    var THREE_ = cfg.getThree();
    var g = new THREE_.Group();
    var sc = cfg.bodyScale || 1;
    g.scale.set(sc, sc, sc);
    var inner = new THREE_.Group(); inner.position.z = 0.16; g.add(inner);
    var suit = new THREE_.MeshStandardMaterial({ color: 0xe8f4f1, roughness: 0.55, metalness: 0.05 });
    var dark = new THREE_.MeshStandardMaterial({ color: 0x27424a, roughness: 0.6, metalness: 0.1 });
    var box = function (mat, w, h, d, x, y, z, parent) {
      var m = new THREE_.Mesh(new THREE_.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); (parent || inner).add(m); return m;
    };
    var pivot = function (mat, w, h, d, x, y, z, parent) {
      var gg = new THREE_.BoxGeometry(w, h, d);
      gg.translate(0, -h / 2, 0);
      var m = new THREE_.Mesh(gg, mat);
      m.position.set(x, y, z); (parent || inner).add(m); return m;
    };
    box(suit, 0.44, 0.34, 0.24, 0, 1.09, 0);
    box(suit, 0.4, 0.3, 0.22, 0, 0.85, 0);
    box(dark, 0.46, 0.09, 0.26, 0, 0.68, 0);
    var armL = pivot(suit, 0.12, 0.42, 0.12, -0.29, 1.2, 0);
    var armR = pivot(suit, 0.12, 0.42, 0.12, 0.29, 1.2, 0);
    pivot(suit, 0.1, 0.34, 0.1, 0, -0.42, 0, armL);
    pivot(suit, 0.1, 0.34, 0.1, 0, -0.42, 0, armR);
    var thighL = pivot(suit, 0.16, 0.42, 0.16, -0.12, 0.78, 0);
    var thighR = pivot(suit, 0.16, 0.42, 0.16, 0.12, 0.78, 0);
    pivot(suit, 0.13, 0.38, 0.13, 0, -0.42, 0, thighL);
    pivot(suit, 0.13, 0.38, 0.13, 0, -0.42, 0, thighR);
    box(dark, 0.15, 0.14, 0.3, 0, -0.32, -0.05, thighL.children[0]);
    box(dark, 0.15, 0.14, 0.3, 0, -0.32, -0.05, thighR.children[0]);
    var headG = new THREE_.Group(); headG.position.set(0, 1.3, 0); inner.add(headG);
    box(suit, 0.26, 0.24, 0.24, 0, 0.13, 0, headG);
    box(dark, 0.27, 0.05, 0.25, 0, 0.015, 0, headG);
    var visorMat = new THREE_.MeshBasicMaterial({ color: color || T.a });
    var visor = new THREE_.Mesh(new THREE_.BoxGeometry(0.2, 0.08, 0.03), visorMat);
    visor.position.set(0, 0.15, 0.125); headG.add(visor);
    var badgeMat = new THREE_.MeshBasicMaterial({ color: color || T.a });
    var badge = new THREE_.Mesh(new THREE_.BoxGeometry(0.14, 0.07, 0.02), badgeMat);
    badge.position.set(0, 1.13, 0.125); inner.add(badge);
    return {
      group: g, visorMat: visorMat, badgeMat: badgeMat,
      setColor: function (c) { try { this.visorMat.color.set(c); this.badgeMat.color.set(c); } catch (_) {} },
      update: function (px, pz, pyEye, yaw, mov, bobT) {
        g.position.set(px, pyEye - cfg.eye, pz);
        g.rotation.y = yaw;
        var sw = mov ? Math.sin(bobT) * 0.55 : 0;
        var lag = mov ? Math.sin(bobT - 0.6) * 0.45 : 0;
        thighL.rotation.x = sw; thighR.rotation.x = -sw;
        armL.rotation.x = -sw * 0.5; armR.rotation.x = sw * 0.5;
        if (thighL.children[0]) thighL.children[0].rotation.x = Math.max(0, -lag) + 0.08;
        if (thighR.children[0]) thighR.children[0].rotation.x = Math.max(0, lag) + 0.08;
      }
    };
  }
  function makeRemote(p) {
    var scene = cfg.getScene();
    var body = makeRemoteBody(p.color);
    var r = {
      pid: p.playerId, name: p.displayName, isAdmin: !!p.isAdmin, color: p.color || T.a,
      level: p.level, connected: !!p.connected,
      target: { x: cfg.spawn ? cfg.spawn.x : 0, z: cfg.spawn ? cfg.spawn.z : 0, y: cfg.eye, yaw: 0, mov: false },
      pos: { x: cfg.spawn ? cfg.spawn.x : 0, z: cfg.spawn ? cfg.spawn.z : 0, y: cfg.eye }, yaw: 0, bobT: 0,
      body: body, tag: null, tagKey: '', colorApplied: p.color || T.a,
    };
    r.tag = makeNameTag(r.name, r.isAdmin, r.color);
    r.tagKey = r.name + '|' + r.isAdmin + '|' + r.color;
    body.group.add(r.tag);
    body.group.visible = false;
    if (scene) scene.add(body.group);
    return r;
  }
  function disposeRemote(r) {
    if (r.body && r.body.group) {
      r.body.group.traverse(function (o) {
        if (o.isMesh || o.isSprite) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
          }
        }
      });
      var scene = cfg.getScene();
      if (scene) scene.remove(r.body.group);
    }
  }
  function disposeAllRemotes() {
    for (var r of st.remotes.values()) disposeRemote(r);
    st.remotes.clear();
  }
  function updateRemoteVisibility(r) {
    var vis = !!(r.connected && r.level === cfg.level);
    if (r.body && r.body.group) r.body.group.visible = vis;
  }
  function syncRemotes() {
    if (!st.room) { disposeAllRemotes(); return; }
    if (!cfg.getScene()) return;   /* escena aún no lista */
    var seen = new Set();
    for (var p of st.room.players) {
      if (p.playerId === st.playerId) continue;
      seen.add(p.playerId);
      var r = st.remotes.get(p.playerId);
      if (!r) {
        r = makeRemote(p);
        st.remotes.set(p.playerId, r);
      }
      r.name = p.displayName;
      r.isAdmin = !!p.isAdmin;
      r.level = p.level;
      r.connected = !!p.connected;
      r.color = p.color || r.color || T.a;
      if (r.color !== r.colorApplied) {
        r.colorApplied = r.color;
        try { r.body.setColor(r.color); } catch (_) {}
      }
      var key = r.name + '|' + r.isAdmin + '|' + r.color;
      if (key !== r.tagKey && r.tag) {
        r.body.group.remove(r.tag);
        if (r.tag.material) {
          if (r.tag.material.map) r.tag.material.map.dispose();
          r.tag.material.dispose();
        }
        r.tag = makeNameTag(r.name, r.isAdmin, r.color);
        r.body.group.add(r.tag);
        r.tagKey = key;
      }
      updateRemoteVisibility(r);
    }
    for (var entry of [...st.remotes]) {
      if (!seen.has(entry[0])) { disposeRemote(entry[1]); st.remotes.delete(entry[0]); }
    }
    ensurePauseAdmin();
  }
  function onRemoteMove(m) {
    var r = st.remotes.get(m.id);
    if (!r) return;
    r.target.x = m.x; r.target.z = m.z; r.target.y = m.y;
    r.target.yaw = m.yaw; r.target.mov = !!m.mov;
  }
  function tickRemotes(dt) {
    for (var r of st.remotes.values()) {
      if (!r.body || !r.body.group || !r.body.group.visible) continue;
      var k = 1 - Math.exp(-10 * dt);
      r.pos.x += (r.target.x - r.pos.x) * k;
      r.pos.z += (r.target.z - r.pos.z) * k;
      r.pos.y += (r.target.y - r.pos.y) * k;
      var dy = r.target.yaw - r.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.yaw += dy * k;
      if (r.target.mov) r.bobT += dt * 7; else r.bobT *= Math.max(0, 1 - dt * 8);
      r.body.update(r.pos.x, r.pos.z, r.pos.y, r.yaw, !!r.target.mov, r.bobT);
    }
  }

  /* ============ loop propio (no toca el loop del nivel) ============ */
  function mpFrame(now) {
    rafId = requestAnimationFrame(mpFrame);
    var dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    window.__mpTick(dt);
  }
  window.__mpTick = function (dt) {
    if (!st || !st.room || !st.playerId) return;
    var tnow = performance.now();
    if (tnow - st.lastSend >= 100) {
      st.lastSend = tnow;
      var p = null;
      try { p = cfg.getPos(); } catch (_) {}
      if (p) {
        var yEye = (p.feet != null ? p.feet : 0) + cfg.eye;
        var mov = Math.hypot(p.x - lastPos.x, p.z - lastPos.z) > 0.05;
        lastPos.x = p.x; lastPos.z = p.z;
        send({
          t: 'move',
          x: +p.x.toFixed(2),
          z: +p.z.toFixed(2),
          y: +yEye.toFixed(2),
          yaw: +((p.yaw || 0)).toFixed(2),
          mov: mov
        });
      }
    }
    tickRemotes(dt);
  };

  /* ============ transición de nivel: sesión por URL ============ */
  window.__mpUrlParams = function (params) {
    if (!st || !st.room || !st.playerId || !st.token) return;
    params.set('mp', '1');
    params.set('rid', st.room.roomId);
    params.set('pid', st.playerId);
    params.set('tok', st.token);
    params.set('name', st.name || '');
    params.set('admin', st.room.adminPlayerId === st.playerId ? '1' : '0');
    /* [v2.1] propagar el servidor realtime: la sesión sigue viva aunque el
       jugador nunca haya guardado la URL en localStorage (p.ej. ?mpserver=) */
    if (st.url) params.set('mpserver', st.url);
  };

  /* ============ CHAT ============ */
  var CHAT_MAX_LINES = 60;
  window.__mpChatOpen = false;
  function chatLog() { return $id('mpx-chat-log'); }
  function chatInput() { return $id('mpx-chat-input'); }
  function chatVisible() { return !!(st && st.room && st.playerId); }
  function syncChatVisibility() {
    var ch = $id('mpx-chat');
    if (ch) {
      if (chatVisible()) ch.classList.remove('mpx-hide'); else ch.classList.add('mpx-hide');
    }
    var tb = $id('mpx-btn-chat');
    if (tb) {
      if (chatVisible()) tb.classList.remove('mpx-hide'); else tb.classList.add('mpx-hide');
    }
  }
  function addChatLine(name, color, msg, sys) {
    var log = chatLog();
    if (!log) return;
    var div = document.createElement('div');
    div.className = 'mpx-chat-line';
    if (sys) {
      div.style.borderLeftColor = 'rgba(255,210,122,.85)';
      div.textContent = '■ ' + msg;
    } else {
      div.style.borderLeftColor = color || T.a;
      var nm = document.createElement('span');
      nm.style.color = color || T.a;
      nm.style.fontWeight = 'bold';
      nm.textContent = (name || '?') + ': ';
      div.appendChild(nm);
      div.appendChild(document.createTextNode(msg == null ? '' : String(msg)));
    }
    log.appendChild(div);
    while (log.children.length > CHAT_MAX_LINES) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
    setTimeout(function () { if (!chatOpen) div.classList.add('old'); }, 12000);
  }
  function myColor() {
    if (!st || !st.room) return T.a;
    var me = st.room.players.find(function (p) { return p.playerId === st.playerId; });
    return (me && me.color) || T.a;
  }
  function openChat() {
    if (!chatVisible() || chatOpen) return;
    chatOpen = true;
    window.__mpChatOpen = true;
    var ch = $id('mpx-chat');
    if (ch) ch.classList.add('log-open');
    var row = $id('mpx-chat-input-row');
    if (row) row.classList.add('open');
    try { if (cfg.onChatOpen) cfg.onChatOpen(); } catch (_) {}
    try { chatInput().focus(); } catch (_) {}
  }
  function closeChat(doSend) {
    if (!chatOpen) return;
    var v = chatInput() ? chatInput().value : '';
    chatOpen = false;
    window.__mpChatOpen = false;
    var ch = $id('mpx-chat');
    if (ch) ch.classList.remove('log-open');
    var row = $id('mpx-chat-input-row');
    if (row) row.classList.remove('open');
    if (chatInput()) { chatInput().value = ''; try { chatInput().blur(); } catch (_) {} }
    if (doSend && v.trim()) {
      send({ t: 'chat', msg: v });
      addChatLine(st.name || 'YO', myColor(), v);
    }
  }
  window.__mpChatClose = closeChat;
  function onNetChat(m) { addChatLine(m.name, m.color, m.msg); }
  /* teclas: T abre · Enter envía · Esc cancela.
     Mientras el chat está abierto se BLOQUEA la propagación de teclas
     al juego (los niveles no filtran por target del evento). */
  document.addEventListener('keydown', function (e) {
    if (!chatVisible()) return;
    if (chatOpen) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopPropagation(); closeChat(true); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); closeChat(false); }
      else if (e.target && e.target.id !== 'mpx-chat-input') {
        /* tecla de juego pulsada con el chat abierto: frenar */
        e.stopPropagation();
      }
      return;
    }
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) return;
    if (e.code === 'KeyT') { e.preventDefault(); e.stopPropagation(); openChat(); }
  }, true);
  document.addEventListener('keyup', function (e) {
    if (chatOpen) e.stopPropagation();
  }, true);

  /* ============ SALIR DE SALA ============ */
  function bindTap(el, fn) {
    if (!el) return;
    el.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
    el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
  }
  function syncQuitButtons() {
    var inRoom = !!(st && st.room && st.playerId);
    var hudBtn = $id('mp-quit-btn');
    if (hudBtn) {
      if (inRoom) hudBtn.classList.remove('mpx-hide'); else hudBtn.classList.add('mpx-hide');
    }
    var pauseBtn = $id('mp-pause-quit');
    if (pauseBtn) {
      if (inRoom) pauseBtn.classList.remove('mpx-hide'); else pauseBtn.classList.add('mpx-hide');
    }
  }
  function quitRequest() {
    if (!st || !st.room || !st.playerId) return;
    var modal = $id('mp-quit-modal');
    if (!modal || !modal.classList.contains('mpx-hide')) return;
    modal.classList.remove('mpx-hide');
    try { if (cfg.pauseIfPlaying) cfg.pauseIfPlaying(); } catch (_) {}
  }
  function quitCancel() {
    var modal = $id('mp-quit-modal');
    if (modal) modal.classList.add('mpx-hide');
  }
  function quitConfirm() {
    var modal = $id('mp-quit-modal');
    if (modal) modal.classList.add('mpx-hide');
    if (!st || !st.room || !st.playerId) return;
    send({ t: 'leave' });
    onLeft();
    try { if (cfg.returnToMenu) cfg.returnToMenu(); } catch (_) {}
    setMsg('SALISTE DE LA SALA');
  }

  /* ============ niveles reales + selector admin ============ */
  function mpLevelInfo(id) { return MP_LEVELS.find(function (l) { return l.id === String(id); }) || null; }
  function getCompletedLevels() {
    var done = [];
    try {
      var raw = localStorage.getItem(cfg.saveKey || 'BACKROOMS_SAVE_V1');
      if (!raw) return done;
      var data = JSON.parse(raw);
      if (data && Array.isArray(data.levelsCompleted)) {
        for (var i = 0; i < data.levelsCompleted.length; i++) {
          var s = String(data.levelsCompleted[i]);
          if (s && done.indexOf(s) === -1) done.push(s);
        }
      }
      if (data && data.hasVisitedHub && done.indexOf('hub') === -1) done.push('hub');
    } catch (_) {}
    return done;
  }
  function sendSetLevel(lv) {
    if (!st || !st.room || !st.playerId) return;
    send({ t: 'setLevel', lv: String(lv) });
    setMsg('CAMBIANDO EL NIVEL DE LA SALA...');
  }
  function renderLevelList(listEl) {
    if (!listEl) return;
    var meAdmin = !!(st.room && st.room.adminPlayerId === st.playerId);
    if (!meAdmin) { listEl.innerHTML = ''; return; }
    var done = getCompletedLevels();
    var cur = String(st.room ? st.room.currentLevel : '');
    listEl.innerHTML = '';
    var shown = 0;
    for (var i = 0; i < MP_LEVELS.length; i++) {
      var lv = MP_LEVELS[i];
      if (done.indexOf(lv.id) === -1) continue;
      shown++;
      var isCur = cur === lv.id;
      var row = document.createElement('div');
      row.className = 'mpx-lvl' + (isCur ? ' cur' : '');
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = '✓ ' + lv.label + (isCur ? ' · ACTUAL' : '');
      row.appendChild(nm);
      if (!isCur) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mpx-join';
        btn.textContent = '▶ IR';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          sendSetLevel(this.getAttribute('data-lv'));
        });
        btn.setAttribute('data-lv', lv.id);
        row.appendChild(btn);
      }
      listEl.appendChild(row);
    }
    if (!shown) listEl.innerHTML = '<div class="mpx-empty">COMPLETA NIVELES PARA DESBLOQUEARLOS AQUÍ</div>';
  }
  function checkRoomLevel() {
    if (levelNavLock || !st || !st.room || !st.playerId || !st.token) return;
    var lv = String(st.room.currentLevel || '0');
    if (lv === cfg.level) return;
    var info = mpLevelInfo(lv);
    if (!info) return;
    levelNavLock = true;
    try { if (cfg.toast) cfg.toast('LA SALA SE MUEVE AL ' + info.label); } catch (_) {}
    var params = new URLSearchParams({ lives: '1', time: String(Math.floor(cfg.playTime ? cfg.playTime() : 0)), shards: '0' });
    if (window.__mpUrlParams) window.__mpUrlParams(params);
    var query = '?' + params.toString();
    if (cfg.navToFile) { try { cfg.navToFile(info.file, query); return; } catch (_) {} }
    window.location.replace(info.file + query);
  }

  /* ============ admin en pausa: kick ============ */
  function ensurePauseAdmin() {
    var pause = document.querySelector(cfg.pauseHost || '#pause');
    if (!pause) return;
    var wrap = $id('mp-pause-admin');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'mp-pause-admin';
      pause.appendChild(wrap);
    }
    var meAdmin = !!(st.room && st.room.adminPlayerId === st.playerId);
    if (!meAdmin) { wrap.innerHTML = ''; return; }
    var list = $id('mp-pause-kick');
    if (!list) {
      list = document.createElement('div');
      list.id = 'mp-pause-kick';
      wrap.appendChild(list);
    }
    list.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'mpx-title';
    title.textContent = '■ ADMIN — JUGADORES';
    list.appendChild(title);
    for (var p of (st.room ? st.room.players : [])) {
      if (p.playerId === st.playerId) continue;
      var row = document.createElement('div');
      row.className = 'mpx-pl';
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = '> ' + p.displayName + (p.connected ? '' : ' (RECONECTANDO)');
      row.appendChild(nm);
      var k = document.createElement('button');
      k.type = 'button';
      k.className = 'kick';
      k.textContent = 'KICK';
      k.addEventListener('click', function (e) {
        e.stopPropagation();
        send({ t: 'kick', pid: this.getAttribute('data-pid') });
      });
      k.setAttribute('data-pid', p.playerId);
      row.appendChild(k);
      list.appendChild(row);
    }
  }

  /* ============ UI del panel ============ */
  function renderServerCfg() {
    var urlEl = $id('mp-server-url');
    var inp = $id('mp-server-input');
    if (urlEl) urlEl.textContent = st.url || detectUrl() || 'NO CONFIGURADO';
    if (inp && document.activeElement !== inp) inp.value = detectUrl() || '';
  }
  function renderRooms() {
    var box = $id('mp-rooms');
    if (!box) return;
    box.innerHTML = '';
    if (!st.rooms) { box.innerHTML = '<div class="mpx-empty">CARGANDO SERVIDORES...</div>'; return; }
    if (!st.rooms.length) { box.innerHTML = '<div class="mpx-empty">NO HAY SERVIDORES DISPONIBLES</div>'; return; }
    for (var i = 0; i < st.rooms.length; i++) {
      var r = st.rooms[i];
      var div = document.createElement('div');
      div.className = 'mpx-room-row';
      var info = document.createElement('div');
      info.style.cssText = 'flex:1 1 100%;';
      info.innerHTML = '<b>' + esc(r.roomName) + '</b> <span style="opacity:.55">[' + esc(r.roomId) + ']</span>';
      var meta = document.createElement('div');
      meta.style.cssText = 'flex:1 1 100%; font-size:.7rem; opacity:.8; letter-spacing:.04em;';
      meta.textContent = 'Jugadores: ' + r.players + '/' + r.maxPlayers + ' · NIVEL ' + r.currentLevel + ' · Estado: ' + r.status + (r.devModeEnabled ? ' · DEV' : '');
      div.appendChild(info);
      div.appendChild(meta);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mpx-join';
      btn.textContent = '▶ UNIRSE';
      btn.disabled = (r.status === 'LLENA');
      btn.addEventListener('click', (function (room) {
        return function () { joinRoom(room); };
      })(r));
      div.appendChild(btn);
      box.appendChild(div);
    }
  }
  function joinRoom(r) {
    var nm = st.name;
    try { nm = nm || localStorage.getItem('BACKROOMS_MP_NAME') || ''; } catch (_) {}
    if (!nm) { openForm('join', r); return; }
    setStatus('ENTRANDO...', true);
    send({ t: 'join', roomId: r.roomId, name: nm });
  }
  function renderRoom() {
    syncQuitButtons();
    var box = $id('mp-room');
    if (!box) return;
    if (!st.room) {
      showEl($id('mp-lobby'));
      hideEl(box);
      return;
    }
    hideEl($id('mp-lobby'));
    showEl(box);
    hideEl($id('mp-form'));
    $id('mp-room-name').textContent = st.room.roomName;
    $id('mp-room-info').textContent =
      'ID ' + st.room.roomId + ' · JUGADORES ' + st.room.players.length + '/' + st.room.maxPlayers +
      ' · NIVEL ' + st.room.currentLevel;
    var meAdmin = st.room.adminPlayerId === st.playerId;
    var pl = $id('mp-room-players');
    pl.innerHTML = '';
    for (var p of st.room.players) {
      var row = document.createElement('div');
      row.className = 'mpx-pl';
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = '> ' + p.displayName + (p.playerId === st.playerId ? ' (TÚ)' : '');
      row.appendChild(nm);
      if (p.isAdmin) {
        var t2 = document.createElement('span');
        t2.className = 'admtag';
        t2.textContent = 'ADMIN';
        row.appendChild(t2);
      }
      if (!p.connected) {
        var z = document.createElement('span');
        z.className = 'zombie';
        z.textContent = 'RECONECTANDO...';
        row.appendChild(z);
      }
      if (meAdmin && p.playerId !== st.playerId) {
        var k = document.createElement('button');
        k.type = 'button';
        k.className = 'kick';
        k.textContent = 'KICK';
        k.addEventListener('click', (function (pid) {
          return function (e) { e.stopPropagation(); send({ t: 'kick', pid: pid }); };
        })(p.playerId));
        row.appendChild(k);
      }
      pl.appendChild(row);
    }
    renderLevelList($id('mp-levels'));
    var startBtn = $id('mp-start-btn');
    if (startBtn) {
      if (meAdmin && !st.room.started) startBtn.classList.remove('mpx-hide'); else startBtn.classList.add('mpx-hide');
    }
    var waiting = $id('mp-waiting');
    if (waiting) {
      if (meAdmin) waiting.classList.add('mpx-hide');
      else {
        waiting.classList.remove('mpx-hide');
        waiting.textContent = st.room.started ? 'PARTIDA EN CURSO' : 'ESPERANDO A QUE EL ADMIN EMPIECE...';
      }
    }
  }
  function openForm(mode, room) {
    st.formMode = mode;
    st.formRoom = room || null;
    showEl($id('mp-form'));
    hideEl($id('mp-lobby'));
    $id('mp-f-title').textContent = mode === 'join' ? 'UNIRSE A LA SALA' : 'CREAR SERVIDOR GLOBAL';
    var rr = $id('mp-f-roomrow'), mr = $id('mp-f-maxrow');
    if (mode === 'join') { hideEl(rr); hideEl(mr); }
    else { showEl(rr); showEl(mr); }
    $id('mp-f-go').textContent = mode === 'join' ? '▶ UNIRSE' : '▶ CREAR';
    var nm = '';
    try { nm = localStorage.getItem('BACKROOMS_MP_NAME') || ''; } catch (_) {}
    $id('mp-f-name').value = nm;
    $id('mp-f-room').value = '';
    if (mode === 'create') hideEl($id('mp-room'));
  }
  function closeForm() {
    hideEl($id('mp-form'));
    if (!st.room) showEl($id('mp-lobby'));
  }
  function renderAll() {
    renderServerCfg();
    renderRooms();
    renderRoom();
  }
  function bindUI() {
    var createBtn = $id('mp-create-btn');
    if (createBtn) createBtn.addEventListener('click', function () { setMsg(''); openForm('create', null); });
    var goBtn = $id('mp-f-go');
    if (goBtn) goBtn.addEventListener('click', function () {
      var nm = ($id('mp-f-name').value || '').trim();
      if (!nm) { setMsg('ESCRIBE TU NOMBRE DE JUGADOR'); return; }
      try { localStorage.setItem('BACKROOMS_MP_NAME', nm); } catch (_) {}
      if (st.formMode === 'join' && st.formRoom) {
        setStatus('ENTRANDO...', true);
        send({ t: 'join', roomId: st.formRoom.roomId, name: nm });
      } else {
        var rn = ($id('mp-f-room').value || '').trim();
        if (!rn) { setMsg('ESCRIBE EL NOMBRE DE LA SALA'); return; }
        var mx = parseInt($id('mp-f-max').value, 10) || 8;
        setStatus('CREANDO...', true);
        send({ t: 'create', room: rn, name: nm, max: mx });
      }
    });
    var cancelBtn = $id('mp-f-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { setMsg(''); closeForm(); });
    var leaveBtn = $id('mp-leave-btn');
    if (leaveBtn) leaveBtn.addEventListener('click', function () {
      send({ t: 'leave' });
      onLeft();
      setMsg('SALISTE DE LA SALA');
    });
    var startBtn = $id('mp-start-btn');
    if (startBtn) startBtn.addEventListener('click', function () { send({ t: 'start' }); });
    var srvSave = $id('mp-server-save');
    if (srvSave) srvSave.addEventListener('click', function () {
      var v = ($id('mp-server-input').value || '').trim();
      try { localStorage.setItem('BACKROOMS_MP_SERVER', v); } catch (_) {}
      st.pendingRejoin = null;
      clearSession();
      disposeAllRemotes();
      st.rooms = null;
      connect();
      setMsg('CONECTANDO AL NUEVO SERVIDOR...');
    });
  }

  /* ============ botón ONLINE (mismo método que el Nivel 0) ============ */
  window.__mpUseOnline = function () {
    try { localStorage.setItem('BACKROOMS_MP_SERVER', DEFAULT_SERVER); } catch (_) {}
    st.pendingRejoin = null;
    try { clearSession(); } catch (_) {}
    try { disposeAllRemotes(); } catch (_) {}
    st.rooms = null;
    connect();
    setMsg('CONECTANDO AL SERVIDOR GLOBAL...');
    /* abrir la pestaña MP para ver las salas */
    var tabBtn = $id('mp-tab-btn');
    if (tabBtn) {
      try { tabBtn.click(); } catch (_) { activateMyTab(); }
    } else activateMyTab();
  };

  /* ============ debug ============ */
  window.__mpDbg = function () {
    if (!cfg || !st) return { on: false, notReady: true, page: '?' };   // pre-init (módulo del nivel aún cargando)
    var p = { x: 0, z: 0 };
    try { p = cfg.getPos() || p; } catch (_) {}
    return {
      on: !!(st && st.room), page: cfg.level,
      roomId: st.room ? st.room.roomId : null,
      playerId: st.playerId, name: st.name,
      admin: st.room ? (st.room.adminPlayerId === st.playerId) : false,
      conn: st.status,
      players: st.room ? st.room.players.length : 0,
      roomLevel: st.room ? st.room.currentLevel : null,
      myColor: myColor(),
      chatLines: chatLog() ? chatLog().children.length : 0,
      chatOpen: chatOpen,
      onlineBtn: !!$id('mp-online-btn'),
      remotes: [...st.remotes.values()].map(function (r) {
        return {
          name: r.name, lvl: r.level, vis: !!(r.body && r.body.group && r.body.group.visible),
          x: +r.pos.x.toFixed(1), z: +r.pos.z.toFixed(1),
          d: +Math.hypot(r.pos.x - p.x, r.pos.z - p.z).toFixed(1)
        };
      })
    };
  };

  /* ============ init ============ */
  function init(userCfg) {
    cfg = Object.assign({
      level: '0',
      theme: 'green',
      eye: 1.68,
      spawn: { x: 0, z: 0 },
      startRoot: '#start',
      leftHost: '#start .start-left',
      tabsHost: '#start .tabs',
      tabsMode: null,                 /* 'create' → el nivel no tiene tabs: crear fila INFORME/MP */
      infoTabLabel: '■ INFORME',
      briefSel: null,                 /* selector del panel original (tabsMode 'create') */
      tabClass: 'tab',
      tabOnClass: 'on',
      tabLabel: '■ MODO MULTIJUGADOR',
      paneHost: '#start .brief',
      paneClass: 'tabpane',
      paneHidden: 'hidden',
      dataPane: null,
      pauseHost: '#pause',
      saveKey: 'BACKROOMS_SAVE_V1',
      getThree: function () { return window.THREE; },
      getScene: function () { return null; },
      getPos: function () { return { x: 0, z: 0, feet: 0, yaw: 0 }; },
      isPlaying: function () { return false; },
      autoEnter: function () {},
      returnToMenu: function () {},
      pauseIfPlaying: function () {},
      onChatOpen: function () {},
      toast: function (m) { try { console.log('[MP]', m); } catch (_) {} },
      playTime: function () { return 0; }
    }, userCfg || {});
    T = (typeof cfg.theme === 'string') ? (THEMES[cfg.theme] || THEMES.green) : Object.assign({}, THEMES.green, cfg.theme || {});
    if (cfg.levels) MP_LEVELS = cfg.levels;

    st = {
      ws: null, url: '', everConnected: false, closedByUs: false,
      status: 'CONECTANDO...', statusBad: true,
      room: null, playerId: null, token: null, name: '',
      rooms: null, pendingRejoin: null, msg: '',
      remotes: new Map(), lastSend: 0,
      backoff: 800, reconnectT: 0
    };

    injectCSS();
    buildUI();
    bindUI();

    /* sesión previa: URL (?mp=1&rid=&pid=&tok=) o localStorage */
    var sess = null;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('mp') === '1' && q.get('rid') && q.get('pid') && q.get('tok')) {
        sess = { roomId: q.get('rid'), playerId: q.get('pid'), token: q.get('tok') };
        try { st.name = q.get('name') || ''; } catch (_) {}
      }
    } catch (_) {}
    if (!sess) sess = loadSession();
    if (sess) st.pendingRejoin = sess;

    connect();
    setInterval(function () { if (st.ws && st.ws.readyState === 1) send({ t: 'ping' }); }, 5000);
    setInterval(function () { if (!st.room && st.ws && st.ws.readyState === 1) send({ t: 'list' }); }, 5000);

    /* loop propio */
    lastFrame = performance.now();
    rafId = requestAnimationFrame(mpFrame);

    return {
      active: function () { return !!(st.room && st.playerId); },
      level: cfg.level,
      activateTab: activateMyTab
    };
  }

  window.MPClient = {
    init: init,
    version: '2.2',
    levels: DEFAULT_LEVELS
  };
})();
