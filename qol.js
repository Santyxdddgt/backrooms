/* ═══════════════════════════════════════════════════════════════════
   qol.js — v3.8 KIT DE CALIDAD DE VIDA (BACKROOMS, todos los niveles)
   1) QOL.fitTitle: encoge el <h1> de la pantalla de título para que
      NUNCA solape la columna del informe (PC y móvil).
   2) QOL.tut: tutorial por nivel — la PRIMERA vez que se inicia el
      nivel en modo normal pregunta "¿Quieres ver el tutorial o ya
      sabes cómo jugar?" y muestra diapositivas animadas (canvas 2D)
      con un texto pequeño debajo.
   3) QOL.levelLinks / QOL.makeX2: utilidades para los paneles DEV
      (selector de nivel + velocidad ×2).
   4) QOL.credits: pestaña © CRÉDITOS en la pantalla de título de todos
      los niveles — grande y fácil de encontrar, sin tapar nada — con el
      modal de créditos de los modelos 3D (sin repeticiones).
   5) [v3.8] QOL.enterFs: pantalla completa AUTOMÁTICA al entrar al nivel
      como jugador (móvil: fullscreen + landscape · PC: fullscreen),
      también tras terminar el tutorial (el re-clic del CTA conserva el
      gesto de usuario, así requestFullscreen es válido).
   6) [v3.8] QOL.devWarn: aviso al usar la CINTA PRIVILEGIADA (DEV) —
      recomienda jugar normalmente si eres nuevo. En el NIVEL 0 exige
      mantener pulsado 5 s «SÍ, YA JUGUÉ ANTES» (o «SOY NUEVO» te saca
      de DEV); en el resto es un aviso simple SALIR / CONTINUAR A DEV.
      Con la confirmación de 5 s queda marcado veterano (localStorage
      BR_DEV_VETERAN) y no vuelve a molestar en ningún nivel.
   Carga:  <script src="./vendor/qol.js" defer
             data-fit="SELECTOR_H1" data-cont="SELECTOR_CONTENEDOR"
             data-tut="SELECTOR_BOTON|ID_NIVEL"
             data-dev="SELECTOR_CINTA_DEV|hold|warn"></script>
   Independiente de three.js y del resto del juego (sin dependencias).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var W = window;
var LS_SEEN = function (id) { return 'BR_TUT_SEEN_' + id; };

/* ───────────────────────── CSS (namespace .qol-) ───────────────────────── */
var CSS = ''
+ '.qol-ask,.qol-tut,.qol-dev{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(4,4,2,.82);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);font-family:"Special Elite","Courier New",monospace;color:#e8dc96;}'
+ '.qol-ask.hidden,.qol-tut.hidden,.qol-dev.hidden{display:none}'
+ '.qol-card{width:min(92vw,26rem);border:2px solid rgba(232,220,150,.55);background:rgba(14,12,5,.96);padding:1.2rem 1.1rem;text-align:center;box-shadow:0 0 34px rgba(232,220,150,.13),inset 0 0 24px rgba(0,0,0,.5)}'
+ '.qol-kick{font-size:.62rem;letter-spacing:.34em;opacity:.65;margin-bottom:.7rem}'
+ '.qol-q{font-size:.95rem;line-height:1.65;margin-bottom:1.05rem;color:#f3ecc8}'
+ '.qol-btns{display:flex;gap:.55rem;justify-content:center;flex-wrap:wrap}'
+ '.qol-b{font-family:inherit;font-size:.78rem;letter-spacing:.12em;padding:.72em 1em;cursor:pointer;border:1px solid rgba(232,220,150,.5);background:rgba(30,27,11,.9);color:#e8dc96;min-height:44px;-webkit-tap-highlight-color:transparent;touch-action:manipulation}'
+ '.qol-b:active{transform:translateY(2px)}'
+ '.qol-b.yes{border-color:rgba(125,255,154,.55);color:#a8e6b0;background:rgba(8,24,10,.85)}'
+ '.qol-tcard{width:min(94vw,25rem);border:2px solid rgba(232,220,150,.5);background:rgba(12,10,4,.97);padding:.85rem .8rem .75rem;text-align:center;box-shadow:0 0 40px rgba(232,220,150,.12)}'
+ '.qol-frame{position:relative;border:10px solid #2a2412;outline:2px solid rgba(232,220,150,.35);background:#0a0904;box-shadow:inset 0 0 22px rgba(0,0,0,.85),0 0 18px rgba(232,220,150,.09)}'
+ '.qol-frame canvas{display:block;width:100%;height:auto;image-rendering:auto}'
+ '.qol-scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px);mix-blend-mode:overlay}'
+ '.qol-txt{min-height:2.6em;font-size:.8rem;line-height:1.55;color:#f3ecc8;margin:.6rem .2rem .35rem;text-align:center}'
+ '.qol-txt b{color:#ffe98a}'
+ '.qol-luck{transition:color .18s,font-weight .18s}'
+ '.qol-txt .qol-luck.qol-bad{color:#ff4444;font-weight:bold;text-shadow:0 0 8px rgba(255,40,40,.6)}'
+ '.qol-dots{font-size:.6rem;letter-spacing:.45em;color:#9a8f62;margin:.15rem 0 .55rem}'
+ '.qol-nav{display:flex;gap:.4rem;justify-content:center;flex-wrap:wrap}'
+ '.qol-nav button{font-family:inherit;font-size:.72rem;letter-spacing:.1em;padding:.6em .9em;min-height:44px;cursor:pointer;border:1px solid rgba(232,220,150,.45);background:rgba(30,27,11,.9);color:#e8dc96;-webkit-tap-highlight-color:transparent;touch-action:manipulation}'
+ '.qol-nav button:active{transform:translateY(2px)}'
+ '.qol-nav #qolNext{border-color:rgba(125,255,154,.5);color:#a8e6b0}'
+ '.qol-nav #qolSkip{opacity:.55;font-size:.62rem;padding:.5em .7em}'
+ '.qol-lvl{display:block;text-decoration:none;text-align:left;margin:.22rem 0}'
+ 'a.qol-lvl{cursor:pointer}'
/* [v3.7] pestaña © CRÉDITOS (esquina inferior izquierda, solo en la
   pantalla de título) + modal de créditos */
+ '.qol-credtab{position:fixed;left:0;bottom:0;z-index:2147482000;display:inline-flex;align-items:center;gap:.5em;font-family:"Special Elite","Courier New",monospace;font-size:clamp(.82rem,2.6vw,.95rem);letter-spacing:.2em;color:#e8dc96;background:rgba(14,12,5,.93);border:2px solid rgba(232,220,150,.55);border-left:none;border-bottom:none;padding:.68em 1.1em .68em 1.2em;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;clip-path:polygon(0 0,calc(100% - 13px) 0,100% 13px,100% 100%,0 100%);box-shadow:0 0 16px rgba(232,220,150,.14);animation:qolCredPulse 4.2s ease-in-out infinite}'
+ '.qol-credtab:hover,.qol-credtab:active{background:rgba(34,30,13,.97);color:#ffe98a;border-color:rgba(255,233,138,.8)}'
+ '@keyframes qolCredPulse{0%,74%,100%{box-shadow:0 0 12px rgba(232,220,150,.12)}87%{box-shadow:0 0 26px rgba(232,220,150,.36)}}'
+ '.qol-cred{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(4,4,2,.85);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);font-family:"Special Elite","Courier New",monospace;color:#e8dc96;padding:1rem}'
+ '.qol-cred.hidden{display:none}'
+ '.qol-credcard{width:min(94vw,33rem);max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border:2px solid rgba(232,220,150,.55);background:rgba(14,12,5,.97);padding:1.05rem 1.15rem 1.15rem;box-shadow:0 0 34px rgba(232,220,150,.13),inset 0 0 24px rgba(0,0,0,.5)}'
+ '.qol-credcard .qol-kick{text-align:center}'
+ '.qol-crd-sec{font-size:.78rem;letter-spacing:.22em;color:#ffe98a;margin:1rem 0 .45rem;border-top:1px solid rgba(232,220,150,.25);padding-top:.85rem}'
+ '.qol-crd-item{margin:.55rem 0 .3rem;font-size:.8rem;line-height:1.7;color:#f3ecc8}'
+ '.qol-crd-item b{color:#ffe98a}'
+ '.qol-crd-item .qol-crd-l{color:#9a8f62}'
+ '.qol-crd-url{display:block;font-size:.6rem;line-height:1.5;letter-spacing:.02em;color:#7dd3c8;word-break:break-all;-webkit-user-select:text;user-select:text}'
+ '.qol-crd-note{margin-top:.9rem;font-size:.62rem;line-height:1.6;color:#9a8f62;letter-spacing:.06em}'
+ '.qol-cred .qol-btns{margin-top:1rem}'
/* [v3.8] aviso DEV — botón de mantener pulsado (hold 5 s) */
+ '.qol-hold{position:relative;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}'
+ '.qol-holdfill{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(125,255,154,.22);border-right:1px solid rgba(125,255,154,.65);pointer-events:none}'
+ '.qol-holdlbl{position:relative;display:inline-block}'
+ '.qol-hold.ok{border-color:rgba(125,255,154,.9);color:#d2ffdc}'
+ '.qol-hold.ok .qol-holdfill{width:100%;background:rgba(125,255,154,.32)}';
function injectCSS() {
  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/* ───────────────────────── fitTitle ─────────────────────────
   Encoge el font-size del h1 hasta que quepa en su contenedor.
   No rompe el efecto glitch (::before/::after son absolute). */
function fitTitle(sel, contSel) {
  function run() {
    var h1 = document.querySelector(sel);
    if (!h1) return;
    var cont = (contSel && document.querySelector(contSel)) || h1.parentElement;
    if (!cont) return;
    h1.style.fontSize = '';
    h1.style.whiteSpace = 'nowrap';
    var prev = h1.style.width;
    h1.style.width = 'max-content';
    var w = h1.getBoundingClientRect().width;
    h1.style.width = prev;
    var maxW = cont.clientWidth - 2;
    if (w > maxW && maxW > 40 && w > 0) {
      var fs = parseFloat(getComputedStyle(h1).fontSize) || 40;
      var k = Math.max(0.42, maxW / w);
      h1.style.fontSize = (fs * k).toFixed(1) + 'px';
      /* segunda pasada por redondeo del letter-spacing */
      h1.style.width = 'max-content';
      var w2 = h1.getBoundingClientRect().width;
      h1.style.width = prev;
      if (w2 > maxW) { fs = parseFloat(h1.style.fontSize); h1.style.fontSize = (fs * maxW / w2).toFixed(1) + 'px'; }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  addEventListener('resize', run);
  addEventListener('orientationchange', function () { setTimeout(run, 180); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(run, 30); });
  setTimeout(run, 900);
  return run;
}

/* ───────────────────────── selector de nivel (DEV) ───────────────────────── */
var LEVELS = [
  ['index.html', 'NIVEL 0 — THE LOBBY'],
  ['level2.html', 'NIVEL 2 — PIPE DREAMS'],
  ['level3.html', 'NIVEL 3 — ERROR 404'],
  ['level31.html', 'NIVEL 31 — ROLLER RINK'],
  ['level31_postblackout.html', 'NIVEL 31 — POST-BLACKOUT'],
  ['poolrooms.html', 'NIVEL 37 — POOLROOMS'],
  ['level37-2.html', 'NIVEL 37.2 — ALCANTARILLAS'],
  ['the-hub.html', 'THE HUB'],
  ['Level-FUN.html', 'LEVEL FUN =)']
];
function levelLinks(cur, cls) {
  return LEVELS.map(function (L) {
    var here = L[0] === cur;
    return '<a class="' + (cls || 'qol-lvl') + '" href="./' + L[0] + '"' + (here ? ' style="opacity:.45;pointer-events:none"' : '') + '>'
      + (here ? '● ' : '▶ ') + L[1] + (here ? ' (YA ESTÁS)' : '') + '</a>';
  }).join('');
}

/* ───────────────────────── botón ×2 (DEV) ─────────────────────────
   Devuelve un <button> listo para insertar en el panel DEV del nivel.
   onToggle(boolean) se llama al cambiar. */
function makeX2(onToggle) {
  var b = document.createElement('button');
  b.type = 'button';
  b.textContent = '🏃 ×2 VEL';
  b.setAttribute('data-on', '0');
  b.addEventListener('click', function (e) {
    e.stopPropagation();
    var on = b.getAttribute('data-on') === '1';
    b.setAttribute('data-on', on ? '0' : '1');
    b.textContent = on ? '🏃 ×2 VEL' : '🏃 ×2 VEL: ON';
    b.style.color = on ? '' : '#a8e6b0';
    b.style.borderColor = on ? '' : 'rgba(125,255,154,.6)';
    if (onToggle) onToggle(!on);
  });
  return b;
}

/* ───────────────────────── [v3.7] CRÉDITOS ─────────────────────────
   Pestaña «© CRÉDITOS» en la esquina inferior izquierda de la pantalla
   de título de TODOS los niveles: grande y fácil de encontrar (pulsa
   suave para llamar la atención) pero pegada a la esquina, sin tapar
   título, informe ni controles. Al arrancar el nivel se oculta sola.
   El modal lista cada modelo 3D UNA sola vez (sin repetir créditos). */
var CREDITS_MODELS = [
  { n: '«HOWLER BACK ROOMS» · Rigged Blender 3.01 <span class="qol-crd-l">(modelo «Bacteria»)</span>',
    a: 'ultramirage10',
    src: 'sketchfab.com/3d-models/howler-back-rooms-rigged-blender-301-7f8ed6c7ebb948ecb91eff5244b4b8a2',
    extra: 'sketchfab.com/ultramirage10', lic: 'CC BY 4.0' },
  { n: '«SKIN STEALER — THE BACKROOMS» · Blender 3.02',
    a: 'ultramirage10',
    src: 'sketchfab.com/3d-models/skin-stealer-the-backrooms-blender-302-c0db7c843ce44bb0a86a0b3a7d7884e1',
    extra: 'sketchfab.com/ultramirage10', lic: 'CC BY 4.0' },
  { n: '«ACCURATE SMILER BACKROOMS» · Blender 3.22',
    a: 'Speed12',
    src: 'skfb.ly/oAyYE',
    extra: 'creativecommons.org/licenses/by/4.0/', lic: 'CC BY 4.0' }
];
var credTab = null, credEl = null, credTimer = 0, credFitSel = null;
function credVisible(el) {
  if (!el) return false;
  if (!el.getClientRects || !el.getClientRects().length) return false;
  for (var n = el; n && n !== document.body; n = n.parentElement) {
    var cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var op = parseFloat(cs.opacity); if (!isNaN(op) && op < 0.05) return false;
    /* [v3.7] overlay "apagado" con transición lenta (p. ej. #overlay.off del 37):
       pointer-events:none se aplica AL INSTANTE (no transiciona) y marca la
       pantalla de título como muerta aunque la opacidad aún esté fundiendo. */
    if (cs.pointerEvents === 'none' && n !== el) return false;
  }
  return true;
}
function credTick() {
  if (!credTab) return;
  /* sin data-fit (página estática): siempre visible */
  var vis = true;
  if (credFitSel) {
    var h1 = document.querySelector(credFitSel);
    vis = h1 ? credVisible(h1) : false;
  }
  credTab.style.display = vis ? '' : 'none';
}
function credHTML() {
  var s = '';
  for (var i = 0; i < CREDITS_MODELS.length; i++) {
    var m = CREDITS_MODELS[i];
    s += '<div class="qol-crd-item"><b>' + m.n + '</b><br>'
      + '<span class="qol-crd-l">AUTOR</span> ' + m.a + ' · <span class="qol-crd-l">LICENCIA</span> ' + m.lic
      + '<span class="qol-crd-url">fuente: ' + m.src + '</span>'
      + (m.extra ? '<span class="qol-crd-url">' + m.extra + '</span>' : '')
      + '</div>';
  }
  return s;
}
function openCredits() {
  if (!credEl) {
    credEl = document.createElement('div');
    credEl.className = 'qol-cred hidden';
    credEl.innerHTML = '<div class="qol-credcard">'
      + '<div class="qol-kick">AI SLOP DE LOS BACKROOMS</div>'
      + '<div class="qol-crd-sec">■ MODELOS 3D — ENTIDADES FEAS</div>'
      + credHTML()
      + '<div class="qol-crd-note">Cada modelo se usa bajo su licencia Creative Commons Atribución 4.0 con su autoría intacta; los derechos de cada modelo siguen siendo de su autor.</div>'
      + '<div class="qol-btns"><button type="button" class="qol-b" id="qolCredX">CERRAR ✕</button></div>'
      + '</div>';
    document.body.appendChild(credEl);
    credEl.querySelector('#qolCredX').addEventListener('click', function (e) { e.stopPropagation(); credEl.classList.add('hidden'); });
    credEl.addEventListener('click', function (e) { if (e.target === credEl) credEl.classList.add('hidden'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && credEl && !credEl.classList.contains('hidden')) { e.preventDefault(); credEl.classList.add('hidden'); }
    }, true);
  }
  credEl.classList.remove('hidden');
}
function initCredits(fitSel) {
  if (credTab) return;
  injectCSS();
  credFitSel = fitSel || null;
  credTab = document.createElement('button');
  credTab.type = 'button';
  credTab.className = 'qol-credtab';
  credTab.innerHTML = '©&nbsp;CRÉDITOS';
  credTab.setAttribute('aria-label', 'Ver créditos');
  credTab.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); openCredits(); });
  credTab.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
  document.body.appendChild(credTab);
  credTick();
  clearInterval(credTimer);
  credTimer = setInterval(credTick, 500);
}

/* ───────────────────────── [v3.8] FULLSCREEN AL ENTRAR ─────────────────────────
   QOL.enterFs(cb): pide pantalla completa sobre <html> (PC y móvil; en móvil
   además bloquea la orientación a landscape). Si llega cb, se llama DESPUÉS
   de que la promesa de fullscreen se asiente (~30-70 ms), para que el
   requestPointerLock del nivel no compita con la transición (orden canónico:
   fullscreen → pointer lock). Tras asentarse re-dispara 'resize' un par de
   veces: los niveles recalculan renderer/cámara al escuchar 'resize'.
   Debe llamarse dentro del gesto de usuario (clic en ENTRAR / re-clic del
   tutorial): la activación transitoria de Chrome cubre el re-clic sintético. */
var fsEnterBusy = false;   /* (reservado; aún sin uso) */
function enterFs(cb) {
  var p = null;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen)
      p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch (_) {}
  try {
    if (screen.orientation && screen.orientation.lock)
      screen.orientation.lock('landscape').catch(function () {});
  } catch (_) {}
  var run = function () {
    if (cb) { try { cb(); } catch (_) {} }
    setTimeout(function () { try { dispatchEvent(new Event('resize')); } catch (_) {} }, 120);
    setTimeout(function () { try { dispatchEvent(new Event('resize')); } catch (_) {} }, 420);
  };
  if (p && p.then) p.then(function () { setTimeout(run, 30); }, run);
  else run();
}

/* ───────────────────────── [v3.8] AVISO CINTA DEV ─────────────────────────
   Al pulsar la CINTA PRIVILEGIADA — DEV sin ser "veterano":
   · NIVEL 0 (modo hold): diapositiva + «SÍ, YA JUGUÉ ANTES» (mantener
     pulsado 5 s) + «SOY NUEVO» (recomienda jugar normal y NO entra en DEV).
     El hold se confirma al SOLTAR tras 5 s: así el pointerup es un gesto
     fresco y el fullscreen/requestPointerLock posteriores son válidos.
   · Resto (modo warn): misma diapositiva + «SALIR» / «CONTINUAR A DEV».
   Veterano = completó el hold de 5 s una vez (BR_DEV_VETERAN): a partir de
   ahí la cinta DEV entra directa en TODOS los niveles. */
var LS_VET = 'BR_DEV_VETERAN';
function isVeteran() { try { return localStorage.getItem(LS_VET) === '1'; } catch (e) { return false; } }
function markVeteran() { try { localStorage.setItem(LS_VET, '1'); } catch (e) {} }

var TXT_DEV_WARN = 'Si es tu <b>primera vez</b>, juega <b>normalmente</b>: el tutorial te enseña las mecánicas <b>sin spoilers</b> y tu progreso cuenta de verdad. La cinta <b>DEV</b> puede spoilearte el final.';
var TXT_DEV_HOLD = TXT_DEV_WARN + '<br>¿Ya conoces el juego? <b>Mantén pulsado</b> el botón verde durante <b>5 segundos</b>.';
var TXT_DEV_NEW = '◆ <b>JUEGA NORMALMENTE</b><br>Inserta la cinta normal: el tutorial te espera en el nivel y tu progreso contará de verdad. Vuelve a la cinta DEV cuando ya conozcas el juego.';
var HOLD_MS = 5000;
var LBL_HOLD = 'SÍ, YA JUGUÉ ANTES — MANTÉN 5 s';

var devEl = null, devCv = null, devOpen = false, devRaf = 0, devT = 0, devLast = 0;
var devOnOk = null, devOnCancel = null;
var holdBtn = null, holdFill = null, holdLbl = null, holding = false, holdDone = false, holdT0 = 0;

function devVisible() { return !!(devEl && !devEl.classList.contains('hidden')); }
function buildDevWarn() {
  if (devEl) return;
  injectCSS();
  devEl = document.createElement('div');
  devEl.className = 'qol-dev hidden';
  devEl.innerHTML = '<div class="qol-tcard">'
    + '<div class="qol-kick" id="qolDevKick">CINTA PRIVILEGIADA — DEV</div>'
    + '<div class="qol-frame"><canvas id="qolDevCv" width="360" height="210"></canvas><div class="qol-scan"></div></div>'
    + '<div class="qol-txt" id="qolDevTxt"></div>'
    + '<div class="qol-btns" id="qolDevBtns"></div>'
    + '</div>';
  document.body.appendChild(devEl);
  devCv = devEl.querySelector('#qolDevCv');
  document.addEventListener('keydown', function (e) {
    if (devOpen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDevWarn(); }
  }, true);
}
function mkDevBtn(txt, cls, fn) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = txt;
  b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
  return b;
}
/* botón "SOY NUEVO": cambia el cuerpo del modal al mensaje de recomendación */
function devSoyNuevo() {
  var txt = devEl.querySelector('#qolDevTxt');
  var btns = devEl.querySelector('#qolDevBtns');
  txt.innerHTML = TXT_DEV_NEW;
  btns.innerHTML = '';
  btns.appendChild(mkDevBtn('ENTENDIDO ✕', 'qol-b', function () { closeDevWarn(); }));
}
function openDevWarn(mode, onOk, onCancel) {
  buildDevWarn();
  devOnOk = onOk || null; devOnCancel = onCancel || null;
  devOpen = true;
  var txt = devEl.querySelector('#qolDevTxt');
  var btns = devEl.querySelector('#qolDevBtns');
  btns.innerHTML = '';
  holdBtn = null; holding = false; holdDone = false;
  if (mode === 'hold') {
    txt.innerHTML = TXT_DEV_HOLD;
    btns.appendChild(mkDevBtn('SOY NUEVO', 'qol-b', devSoyNuevo));
    holdBtn = document.createElement('button');
    holdBtn.type = 'button';
    holdBtn.className = 'qol-b yes qol-hold';
    holdBtn.innerHTML = '<span class="qol-holdfill"></span><span class="qol-holdlbl">' + LBL_HOLD + '</span>';
    holdFill = holdBtn.querySelector('.qol-holdfill');
    holdLbl = holdBtn.querySelector('.qol-holdlbl');
    holdBtn.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      holdStart();
    });
    var end = function () { holdEnd(); };
    holdBtn.addEventListener('pointerup', end);
    holdBtn.addEventListener('pointercancel', end);
    holdBtn.addEventListener('pointerleave', end);
    holdBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    holdBtn.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holdStart(); }
    });
    holdBtn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') holdEnd();
    });
    btns.appendChild(holdBtn);
    /* [FIX QA r1] congela el ancho del botón al del rótulo MÁS LARGO: al
       cambiar el texto (MANTÉN… 4.9 s / ✔ CONFIRMADO) el botón encogía, el
       puntero quedaba fuera y un pointerleave espúreo cortaba el hold a los
       ~120 ms (reproducido con ratón en Chromium; en táctil no pasaba por
       la captura implícita del pointer). Ancho fijo = geometría estable. */
    try {
      var lbl0 = holdLbl.textContent;
      holdBtn.style.whiteSpace = 'nowrap';
      holdLbl.textContent = '✔ CONFIRMADO — SUELTA PARA ENTRAR';
      var wMax = holdBtn.getBoundingClientRect().width;
      holdLbl.textContent = lbl0;
      var w0 = holdBtn.getBoundingClientRect().width;
      holdBtn.style.width = Math.ceil(Math.max(w0, wMax)) + 'px';
    } catch (_) {}
  } else {
    txt.innerHTML = TXT_DEV_WARN;
    btns.appendChild(mkDevBtn('SALIR', 'qol-b', function () { closeDevWarn(); }));
    btns.appendChild(mkDevBtn('CONTINUAR A DEV ▶', 'qol-b yes', function () {
      devOpen = false; cancelAnimationFrame(devRaf);
      devEl.classList.add('hidden');
      var cb = devOnOk; devOnOk = null;
      if (cb) cb();
    }));
  }
  devEl.classList.remove('hidden');
  devT = 0; devLast = 0;
  cancelAnimationFrame(devRaf);
  var loop = function (ts) {
    if (!devOpen) return;
    if (devLast) devT += Math.min(0.05, (ts - devLast) / 1000);
    devLast = ts;
    devDrawFrame(devT);
    devRaf = requestAnimationFrame(loop);
  };
  devRaf = requestAnimationFrame(loop);
}
function closeDevWarn() {
  if (!devEl || devEl.classList.contains('hidden')) return;
  holding = false; holdDone = false;
  devOpen = false;
  cancelAnimationFrame(devRaf);
  devEl.classList.add('hidden');
  var cb = devOnCancel; devOnCancel = null;
  devOnOk = null;
  if (cb) cb();
}
function holdStart() {
  if (holding) return;
  holding = true; holdDone = false; holdT0 = performance.now();
  cancelAnimationFrame(devRaf_hold);
  var step = function () {
    if (!holding) return;
    var el = performance.now() - holdT0;
    var k = Math.min(1, el / HOLD_MS);
    if (holdFill) holdFill.style.width = (k * 100).toFixed(1) + '%';
    if (holdLbl) holdLbl.textContent = k < 1
      ? ('MANTÉN… ' + Math.max(0, (HOLD_MS - el) / 1000).toFixed(1) + ' s')
      : '✔ CONFIRMADO — SUELTA PARA ENTRAR';
    if (k >= 1) { holdDone = true; if (holdBtn) holdBtn.classList.add('ok'); return; }
    devRaf_hold = requestAnimationFrame(step);
  };
  devRaf_hold = requestAnimationFrame(step);
}
var devRaf_hold = 0;
function holdEnd() {
  if (!holding) return;
  holding = false;
  cancelAnimationFrame(devRaf_hold);
  if (holdDone) {
    /* confirmación con gesto fresco (pointerup) → el re-clic de la cinta
       puede pedir fullscreen/pointer lock sin problema */
    markVeteran();
    devOpen = false; cancelAnimationFrame(devRaf);
    devEl.classList.add('hidden');
    var cb = devOnOk; devOnOk = null;
    if (cb) cb();
    return;
  }
  if (holdBtn) holdBtn.classList.remove('ok');
  if (holdFill) holdFill.style.width = '0';
  if (holdLbl) holdLbl.textContent = LBL_HOLD;
}
/* ── dibujo de la diapositiva (canvas 360×210 lógico, mismo estilo que las
   del tutorial: sala oscura + triángulo de aviso pulsante + cinta DEV) ── */
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r);
  g.closePath();
}
function drawDevTape(g, x, y, tw, th, t) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#181610';
  g.strokeStyle = 'rgba(125,255,154,.75)';
  g.lineWidth = 2;
  g.shadowColor = 'rgba(125,255,154,.35)'; g.shadowBlur = 12;
  rr(g, -tw / 2, -th / 2, tw, th, 4); g.fill(); g.stroke();
  g.shadowBlur = 0;
  /* ventana central con los carretes */
  g.fillStyle = '#0a0906';
  rr(g, -tw / 2 + 12, -th / 2 + 6, tw - 24, th - 15, 3); g.fill();
  var ry = (th - 19) / 2;
  for (var i = -1; i <= 1; i += 2) {
    g.save();
    g.translate(i * tw * 0.21, -1);
    g.rotate(t * (i === -1 ? 1.4 : -1.1));
    g.strokeStyle = 'rgba(210,200,150,.8)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 0, ry * 0.62, 0, 7); g.stroke();
    g.beginPath();
    for (var k = 0; k < 3; k++) {
      var a = k * Math.PI / 3;
      g.moveTo(Math.cos(a) * ry * 0.18, Math.sin(a) * ry * 0.18);
      g.lineTo(Math.cos(a) * ry * 0.62, Math.sin(a) * ry * 0.62);
    }
    g.stroke();
    g.restore();
  }
  /* cinta entre carretes */
  g.strokeStyle = 'rgba(120,110,70,.7)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-tw * 0.21, -1); g.lineTo(tw * 0.21, -1); g.stroke();
  /* etiqueta */
  g.fillStyle = '#cbbd7a';
  rr(g, -tw / 2 + 8, th / 2 - 9.5, tw - 16, 7, 2); g.fill();
  g.fillStyle = '#1c1a12';
  g.font = 'bold 6.5px "Courier New",monospace';
  g.textAlign = 'center';
  g.fillText('CINTA PRIVILEGIADA — DEV', 0, th / 2 - 4);
  g.restore();
}
function drawDevSlide(g, w, h, t) {
  bgRoom(g, w, h, { dark: true });
  var cx = w / 2;
  /* triángulo de aviso pulsante */
  var pu = 0.5 + 0.5 * Math.sin(t * 2.6);
  g.save();
  g.translate(cx, h * 0.27);
  var s = 1 + pu * 0.06;
  g.scale(s, s);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,210,74,' + (0.7 + pu * 0.3).toFixed(3) + ')';
  g.fillStyle = 'rgba(58,44,10,.6)';
  g.shadowColor = 'rgba(255,200,60,.55)'; g.shadowBlur = 10 + pu * 8;
  g.beginPath();
  g.moveTo(0, -16); g.lineTo(15.5, 12); g.lineTo(-15.5, 12); g.closePath();
  g.fill(); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#ffd24a';
  g.fillRect(-1.9, -8, 3.8, 11);
  g.beginPath(); g.arc(0, 6.2, 2.1, 0, 7); g.fill();
  g.restore();
  /* cinta flotando */
  var bob = Math.sin(t * 1.6) * 3;
  drawDevTape(g, cx, h * 0.60 + bob, 118, 30, t);
  /* rótulo */
  g.save();
  g.font = 'bold 9px "Courier New",monospace';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(168,230,176,.92)';
  g.shadowColor = 'rgba(125,255,154,.45)'; g.shadowBlur = 6;
  g.fillText('¿PRIMERA VEZ? — RECOMENDADO: JUGAR NORMALMENTE', cx, h * 0.60 + bob + 32);
  g.restore();
}
function devDrawFrame(t) {
  if (!devCv) return;
  var dpr = Math.min(2, W.devicePixelRatio || 1);
  if (devCv.width !== CW * dpr) { devCv.width = CW * dpr; devCv.height = CH * dpr; }
  var g = devCv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  try { drawDevSlide(g, CW, CH, t || 0); } catch (e) { /* nunca tumbar el juego por el aviso */ }
}
/* ── hook de la cinta DEV (fase CAPTURA, igual que el tutorial) ── */
function hookDev(sel, mode) {
  var pass = false;
  document.addEventListener('click', function (e) {
    if (pass) return;
    if (isVeteran()) return;                     /* ya confirmó el hold de 5 s */
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest(sel);
    if (!btn || !document.querySelector(sel)) return;   /* fuera de la cinta: libre (botones del propio aviso incluidos) */
    if (devOpen) { e.preventDefault(); e.stopPropagation(); return; }   /* aviso abierto: no re-entrar por la cinta */
    e.preventDefault();
    e.stopPropagation();
    openDevWarn(mode, function () {
      pass = true;
      try { btn.click(); } catch (err) {}
      setTimeout(function () { pass = false; }, 800);
    }, null);
  }, true);
}

/* ───────────────────────── TUTORIAL — DOM base ───────────────────────── */
var askEl = null, tutEl = null, cvEl = null, txtEl = null, dotsEl = null, kickT = null, prevB = null, nextB = null, skipB = null;
function buildDOM() {
  if (askEl) return;
  injectCSS();
  askEl = document.createElement('div');
  askEl.className = 'qol-ask hidden';
  askEl.innerHTML = '<div class="qol-card"><div class="qol-kick" id="qolAskKick">TUTORIAL</div>'
    + '<div class="qol-q">¿Quieres ver el tutorial<br>o ya sabes cómo jugar?</div>'
    + '<div class="qol-btns"><button type="button" class="qol-b yes" id="qolYes">SÍ, QUIERO</button>'
    + '<button type="button" class="qol-b" id="qolNo">NO, MÁNDAME AL JUEGO</button></div></div>';
  tutEl = document.createElement('div');
  tutEl.className = 'qol-tut hidden';
  tutEl.innerHTML = '<div class="qol-tcard"><div class="qol-kick" id="qolTutKick">TUTORIAL</div>'
    + '<div class="qol-frame"><canvas id="qolTutCv" width="360" height="210"></canvas><div class="qol-scan"></div></div>'
    + '<div class="qol-txt" id="qolTutTxt"></div>'
    + '<div class="qol-dots" id="qolDots"></div>'
    + '<div class="qol-nav"><button type="button" id="qolPrev">◀ ANTERIOR</button>'
    + '<button type="button" id="qolSkip">SALTAR ✕</button>'
    + '<button type="button" id="qolNext">SIGUIENTE ▶</button></div></div>';
  document.body.appendChild(askEl);
  document.body.appendChild(tutEl);
  cvEl = tutEl.querySelector('#qolTutCv');
  txtEl = tutEl.querySelector('#qolTutTxt');
  dotsEl = tutEl.querySelector('#qolDots');
  kickT = tutEl.querySelector('#qolTutKick');
  prevB = tutEl.querySelector('#qolPrev');
  nextB = tutEl.querySelector('#qolNext');
  skipB = tutEl.querySelector('#qolSkip');
  prevB.addEventListener('click', function (e) { e.stopPropagation(); go(-1); });
  nextB.addEventListener('click', function (e) { e.stopPropagation(); go(1); });
  skipB.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
  document.addEventListener('keydown', function (e) {
    if (tutEl.classList.contains('hidden')) {
      if (!askEl.classList.contains('hidden') && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); noThanks(); }
      return;
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(1); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(); }
  }, true);
}

/* ───────── estado del tutorial ───────── */
var T = { id: null, slides: [], idx: 0, open: false, raf: 0, t0: 0, tclock: 0, lastTs: 0, luck: false, onDone: null, name: '' };
function seen(id) { try { return localStorage.getItem(LS_SEEN(id)) === '1'; } catch (e) { return false; } }
function markSeen(id) { try { localStorage.setItem(LS_SEEN(id), '1'); } catch (e) {} }

function openAsk(id, name, onDone) {
  buildDOM();
  T.id = id; T.onDone = onDone; T.name = name;
  askEl.querySelector('#qolAskKick').textContent = 'TUTORIAL — ' + name;
  askEl.classList.remove('hidden');
  var yes = askEl.querySelector('#qolYes'), no = askEl.querySelector('#qolNo');
  var y1 = function (e) { e.stopPropagation(); yes.removeEventListener('click', y1); no.removeEventListener('click', n1); askEl.classList.add('hidden'); openViewer(); };
  var n1 = function (e) { e.stopPropagation(); yes.removeEventListener('click', y1); no.removeEventListener('click', n1); noThanks(); };
  yes.addEventListener('click', y1);
  no.addEventListener('click', n1);
}
function noThanks() {
  askEl.classList.add('hidden');
  if (T.id) markSeen(T.id);
  var cb = T.onDone; T.onDone = null;
  if (cb) cb();
}
function openViewer() {
  T.slides = (TEXTS[T.id] || {}).slides || [];
  T.idx = 0; T.open = true;
  kickT.textContent = 'TUTORIAL — ' + T.name;
  tutEl.classList.remove('hidden');
  render();
  T.t0 = 0; T.tclock = 0; T.lastTs = 0;
  cancelAnimationFrame(T.raf);
  var loop = function (ts) {
    if (!T.open) return;
    if (T.lastTs) T.tclock += Math.min(0.05, (ts - T.lastTs) / 1000);
    T.lastTs = ts;
    draw();
    T.raf = requestAnimationFrame(loop);
  };
  T.raf = requestAnimationFrame(loop);
}
function go(d) {
  T.idx += d;
  if (T.idx >= T.slides.length) { finish(); return; }
  if (T.idx < 0) T.idx = 0;
  render();
}
function finish() {
  if (!T.open) return;
  T.open = false;
  cancelAnimationFrame(T.raf);
  tutEl.classList.add('hidden');
  if (T.id) markSeen(T.id);
  var cb = T.onDone; T.onDone = null;
  if (cb) cb();
}
function render() {
  var s = T.slides[T.idx];
  if (!s) return;
  txtEl.innerHTML = s.t;
  var luck = txtEl.querySelector('.qol-luck');
  if (luck) luck.classList.remove('qol-bad');
  dotsEl.textContent = T.slides.map(function (_, i) { return i === T.idx ? '●' : '○'; }).join(' ');
  prevB.style.visibility = T.idx === 0 ? 'hidden' : 'visible';
  nextB.textContent = T.idx === T.slides.length - 1 ? '¡A JUGAR! ▶' : 'SIGUIENTE ▶';
  T.tclock = 0; T.luck = false;
}
/* ───────────────────────── dibujo (canvas 360×210 lógico) ───────────────────────── */
var CW = 360, CH = 210;
function draw() {
  if (!cvEl) return;
  var s = T.slides[T.idx];
  if (!s) return;
  var dpr = Math.min(2, W.devicePixelRatio || 1);
  if (cvEl.width !== CW * dpr) { cvEl.width = CW * dpr; cvEl.height = CH * dpr; }
  var g = cvEl.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  var fn = SC[s.s] || SC.radar;
  try { fn(g, CW, CH, T.tclock, s.o || {}, { bad: setLuck }); } catch (e) { /* nunca tumbar el juego por el tutorial */ }
}
function setLuck(on) {
  if (T.luck === !!on) return;
  T.luck = !!on;
  var luck = txtEl && txtEl.querySelector('.qol-luck');
  if (luck) luck.classList.toggle('qol-bad', T.luck);
}
/* fondo "cuadro de backrooms": pared amarilla, zócalo, piso */
function bgRoom(g, w, h, o) {
  o = o || {};
  if (o.neon) { bgDream(g, w, h); return; }   /* [v3.7] variante Nivel 3 (ERROR 404) */
  var dark = o.dark, aqua = o.aqua;
  g.fillStyle = aqua ? '#9fb9b2' : dark ? '#4a4a4c' : '#b9a75f';
  if (o.wall) g.fillStyle = o.wall;
  g.fillRect(0, 0, w, h * 0.62);
  g.fillStyle = aqua ? '#5f7d84' : dark ? '#232326' : '#77652f';
  if (o.floor) g.fillStyle = o.floor;
  g.fillRect(0, h * 0.62, w, h * 0.38);
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.fillRect(0, h * 0.60, w, 3);
  g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 2;
  for (var px = 26; px < w; px += 58) { g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h * 0.6); g.stroke(); }
  if (!o.noDoor) {
    g.fillStyle = 'rgba(0,0,0,.30)';
    g.fillRect(w * 0.70, h * 0.17, 52, h * 0.45);
    g.fillStyle = 'rgba(0,0,0,.42)';
    g.fillRect(w * 0.70 + 22, h * 0.38, 6, 9);
  }
  var vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
/* [v3.7] fondo onírico del Nivel 3 (ERROR 404): cielo tinta con estrellas,
   horizonte de neón cian/magenta y rejilla en perspectiva — NADA de pared
   amarilla (la queja era que la diapositiva parecía del Nivel 0). */
function bgDream(g, w, h) {
  var sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#060410'); sky.addColorStop(1, '#150b26');
  g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.62);
  /* estrellas deterministas */
  g.fillStyle = 'rgba(255,255,255,.8)';
  var st = [[24, 18], [58, 42], [92, 10], [131, 30], [163, 14], [201, 38], [238, 20], [271, 44], [309, 12], [337, 34], [46, 55], [186, 52], [286, 56]];
  for (var i = 0; i < st.length; i++) {
    var tw = 0.5 + 0.5 * Math.sin(i * 2.7 + st[i][0]);
    g.globalAlpha = 0.25 + 0.55 * tw;
    g.fillRect(st[i][0], st[i][1], 1.6, 1.6);
  }
  g.globalAlpha = 1;
  /* piso del sueño */
  g.fillStyle = '#050508'; g.fillRect(0, h * 0.62, w, h * 0.38);
  /* rejilla de neón en perspectiva */
  g.strokeStyle = 'rgba(0,255,247,.30)'; g.lineWidth = 1;
  var hy = h * 0.62;
  for (var k = 1; k <= 5; k++) {
    var yy = hy + Math.pow(k / 5, 2) * (h - hy);
    g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke();
  }
  for (var cx = -4; cx <= 4; cx++) {
    g.beginPath(); g.moveTo(w / 2 + cx * 14, hy); g.lineTo(w / 2 + cx * 64, h); g.stroke();
  }
  /* horizonte: doble línea glitch cian + magenta */
  g.save();
  g.strokeStyle = '#00fff7'; g.shadowColor = '#00fff7'; g.shadowBlur = 8; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, hy); g.lineTo(w, hy); g.stroke();
  g.strokeStyle = '#ff2bd6'; g.shadowColor = '#ff2bd6'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, hy + 2.5); g.lineTo(w, hy + 2.5); g.stroke();
  g.restore();
  var vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
/* persona blanca simplificada (phase anima piernas/brazos) */
function person(g, x, y, s, phase, o) {
  o = o || {};
  var run = o.run, hide = o.hide;
  if (hide) return;
  g.save();
  g.translate(x, y);
  g.fillStyle = o.col || '#f4f4f4';
  g.shadowColor = 'rgba(255,255,255,.5)'; g.shadowBlur = 7;
  g.beginPath(); g.arc(0, -21 * s, 5.4 * s, 0, 7); g.fill();            /* cabeza */
  g.fillRect(-4 * s, -15 * s, 8 * s, 12 * s);                            /* torso */
  var k = run ? Math.sin(phase * 2) : Math.sin(phase);
  g.strokeStyle = o.col || '#f4f4f4'; g.lineWidth = 2.6 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-1.5 * s, -4 * s); g.lineTo(-1.5 * s - k * 5 * s, 6 * s + Math.abs(k) * 2 * s); g.stroke();   /* pierna izq */
  g.beginPath(); g.moveTo(1.5 * s, -4 * s); g.lineTo(1.5 * s + k * 5 * s, 6 * s - Math.abs(k) * 2 * s); g.stroke();     /* pierna der */
  g.beginPath(); g.moveTo(-3.5 * s, -13 * s); g.lineTo(-3.5 * s - k * 6 * s, -6 * s); g.stroke();                        /* brazo izq */
  g.beginPath(); g.moveTo(3.5 * s, -13 * s); g.lineTo(3.5 * s + k * 6 * s, -6 * s); g.stroke();                          /* brazo der */
  g.restore();
}
/* entidad genérica: silueta oscura encorvada, ojos rojos */
function entity(g, x, y, s, o) {
  o = o || {};
  g.save(); g.translate(x, y);
  g.fillStyle = o.col || '#0c0c12';
  g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 9;
  g.beginPath(); g.ellipse(0, -17 * s, 9 * s, 17 * s, 0, 0, 7); g.fill(); /* cuerpo encorvado */
  g.beginPath(); g.arc(0, -33 * s, 6 * s, 0, 7); g.fill();               /* cabeza */
  g.shadowBlur = 0;
  g.fillStyle = o.eye || '#ff2b2b'; g.shadowColor = o.eye || '#ff2b2b'; g.shadowBlur = 8;
  g.beginPath(); g.arc(-2.2 * s, -34 * s, 1.3 * s, 0, 7); g.fill();
  g.beginPath(); g.arc(2.2 * s, -34 * s, 1.3 * s, 0, 7); g.fill();
  if (o.smile) { g.strokeStyle = '#fff'; g.lineWidth = 1.4 * s; g.beginPath(); g.arc(0, -32 * s, 3 * s, 0.25, Math.PI - 0.25); g.stroke(); }
  g.restore();
}
/* shard violeta (o icono alternativo) */
function shard(g, x, y, s, o) {
  g.save();
  var col = (o && o.col) || '#b26bff';
  g.globalAlpha = o && o.alpha !== undefined ? o.alpha : 1;
  g.shadowColor = col; g.shadowBlur = 12;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y - 9 * s); g.lineTo(x + 6 * s, y); g.lineTo(x, y + 9 * s); g.lineTo(x - 6 * s, y);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.65)';
  g.beginPath(); g.moveTo(x, y - 9 * s); g.lineTo(x + 6 * s, y); g.lineTo(x, y); g.closePath(); g.fill();
  g.restore();
}
/* [v3.7] SUEÑO del Nivel 3: octaedro WIREFRAME de neón con núcleo blanco
   (como los del juego: OctahedronGeometry wireframe + inner blanco) —
   reemplaza al shard violeta que se dibujaba antes. */
var DREAM_COLS = ['#ffee00', '#00fff7', '#ff2bd6', '#39ff6a', '#ff2200', '#ff8af0'];
function dream(g, x, y, s, t, o) {
  o = o || {};
  var ci = (o.ci !== undefined) ? o.ci : 0;
  var col = o.col || DREAM_COLS[ci % DREAM_COLS.length];
  var r = (o.r || 10) * s;
  var bob = Math.sin(t * 2 + ci * 1.3) * 3 * s;
  g.save();
  if (o.alpha !== undefined) g.globalAlpha = Math.max(0, Math.min(1, o.alpha));
  g.translate(x, y + bob);
  /* halo */
  var gr = g.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
  gr.addColorStop(0, hexA(col, 0.5)); gr.addColorStop(1, hexA(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 2.4, 0, 7); g.fill();
  g.rotate(Math.sin(t * 1.2 + ci) * 0.35);
  /* octaedro wireframe */
  g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.lineWidth = 1.7 * s;
  g.beginPath();
  g.moveTo(0, -r); g.lineTo(r * 0.78, 0); g.lineTo(0, r); g.lineTo(-r * 0.78, 0); g.closePath();
  g.stroke();
  g.beginPath(); g.moveTo(0, -r); g.lineTo(0, r); g.moveTo(-r * 0.78, 0); g.lineTo(r * 0.78, 0); g.stroke();
  /* núcleo blanco */
  g.shadowColor = '#fff'; g.shadowBlur = 8;
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.beginPath(); g.moveTo(0, -r * 0.42); g.lineTo(r * 0.32, 0); g.lineTo(0, r * 0.42); g.lineTo(-r * 0.32, 0); g.closePath(); g.fill();
  g.restore();
}
function hexA(hex, a) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
}
/* [v3.7] ELLA (Nivel 3): niña pálida de vestido claro, ojos oscuros y
   aura magenta — como el sprite del juego (genGirl), no un ente genérico. */
function girl(g, x, y, s, o) {
  o = o || {};
  g.save();
  g.translate(x, y);
  var col = o.col || '#eef0f6';
  g.shadowColor = 'rgba(255,43,214,.85)'; g.shadowBlur = 12;
  /* vestido */
  g.fillStyle = col;
  g.beginPath(); g.moveTo(-2.7 * s, -27 * s); g.lineTo(2.7 * s, -27 * s); g.lineTo(7 * s, -8 * s); g.lineTo(-7 * s, -8 * s); g.closePath(); g.fill();
  /* piernas */
  g.fillRect(-2.4 * s, -8 * s, 1.7 * s, 8 * s); g.fillRect(0.7 * s, -8 * s, 1.7 * s, 8 * s);
  /* cabeza pálida + pelo oscuro */
  g.beginPath(); g.arc(0, -31 * s, 5 * s, 0, 7); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#0d0d16';
  g.beginPath(); g.arc(0, -32.2 * s, 5.2 * s, Math.PI * 0.95, Math.PI * 2.05); g.fill();
  /* ojos oscuros */
  g.fillStyle = '#050508';
  g.fillRect(-2.5 * s, -31.5 * s, 1.5 * s, 1.7 * s); g.fillRect(1 * s, -31.5 * s, 1.5 * s, 1.7 * s);
  /* aberración cromática */
  g.globalAlpha = 0.55;
  g.strokeStyle = '#00fff7'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-3 * s + 1.5, -30 * s); g.lineTo(-3 * s + 1.5, -12 * s); g.stroke();
  g.strokeStyle = '#ff2bd6';
  g.beginPath(); g.moveTo(3 * s - 1.5, -30 * s); g.lineTo(3 * s - 1.5, -12 * s); g.stroke();
  g.restore();
}
/* [v3.7] LA MASA / EL CLUMP (Nivel 37.2): bulto de carne oscura con
   brazos pálidos radiando y una fauce de labios rojos y dientes blancos. */
function clumpMass(g, x, y, s, t, o) {
  o = o || {};
  g.save();
  g.translate(x, y);
  var breathe = 1 + Math.sin(t * 1.8) * 0.06;
  g.scale(breathe, 2 - breathe);
  /* masa */
  g.fillStyle = '#7e241d';
  g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 10;
  g.beginPath(); g.ellipse(0, -12 * s, 15 * s, 13 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#99352e';
  g.beginPath(); g.ellipse(-2 * s, -15 * s, 10 * s, 8 * s, 0, 0, 7); g.fill();
  /* brazos radiando (wiggle) */
  g.strokeStyle = '#c9a08e'; g.lineWidth = 2.2 * s; g.lineCap = 'round';
  g.shadowBlur = 0;
  var NA = 7;
  for (var i = 0; i < NA; i++) {
    var a = -Math.PI * 0.92 + (i / (NA - 1)) * Math.PI * 1.84 + Math.sin(t * 2.4 + i * 1.7) * 0.12;
    var L = (12 + (i % 3) * 4) * s;
    g.beginPath();
    g.moveTo(Math.cos(a) * 8 * s, -12 * s + Math.sin(a) * 8 * s);
    var mx = Math.cos(a) * (8 + L * 0.55) * s + Math.sin(t * 3 + i) * 2.5 * s;
    var my = -12 * s + Math.sin(a) * (8 + L * 0.5) * s;
    g.quadraticCurveTo(mx, my, Math.cos(a) * (8 + L) * s, -12 * s + Math.sin(a) * (8 + L) * s);
    g.stroke();
    /* manita */
    g.fillStyle = '#c9a08e';
    var hx = Math.cos(a) * (8 + L) * s, hy = -12 * s + Math.sin(a) * (8 + L) * s;
    for (var f = 0; f < 3; f++) { g.beginPath(); g.arc(hx + (f - 1) * 1.6 * s, hy - 1.2 * s, 1.1 * s, 0, 7); g.fill(); }
  }
  /* fauce: labios rojos + dientes blancos */
  var open = 0.5 + 0.5 * Math.sin(t * 2.2);
  g.fillStyle = '#821a20';
  g.beginPath(); g.ellipse(0, -17 * s, 6.4 * s, 3.4 * s + open * 1.2 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#220507';
  g.beginPath(); g.ellipse(0, -17 * s, 4.6 * s, 1.8 * s + open * 1.1 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#f7edd9';
  for (var d = -2; d <= 2; d++) {
    g.beginPath();
    g.moveTo(d * 1.7 * s, -17 * s - (1.8 * s + open * 1.1 * s));
    g.lineTo(d * 1.7 * s + 0.8 * s, -17 * s - (0.7 * s + open * 0.5 * s));
    g.lineTo(d * 1.7 * s - 0.8 * s, -17 * s - (0.7 * s + open * 0.5 * s));
    g.closePath(); g.fill();
  }
  g.restore();
}
/* botón radar verde parpadeante */
function radarBtn(g, x, y, r, t) {
  var blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 5));
  g.save();
  g.globalAlpha = blink;
  g.strokeStyle = '#58ff7a'; g.shadowColor = '#58ff7a'; g.shadowBlur = 14;
  g.lineWidth = 2.6;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
  g.fillStyle = 'rgba(40,120,60,.55)';
  g.beginPath(); g.arc(x, y, r - 4, 0, 7); g.fill();
  g.fillStyle = '#7dffa0';
  g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
  g.restore();
  for (var i = 0; i < 2; i++) {
    var ph = ((t * 0.9 + i * 0.5) % 1);
    g.save();
    g.globalAlpha = (1 - ph) * blink;
    g.strokeStyle = '#58ff7a'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, r + 6 + ph * 16, 0, 7); g.stroke();
    g.restore();
  }
  g.save();
  g.strokeStyle = '#7dffa0'; g.lineWidth = 2; g.globalAlpha = blink;
  var a = (t * 2.4) % (Math.PI * 2);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (r - 5), y + Math.sin(a) * (r - 5)); g.stroke();
  g.restore();
}
function destornillador(g, x, y, s) {
  g.save(); g.translate(x, y); g.rotate(-0.6);
  g.strokeStyle = '#cfd6dd'; g.lineWidth = 3.4 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-8 * s, 2 * s); g.lineTo(7 * s, -2 * s); g.stroke();
  g.strokeStyle = '#8d97a3'; g.lineWidth = 2.2 * s;
  g.beginPath(); g.moveTo(-13 * s, 3.4 * s); g.lineTo(-8 * s, 2 * s); g.stroke();
  g.beginPath(); g.moveTo(-13 * s, 1 * s); g.lineTo(-8 * s, 1.6 * s); g.stroke();
  g.restore();
}
function flecha(g, x, y, dx, dy, col) {
  g.save();
  g.strokeStyle = col || '#ffe98a'; g.fillStyle = col || '#ffe98a'; g.lineWidth = 3; g.lineCap = 'round';
  g.shadowColor = col || '#ffe98a'; g.shadowBlur = 8;
  var L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  g.beginPath(); g.moveTo(x - ux * 10, y - uy * 10); g.lineTo(x + ux * 10, y + uy * 10); g.stroke();
  g.beginPath(); g.moveTo(x + ux * 12, y + uy * 12);
  g.lineTo(x + ux * 12 - (ux * 6 - uy * 5), y + uy * 12 - (uy * 6 + ux * 5));
  g.lineTo(x + ux * 12 - (ux * 6 + uy * 5), y + uy * 12 - (uy * 6 - ux * 5));
  g.closePath(); g.fill();
  g.restore();
}
function keycap(g, x, y, txt, s) {
  g.save();
  g.fillStyle = 'rgba(20,22,16,.95)'; g.strokeStyle = '#9a8f62'; g.lineWidth = 1.5;
  var w2 = 15 * s, h2 = 13 * s;
  g.fillRect(x - w2 / 2, y - h2 / 2, w2, h2); g.strokeRect(x - w2 / 2, y - h2 / 2, w2, h2);
  g.fillStyle = '#ffe98a'; g.font = 'bold ' + (8 * s) + 'px "Courier New",monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, x, y + 0.5);
  g.restore();
}

/* ───────── las ESCENAS (una por diapositiva) ───────── */
var SC = {
  /* 1 — radar parpadeando dentro del cuadro */
  radar: function (g, w, h, t, o) {
    bgRoom(g, w, h, o);
    var icon = o.icon || 'shard';
    var pts = [[w * 0.16, h * 0.46], [w * 0.84, h * 0.44], [w * 0.62, h * 0.86]];
    for (var i = 0; i < pts.length; i++) {
      if (icon === 'screw') destornillador(g, pts[i][0], pts[i][1], 1.5);
      else shard(g, pts[i][0], pts[i][1], 1.15, { alpha: 0.55 + 0.45 * Math.abs(Math.sin(t * 2 + i)) });
    }
    radarBtn(g, w / 2, h * 0.55, 26, t);
    g.fillStyle = '#9df6c0'; g.font = '9px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('RADAR', w / 2, h * 0.55 + 42);
  },
  /* 2 — persona va hacia la shard (o sueño), la agarra y vuelve (bucle) con contador */
  collect: function (g, w, h, t, o) {
    o = o || {};
    bgRoom(g, w, h, o);
    var total = o.total || 5, P = 2.6;
    var cyc = Math.floor(t / P), tt = (t % P) / P;
    var got = (cyc) % (total + 1);
    var sx = w * 0.14, tx = w * 0.80;
    var px = sx + (tx - sx) * tt;
    var fading = tt > 0.94;
    var label = (o.label || 'SHARDS');
    g.fillStyle = '#f3ecc8'; g.font = 'bold 10px "Courier New",monospace'; g.textAlign = 'left';
    g.fillText(label + '  ' + Math.min(got + (fading ? 1 : 0), total) + '/' + total, 12, 20);
    var dy = h * 0.80;
    if (o.icon === 'screw') destornillador(g, tx + 8, dy - 20, 1.7);
    else if (o.icon === 'dream') {
      /* [v3.7] sueños secundarios flotando (los 6 repartidos por las zonas) */
      dream(g, w * 0.62, h * 0.30, 0.72, t, { ci: 2 });
      dream(g, w * 0.86, h * 0.22, 0.60, t, { ci: 4 });
      dream(g, w * 0.70, dy - 8, 0.55, t, { ci: 1, alpha: 0.9 });
      dream(g, tx + 8, dy - 20, 1.5, t, { ci: cyc % 6, alpha: fading ? Math.max(0, 1 - (tt - 0.94) / 0.06) : 1 });
    }
    else shard(g, tx + 8, dy - 20, 1.5, { alpha: fading ? Math.max(0, 1 - (tt - 0.94) / 0.06) : 0.55 + 0.45 * Math.abs(Math.sin(t * 2.4)) });
    person(g, px, dy, 1.05, t * (o.slow ? 3 : 8), { run: !o.slow });
    g.strokeStyle = 'rgba(255,233,138,.35)'; g.setLineDash([4, 6]); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(w * 0.14, dy + 8); g.lineTo(tx + 8, dy + 8); g.stroke(); g.setLineDash([]);
  },
  /* 3 — entidad y jugador quietos, aviso */
  danger: function (g, w, h, t, o) {
    bgRoom(g, w, h, o);
    var dy = h * 0.80;
    person(g, w * 0.26, dy, 1.05, 0, {});
    entity(g, w * 0.72, dy, 1.25, o);
    var p = 0.5 + 0.5 * Math.sin(t * 5);
    g.save();
    g.globalAlpha = 0.5 + 0.5 * p;
    g.fillStyle = '#ff4444'; g.font = 'bold 26px "Courier New",monospace'; g.textAlign = 'center';
    g.shadowColor = '#ff4444'; g.shadowBlur = 12;
    g.fillText('¡!', w * 0.49, dy - 26);
    g.restore();
  },
  /* 4 — la entidad se acerca poco a poco; al llegar, el jugador desaparece
         y "mala suerte" se pone rojo (ui.bad) */
  chase: function (g, w, h, t, o, ui) {
    bgRoom(g, w, h, o);
    var P = o.big ? 6.2 : 4.8, tt = t % P, dy = h * 0.80;
    var ex0 = w * 0.96, ex1 = w * 0.30;
    var k = Math.pow(Math.min(1, tt / (P - 0.9)), 0.72);           /* se va acercando poco a poco */
    var ex = ex0 + (ex1 - ex0) * k;
    var caught = tt > P - 0.9;
    if (ui) ui.bad(caught);
    var px = w * 0.30;
    person(g, px, dy, 1.05, t * 9, { run: true, hide: caught });
    if (o.girl) girl(g, ex, dy, o.big ? 1.35 : 1.15, {});   /* [v3.7] ELLA persigue (Nivel 3) */
    else entity(g, ex, dy, o.big ? 1.5 : 1.25, o);
    if (!caught) { /* estelas de velocidad del jugador */
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2;
      for (var i = 0; i < 3; i++) { var yy = dy - 6 - i * 9; g.beginPath(); g.moveTo(px - 16 - i * 6, yy); g.lineTo(px - 40 - i * 10, yy); g.stroke(); }
    } else {
      g.save(); g.globalAlpha = 0.75;
      g.fillStyle = '#ff4444'; g.font = 'bold 13px "Courier New",monospace'; g.textAlign = 'center';
      g.shadowColor = '#ff4444'; g.shadowBlur = 10;
      g.fillText('✕ ✕ ✕', px, dy - 34); g.restore();
    }
  },
  /* apagón: todo se oscurece y aparece EL SONRIENTE; el jugador corre */
  blackout: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#6d6a52', floor: '#3c3826' });
    var P = 4.2, tt = t % P;
    var dark = tt < 2.4 ? Math.min(1, tt / 0.7) : Math.max(0, 1 - (tt - 2.4) / 0.7);
    var dy = h * 0.80;
    person(g, w * (0.15 + 0.5 * ((tt * 0.35) % 1)), dy, 1.05, t * 9, { run: true });
    if (dark > 0.5) { /* la sonrisa en la oscuridad */
      var a = (dark - 0.5) * 2;
      g.save(); g.globalAlpha = a;
      g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 2.4;
      g.shadowColor = '#fff'; g.shadowBlur = 14;
      g.beginPath(); g.arc(w * 0.68, h * 0.42, 16, 0.3, Math.PI - 0.3); g.stroke();   /* sonrisa */
      g.beginPath(); g.arc(w * 0.68 - 22, h * 0.34, 3, 0, 7); g.fill();               /* ojos */
      g.beginPath(); g.arc(w * 0.68 + 22, h * 0.34, 3, 0, 7); g.fill();
      g.restore();
    }
    g.fillStyle = 'rgba(0,0,0,' + (0.82 * dark) + ')';
    g.fillRect(0, 0, w, h);
  },
  /* rejilla: se abre embistiéndola corriendo */
  gate: function (g, w, h, t, o) {
    bgRoom(g, w, h, o);
    var P = 3.4, tt = t % P, dy = h * 0.80;
    var gx = w * 0.55;
    var open = tt > 1.5 ? Math.min(1, (tt - 1.5) / 0.6) : 0;
    g.save();
    var lift = open * h * 0.34;
    g.strokeStyle = '#9aa3ad'; g.lineWidth = 4; g.lineCap = 'round';
    for (var i = 0; i < 4; i++) { var xx = gx + i * 9; g.beginPath(); g.moveTo(xx, h * 0.44 - lift); g.lineTo(xx, dy + 6 - lift); g.stroke(); }
    g.lineWidth = 6; g.beginPath(); g.moveTo(gx - 4, h * 0.44 - lift); g.lineTo(gx + 31, h * 0.44 - lift); g.stroke();
    g.restore();
    var px = tt < 1.5 ? w * (0.12 + 0.30 * Math.min(1, tt / 1.5)) : gx + 30 + (tt - 1.5) * 34;
    person(g, Math.min(px, w * 0.9), dy, 1.05, t * 9, { run: true });
    if (tt > 1.35 && tt < 1.55) { g.fillStyle = '#ffe98a'; g.font = 'bold 15px "Courier New"'; g.textAlign = 'center'; g.fillText('¡CLANK!', gx + 14, h * 0.36); }
  },
  /* ELLA (nivel 3): niña pálida, no te acerques */
  ella: function (g, w, h, t, o) {
    bgDream(g, w, h);
    var dy = h * 0.80;
    g.strokeStyle = 'rgba(255,60,90,.8)'; g.lineWidth = 2.4; g.setLineDash([6, 5]);
    g.beginPath(); g.arc(w * 0.72, dy - 22, 44 + Math.sin(t * 3) * 3, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ff3c5a'; g.font = 'bold 11px "Courier New",monospace'; g.textAlign = 'center';
    g.shadowColor = '#ff2bd6'; g.shadowBlur = 8;
    g.fillText('NO TE ACERQUES', w * 0.72, h * 0.16);
    g.shadowBlur = 0;
    person(g, w * 0.24, dy, 1.05, 0, {});
    girl(g, w * 0.72, dy, 1.55, {});
  },
  /* pista de patinaje con luces girando */
  rink: function (g, w, h, t, o) {
    g.fillStyle = '#1a1226'; g.fillRect(0, 0, w, h * 0.5);
    g.fillStyle = '#7a4a22'; g.fillRect(0, h * 0.5, w, h * 0.5);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    for (var i = 1; i < 4; i++) { g.beginPath(); g.ellipse(w / 2, h * 0.78, 40 * i, 12 * i, 0, 0, 7); g.stroke(); }
    var cols = ['#ff5f6d', '#ffd93d', '#4d96ff', '#9b5de5'];
    for (var c = 0; c < 4; c++) {
      var a = t * 1.3 + c * Math.PI / 2;
      var x0 = w / 2 + Math.cos(a) * w * 0.4, x1 = w / 2 + Math.cos(a) * w * 0.12;
      var grd = g.createLinearGradient(x0, h * 0.06, x1, h * 0.6);
      grd.addColorStop(0, cols[c]); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.globalAlpha = 0.5; g.fillStyle = grd;
      g.beginPath(); g.moveTo(x0, h * 0.02); g.lineTo(x1 - 16, h * 0.6); g.lineTo(x1 + 16, h * 0.6); g.closePath(); g.fill();
      g.restore();
    }
    var ang = t * 1.15;
    var px = w / 2 + Math.cos(ang) * 96, py = h * 0.78 + Math.sin(ang) * 22;
    g.save(); g.translate(px, py); g.rotate(Math.sin(t * 6) * 0.14); g.translate(-px, -py);
    person(g, px, py, 1.0, t * 7, { run: true });
    g.restore();
  },
  /* patines ×2 */
  skates: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#6d6a52', floor: '#7a4a22' });
    g.save();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.lineCap = 'round';
    for (var i = 0; i < 4; i++) { var xx = w * 0.5 - 42 - i * 16 - (t * 40 % 16); g.beginPath(); g.moveTo(xx, h * 0.5 - 8 + i * 6); g.lineTo(xx - 18, h * 0.5 - 8 + i * 6); g.stroke(); }
    g.restore();
    var bx = w * 0.58, by = h * 0.56, k = Math.sin(t * 2.6) * 3;
    g.save(); g.translate(bx, by + k); g.rotate(-0.08);
    g.fillStyle = '#e8dc96'; g.strokeStyle = '#e8dc96'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-20, -26); g.lineTo(8, -26); g.lineTo(16, -6); g.lineTo(18, 6); g.lineTo(-20, 6); g.closePath(); g.fill();   /* bota */
    g.beginPath(); g.arc(0, -31, 6, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-20, 6); g.lineTo(-30, 2); g.moveTo(-30, 2); g.lineTo(-36, 12); g.stroke();                                  /* cuchilla */
    for (var wl = 0; wl < 2; wl++) { g.beginPath(); g.arc(-8 + wl * 16, 12, 4, 0, 7); g.stroke(); }                                       /* ruedas */
    g.restore();
    g.fillStyle = '#ffe98a'; g.font = 'bold 17px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('×2', w * 0.5, h * 0.2);
    person(g, w * 0.16, h * 0.84, 1.05, t * 8, { run: true });
  },
  /* el apagón cae en la pista */
  apagon: function (g, w, h, t, o) {
    SC.rink(g, w, h, t, o);
    var P = 4.6, tt = t % P;
    var dark = tt < 3.2 ? Math.min(1, tt / 1.0) : Math.max(0, 1 - (tt - 3.2) / 1.4);
    g.fillStyle = 'rgba(2,1,6,' + (0.9 * dark) + ')'; g.fillRect(0, 0, w, h);
    if (dark > 0.6) {
      g.save(); g.globalAlpha = (dark - 0.6) * 2.5;
      g.fillStyle = '#ff4444'; g.font = 'bold 16px "Courier New",monospace'; g.textAlign = 'center';
      g.shadowColor = '#ff4444'; g.shadowBlur = 14; g.fillText('¡APAGÓN!', w / 2, h * 0.2);
      g.restore();
    }
  },
  /* cordura: luz + vaso de agua (31 post) */
  sanity: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#241016', floor: '#120609' });
    var dy = h * 0.80, cx = w * 0.34;
    var r = 56 + Math.sin(t * 1.7) * 7;
    var grd = g.createRadialGradient(cx, dy - 16, 4, cx, dy - 16, r);
    grd.addColorStop(0, 'rgba(255,236,160,.95)'); grd.addColorStop(1, 'rgba(255,236,160,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, dy - 16, r, 0, 7); g.fill();
    person(g, cx, dy, 1.05, t * 2, {});
    g.fillStyle = 'rgba(4,2,4,.88)';
    g.beginPath(); g.rect(0, 0, w, h); g.arc(cx, dy - 16, r * 0.98, 0, 7, true); g.fill();
    /* vaso de agua */
    var vx = w * 0.78, vy = h * 0.55 + Math.sin(t * 2.2) * 2;
    g.save();
    g.strokeStyle = '#9adcff'; g.fillStyle = 'rgba(90,190,255,.5)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(vx - 9, vy - 14); g.lineTo(vx - 7, vy + 12); g.lineTo(vx + 7, vy + 12); g.lineTo(vx + 9, vy - 14); g.closePath(); g.fill(); g.stroke();
    g.restore();
    flecha(g, vx - 26, vy + 26, 1, -1, '#9adcff');
  },
  /* grieta: entra y noclip */
  rift: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#241016', floor: '#120609' });
    var P = 3.6, tt = t % P, dy = h * 0.80;
    var cx = w * 0.68;
    g.save();
    g.strokeStyle = '#ffe98a'; g.shadowColor = '#ffe98a'; g.shadowBlur = 16; g.lineWidth = 3.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 4, h * 0.16);
    g.lineTo(cx + 8, h * 0.34); g.lineTo(cx - 10, h * 0.5); g.lineTo(cx + 6, h * 0.68); g.lineTo(cx - 2, h * 0.84);
    g.stroke();
    g.lineWidth = 1.4; g.globalAlpha = 0.6;
    g.beginPath(); g.moveTo(cx + 2, h * 0.2); g.lineTo(cx + 14, h * 0.4); g.lineTo(cx - 2, h * 0.56); g.lineTo(cx + 10, h * 0.72);
    g.stroke(); g.restore();
    var px = w * 0.16 + (cx - 26 - w * 0.16) * Math.min(1, tt / 2.2);
    var gone = tt > 2.2;
    person(g, px, dy, 1.05, t * 5, { run: true, hide: gone });
    if (gone) { g.save(); g.globalAlpha = Math.max(0, 1 - (tt - 2.2) / 0.9); person(g, px, dy, 1.05, 0, {}); g.restore(); }
  },
  /* agua: caminar lento (37) */
  water: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#9fb9b2', floor: '#5f7d84' });
    for (var i = 0; i < 4; i++) {
      var yy = h * 0.66 + i * 13;
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
      g.beginPath();
      for (var xx = 0; xx <= w; xx += 8) g.lineTo(xx, yy + Math.sin(xx * 0.05 + t * (1.4 + i * 0.3) + i) * 2.6);
      g.stroke();
    }
    person(g, w * (0.2 + 0.42 * ((t * 0.13) % 1)), h * 0.82, 1.05, t * 2.2, { slow: true });
    g.fillStyle = '#cfeee8'; g.font = '9px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('SIN CORRER · SIN SALTAR', w / 2, h * 0.12);
  },
  /* escalera de caracol + destornillador (37) */
  spiral: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#9fb9b2', floor: '#5f7d84', noDoor: true });
    var cx = w * 0.52, cy = h * 0.52, rot = t * 1.1;
    g.save();
    g.strokeStyle = '#d8f3ec'; g.lineWidth = 2.4; g.shadowColor = '#9adcff'; g.shadowBlur = 7;
    for (var a = 0; a < Math.PI * 6; a += 0.18) {
      var rr = 4 + a * 5.4, xx = cx + Math.cos(a + rot * 0.4) * rr, yy = cy + Math.sin(a + rot * 0.4) * rr * 0.62;
      if (a === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.stroke(); g.restore();
    destornillador(g, cx, cy - 4, 1.6);
    flecha(g, cx - 66, cy + 38, -0.5, -1, '#ffe98a');
    person(g, w * 0.14, h * 0.84, 1.05, t * 2, {});
  },
  /* tapa de drenaje: destornillador y bajar (37 → 37.2) */
  drain: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#9fb9b2', floor: '#4f6d74' });
    var cx = w * 0.5, cy = h * 0.62;
    g.save();
    g.strokeStyle = '#d8f3ec'; g.lineWidth = 2.6; g.shadowColor = '#9adcff'; g.shadowBlur = 8;
    g.beginPath(); g.ellipse(cx, cy, 34, 13, 0, 0, 7); g.stroke();
    for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx - 30, cy + i * 4.6); g.lineTo(cx + 30, cy + i * 4.6); g.stroke(); }
    g.restore();
    destornillador(g, cx + 44, cy - 24, 1.5 + Math.sin(t * 5) * 0.12);
    var p = (t * 0.5) % 1;
    g.save(); g.globalAlpha = 1 - p;
    person(g, cx - 46, h * 0.8, 1.0, t * 3, {}); g.restore();
    flecha(g, cx, cy + 34, 0, 1, '#ffe98a');
    g.fillStyle = '#cfeee8'; g.font = '9px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('▼ NIVEL 37.2', cx, h * 0.94);
  },
  /* nadar bajo el agua (37.2) */
  swim: function (g, w, h, t, o) {
    var grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0b2b30'); grd.addColorStop(1, '#061418');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 9; i++) {
      var bx = (i * 53 + t * 22) % (w + 30) - 15, by = h - ((t * 26 + i * 67) % (h + 20));
      g.strokeStyle = 'rgba(190,240,255,.4)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(bx, by, 2 + (i % 3), 0, 7); g.stroke();
    }
    g.save();
    g.translate(w * 0.5, h * 0.55); g.rotate(Math.sin(t * 2) * 0.06);
    g.translate(-w * 0.5, -h * 0.55);
    person(g, w * 0.5 + Math.sin(t * 1.2) * 26, h * 0.55, 1.05, t * 3.2, {});
    g.restore();
    keycap(g, w * 0.5 - 34, h * 0.86, 'C', 1.3);
    keycap(g, w * 0.5 + 34, h * 0.86, 'SHIFT', 1.3);
    g.fillStyle = '#cfeee8'; g.font = '8.5px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('SUMERGIRTE', w * 0.5 - 34, h * 0.86 + 14);
    g.fillText('BRAZADA FUERTE', w * 0.5 + 34, h * 0.86 + 14);
  },
  /* linterna + válvulas (37.2) */
  valve: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#2e3a36', floor: '#141d1a', noDoor: true });
    var cone = g.createLinearGradient(w * 0.16, h * 0.4, w * 0.8, h * 0.75);
    cone.addColorStop(0, 'rgba(255,240,190,.5)'); cone.addColorStop(1, 'rgba(255,240,190,0)');
    g.save(); g.translate(w * 0.16, h * 0.4); g.rotate(Math.sin(t * 1.3) * 0.14); g.translate(-w * 0.16, -h * 0.4);
    g.fillStyle = cone;
    g.beginPath(); g.moveTo(w * 0.16, h * 0.4); g.lineTo(w * 0.72, h * 0.3); g.lineTo(w * 0.88, h * 0.82); g.lineTo(w * 0.3, h * 0.82); g.closePath(); g.fill();
    g.restore();
    keycap(g, w * 0.11, h * 0.34, 'F', 1.3);
    var vx = w * 0.74, vy = h * 0.42, rot = t * 1.4;
    g.save(); g.translate(vx, vy); g.rotate(rot);
    g.strokeStyle = '#ffd93d'; g.lineWidth = 3.4; g.shadowColor = '#ffd93d'; g.shadowBlur = 9;
    g.beginPath(); g.arc(0, 0, 17, 0, 7); g.stroke();
    for (var s = 0; s < 3; s++) { var a = s * Math.PI / 3; g.beginPath(); g.moveTo(-Math.cos(a) * 17, -Math.sin(a) * 17); g.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); g.stroke(); }
    g.restore();
    /* nivel de agua sube al girar la válvula */
    var lvl = 0.16 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.7));
    g.fillStyle = 'rgba(90,190,220,.35)'; g.fillRect(0, h * (1 - lvl), w, h * lvl);
    g.strokeStyle = 'rgba(190,240,255,.5)'; g.lineWidth = 2;
    g.beginPath();
    for (var xx = 0; xx <= w; xx += 8) g.lineTo(xx, h * (1 - lvl) + Math.sin(xx * 0.06 + t * 2.2) * 2.4);
    g.stroke();
    person(g, w * 0.16, h * 0.8, 1.05, t * 2, {});
  },
  /* [v3.7] BRAZADA ACUÁTICA (37.2): la barra de energía — un toque = 25%,
     ráfaga de 4 al mantener, barra vacía = AGOTADO, y recarga sola.
     CICLO: 0-1.2s nado lento (barra llena) · 1.2-2.4s ráfaga de 4 toques
     (la barra cae 25% por toque y el nadador pega saltos) · 2.4-3.6s
     AGOTADO en rojo (nado penoso) · 3.6-6.2s recarga progresiva. */
  brazada: function (g, w, h, t, o) {
    var grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0b2b30'); grd.addColorStop(1, '#061418');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 7; i++) {
      var bx = (i * 57 + t * 20) % (w + 30) - 15, by = h - ((t * 24 + i * 71) % (h + 20));
      g.strokeStyle = 'rgba(190,240,255,.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(bx, by, 2 + (i % 3), 0, 7); g.stroke();
    }
    /* ---- barra de energía (HUD real: swFill + swCd) ---- */
    var bx0 = 12, bw = w - 24, by0 = 14, bh = 11;
    var P = 6.2, tt = t % P;
    var energy, label = 'BRAZADA', labCol = '#9adcff';
    if (tt < 1.2) energy = 1;                                            /* llena */
    else if (tt < 2.4) energy = 1 - Math.floor((tt - 1.2) / 0.3) * 0.25; /* 4 toques */
    else if (tt < 3.6) { energy = 0; label = 'AGOTADO'; labCol = '#ff5555'; } /* vacía */
    else energy = Math.min(1, (tt - 3.6) / 2.6);                          /* recarga */
    g.strokeStyle = 'rgba(154,220,255,.65)'; g.lineWidth = 1.4;
    g.strokeRect(bx0, by0, bw, bh);
    var fg = g.createLinearGradient(bx0, 0, bx0 + bw, 0);
    fg.addColorStop(0, '#2e8f9e'); fg.addColorStop(1, '#9adcff');
    g.fillStyle = energy > 0 ? fg : 'rgba(255,85,85,.35)';
    g.fillRect(bx0 + 1.5, by0 + 1.5, Math.max(0, (bw - 3) * energy), bh - 3);
    /* marcas del 25% */
    g.strokeStyle = 'rgba(6,20,24,.8)';
    for (var qm = 1; qm < 4; qm++) { g.beginPath(); g.moveTo(bx0 + (bw * qm) / 4, by0); g.lineTo(bx0 + (bw * qm) / 4, by0 + bh); g.stroke(); }
    g.fillStyle = labCol; g.font = 'bold 9px "Courier New",monospace'; g.textAlign = 'left';
    g.fillText(label, bx0, by0 + bh + 11);
    /* ---- nadador ---- */
    var sx = w * 0.16, exhaustion = (tt >= 2.4 && tt < 3.6);
    var burst = (tt >= 1.2 && tt < 2.4);
    var prog = (tt / P) * 0.98;
    var px = sx + (w * 0.62) * prog;
    var swimY = h * 0.56 + (exhaustion ? Math.sin(t * 9) * 1.5 : Math.sin(t * (burst ? 10 : 3)) * 2);
    g.save();
    g.translate(px, swimY); g.rotate(Math.sin(t * (burst ? 9 : 3)) * 0.1);
    /* brazos dando brazadas */
    g.strokeStyle = '#f4f4f4'; g.lineWidth = 2.4; g.lineCap = 'round';
    var arm = Math.sin(t * (burst ? 12 : 5));
    g.beginPath(); g.moveTo(-2, -6); g.lineTo(-10 - arm * 8, -14 + arm * 4); g.stroke();
    g.beginPath(); g.moveTo(-2, -6); g.lineTo(-10 + arm * 8, -14 - arm * 4); g.stroke();
    g.fillStyle = '#f4f4f4'; g.shadowColor = 'rgba(255,255,255,.45)'; g.shadowBlur = 6;
    g.beginPath(); g.arc(4, -10, 4.4, 0, 7); g.fill();          /* cabeza (perfil) */
    g.fillRect(-6, -8, 10, 6);                                  /* torso */
    g.beginPath(); g.ellipse(-14, -5, 5, 2.4, 0.5, 0, 7); g.fill();   /* piernas pateando */
    g.restore();
    /* estela de impulso en la ráfaga */
    if (burst) {
      g.strokeStyle = 'rgba(154,220,255,.5)'; g.lineWidth = 2;
      for (var st2 = 0; st2 < 3; st2++) { g.beginPath(); g.moveTo(px - 18 - st2 * 9, swimY - 4 + st2 * 4); g.lineTo(px - 34 - st2 * 11, swimY - 4 + st2 * 4); g.stroke(); }
    }
    if (exhaustion) {
      g.fillStyle = '#ff5555'; g.font = 'bold 12px "Courier New",monospace'; g.textAlign = 'center';
      g.shadowColor = '#ff5555'; g.shadowBlur = 10;
      g.fillText('¡AGOTADO!', w * 0.5, h * 0.30); g.shadowBlur = 0;
    }
    keycap(g, w * 0.80, h * 0.80, 'SHIFT', 1.25);
    g.fillStyle = '#cfeee8'; g.font = '8.5px "Courier New",monospace'; g.textAlign = 'center';
    g.fillText('TOQUE = 1 BRAZADA', w * 0.80, h * 0.80 + 15);
    g.fillText('MANTENER = RÁFAGA', w * 0.80, h * 0.80 + 26);
  },
  /* [v3.7] LA MASA / EL CLUMP (37.2): patrulla, te huele (¿?), te caza (!)
     y el escape es BUCEAR en agua profunda (rompe el rastro bajo el agua).
     CICLO: 0-2.2s huele (quieta, ¿? ámbar) · 2.2-4.2s caza (se arrastra
     hacia el jugador, ! roja) · 4.2-6.4s el jugador se zambulle y la masa
     pierde el rastro (…, el jugador bajo el agua). */
  clump: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#2e3a36', floor: '#141d1a', noDoor: true });
    var P = 6.4, tt = t % P;
    var waterY = h * 0.72;
    /* agua del suelo (poca profundidad visible) */
    var wg = g.createLinearGradient(0, waterY, 0, h);
    wg.addColorStop(0, 'rgba(90,190,220,.34)'); wg.addColorStop(1, 'rgba(6,40,50,.66)');
    g.fillStyle = wg; g.fillRect(0, waterY, w, h - waterY);
    g.strokeStyle = 'rgba(190,240,255,.55)'; g.lineWidth = 2;
    g.beginPath();
    for (var xx = 0; xx <= w; xx += 8) g.lineTo(xx, waterY + Math.sin(xx * 0.05 + t * 2.4) * 2.2);
    g.stroke();
    /* posiciones */
    var px = w * 0.16, cx0 = w * 0.92, cx1 = w * 0.58;
    var hunting = tt >= 2.2 && tt < 4.2;
    var diving = tt >= 4.2;
    var cx = diving ? cx1 + Math.sin(t * 1.5) * 4 : (hunting ? cx0 + (cx1 - cx0) * Math.min(1, (tt - 2.2) / 2) : cx0 + Math.sin(t * 0.8) * 6);
    /* jugador: corre, luego se zambulle */
    if (diving) {
      var dk = Math.min(1, (tt - 4.2) / 0.7);
      var py = waterY + dk * 14;
      g.save(); g.globalAlpha = 1 - dk * 0.55;
      person(g, px + 10, py, 1.0, 0, { hide: dk >= 1 });
      g.restore();
      /* burbujas */
      g.strokeStyle = 'rgba(190,240,255,.7)';
      for (var bb = 0; bb < 3; bb++) {
        var bby = py - ((t * 30 + bb * 23) % 26);
        g.beginPath(); g.arc(px + 6 + bb * 5, bby, 1.6 + (bb % 2), 0, 7); g.stroke();
      }
    } else {
      person(g, px, waterY - 4, 1.05, t * (hunting ? 10 : 2), { run: hunting });
    }
    /* LA MASA */
    clumpMass(g, cx, waterY + 2, hunting ? 1.05 : 0.92, t);
    /* estado sobre la masa */
    g.font = 'bold 13px "Courier New",monospace'; g.textAlign = 'center';
    if (!hunting && !diving) {
      g.fillStyle = '#ffd93d'; g.shadowColor = '#ffd93d'; g.shadowBlur = 8;
      g.fillText('¿?', cx, waterY - 56);
    } else if (hunting) {
      g.fillStyle = '#ff4444'; g.shadowColor = '#ff4444'; g.shadowBlur = 10;
      g.fillText('!', cx, waterY - 56);
      /* arrastre: líneas detrás */
      g.strokeStyle = 'rgba(200,120,90,.4)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx + 20, waterY - 2); g.lineTo(cx + 52, waterY - 2); g.stroke();
      g.beginPath(); g.moveTo(cx + 16, waterY + 4); g.lineTo(cx + 40, waterY + 4); g.stroke();
    } else {
      g.fillStyle = '#9a8f62'; g.shadowBlur = 0;
      g.fillText('…', cx, waterY - 56);
    }
    g.shadowBlur = 0;
    /* refugio con luz (zona segura) al fondo */
    var lx = w * 0.07;
    var lg = g.createRadialGradient(lx, waterY - 18, 2, lx, waterY - 18, 26);
    lg.addColorStop(0, 'rgba(255,236,160,.85)'); lg.addColorStop(1, 'rgba(255,236,160,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(lx, waterY - 18, 26, 0, 7); g.fill();
    g.fillStyle = '#ffe9a0'; g.font = 'bold 7.5px "Courier New",monospace';
    g.fillText('REFUGIO', lx, waterY - 44);
    g.fillText('CON LUZ', lx, waterY - 36);
  },
  /* el hub: grietas en las paredes, elegir nivel */
  doors: function (g, w, h, t, o) {
    bgRoom(g, w, h, { wall: '#6f6a5c', floor: '#3a362c' });
    var cols = ['#ffe36e', '#7de3ff', '#ff6e7d', '#ff9de3'];
    for (var i = 0; i < 4; i++) {
      var dx = w * 0.18 + i * (w * 0.21), dyy = h * 0.48;
      g.save();
      g.strokeStyle = cols[i]; g.shadowColor = cols[i]; g.shadowBlur = 10 + 5 * Math.sin(t * 3 + i);
      g.lineWidth = 2.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(dx, dyy - 26); g.lineTo(dx + 5, dyy - 10); g.lineTo(dx - 5, dyy + 6); g.lineTo(dx + 4, dyy + 26); g.stroke();
      g.restore();
      /* peldaño */
      g.fillStyle = 'rgba(232,220,150,.8)';
      g.fillRect(dx - 10, h * 0.78, 20, 5);
    }
    var sel = Math.floor(t / 2.2) % 4;
    var tx = w * 0.18 + sel * (w * 0.21);
    var px = w * 0.08 + (tx - w * 0.08) * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.4)));
    person(g, Math.min(px, w * 0.82), h * 0.84, 1.05, t * 4, {});
  }
};
/* ───────────────────────── textos por nivel ───────────────────────── */
var TEXTS = {
  n0: { name: 'NIVEL 0', slides: [
    { s: 'radar', o: { icon: 'shard' }, t: 'Apreta el <b>radar</b> para identificar dónde hay <b>shards</b>' },
    { s: 'collect', o: { total: 5, icon: 'shard', label: 'SHARDS' }, t: 'Agarra <b>5 shards</b> guiándote del radar' },
    { s: 'danger', t: '¡Ten cuidado de las <b>entidades</b>!, escapa de ellas' },
    { s: 'ch', placeholder: 1, t: '' }
  ]},
  n2: { name: 'NIVEL 2', slides: [
    { s: 'radar', o: { icon: 'shard' }, t: 'Apreta el <b>radar</b>: marca la esquirla más cercana' },
    { s: 'collect', o: { total: 3, icon: 'shard', label: 'ESQUIRLAS' }, t: 'Recoge <b>3 esquirlas</b> y la <b>GRIETA</b> se estabiliza' },
    { s: 'blackout', t: 'En los <b>APAGONES</b> aparece EL SONRIENTE: corre lejos hasta que vuelva la luz' },
    { s: 'gate', t: 'Las rejillas se abren <b>embistiéndolas corriendo</b>' }
  ]},
  n3: { name: 'NIVEL 3 — ERROR 404', slides: [
    { s: 'collect', o: { total: 6, icon: 'dream', label: 'SUEÑOS', neon: true }, t: 'Conecta los <b>6 SUEÑOS</b> repartidos por las zonas de neón' },
    { s: 'ella', t: '<b>ELLA</b> aparece donde puedes verla: <b>no te acerques</b>' },
    { s: 'ch', placeholder: 1, t: '' }
  ]},
  n31: { name: 'NIVEL 31 — ROLLER RINK', slides: [
    { s: 'rink', t: 'Recorre las <b>5 zonas</b> del anillo y escucha a <b>EL ENTRENADOR</b>' },
    { s: 'skates', t: 'Calza los <b>PATINES</b>: sobre la madera vas al doble' },
    { s: 'apagon', t: 'Cuando la pista te reconozca… caerá <b>EL APAGÓN</b>' }
  ]},
  n31p: { name: 'NIVEL 31 — POST-BLACKOUT', slides: [
    { s: 'radar', o: { icon: 'shard' }, t: 'Recoge <b>5 esquirlas</b> — el radar marca la más cercana' },
    { s: 'sanity', t: 'Quédate en la <b>LUZ</b> y bebe agua para conservar la cordura' },
    { s: 'ch', placeholder: 1, t: '' },
    { s: 'rift', t: 'Con las 5, nada a la <b>GRIETA-PISCINA</b> y haz noclip' }
  ]},
  n37: { name: 'NIVEL 37 — POOLROOMS', slides: [
    { s: 'water', t: 'El agua frena el paso: <b>camina tranquilo</b>, sin correr' },
    { s: 'radar', o: { icon: 'screw' }, t: 'El <b>RADAR</b> marca un destornillador perdido a ~140 m' },
    { s: 'spiral', t: 'Súbete a la <b>ESCALERA DE CARACOL</b> y recógelo arriba del todo' },
    { s: 'drain', t: 'Abre la <b>TAPA DE DRENAJE</b> con el destornillador y desciende al <b>37.2</b>' }
  ]},
  n372: { name: 'NIVEL 37.2 — ALCANTARILLAS', slides: [
    { s: 'swim', t: 'Nada entre salas oscuras: <b>C</b> te sumerge, <b>SHIFT</b> da la brazada fuerte' },
    { s: 'brazada', t: 'En el agua: <b>un toque = 1 brazada</b> (25% de energía) · mantener = <b>ráfaga</b> de hasta 4 · barra vacía = <b>AGOTADO</b><br>Si una entidad te caza: cuesta 18% y recarga en 1,5 s — úsala para escapar' },
    { s: 'valve', t: 'La <b>linterna (F)</b> ilumina — gira las <b>VÁLVULAS</b> para mover el agua' },
    { s: 'clump', t: '<b>LA MASA</b> patrulla los sectores oscuros y es más rápida que tú<br><b>Bucea</b> en agua profunda, <b>cortale la vista</b> o llega a un <b>refugio con luz</b>' }
  ]},
  hub: { name: 'THE HUB', slides: [
    { s: 'collect', o: { total: 3, icon: 'shard', label: 'ESQUIRLAS' }, t: 'Recoge esquirlas por el nexo — <b>zona segura</b>, sin entidades' },
    { s: 'doors', t: 'Cada <b>GRIETA</b> lleva a un nivel: salta el peldaño y entra' }
  ]}
};
/* textos de la diapositiva "chase" (compartida por varios niveles) */
var CH_TEXTS = {
  n0: 'O podrías tener <span class="qol-luck">mala suerte</span>',
  n3: 'Si te ve, caza… o <span class="qol-luck">mala suerte</span>',
  n31p: '<b>EL RETORCIDO</b> camina la pista: rompe su línea de visión… <span class="qol-luck">y no mires atrás</span>'
};
/* [v3.7] n372 ya NO usa la diapositiva chase: spoileaba la secuencia final
   (la escalera que despierta, la persecución y los toboganes). El tutorial
   del 37.2 ahora enseña brazadas y LA MASA sin contar nada del final. */
(function fixChSlides() {
  for (var k in TEXTS) {
    var sl = TEXTS[k].slides;
    for (var i = 0; i < sl.length; i++) {
      if (sl[i].placeholder) {
        var oo = (k === 'n31p' ? { smile: true } : (k === 'n3' ? { neon: true, girl: true } : {}));
        sl[i] = { s: 'chase', o: oo, t: CH_TEXTS[k] || CH_TEXTS.n0 };
      }
    }
  }
})();

/* ───────────────────────── hook del botón de inicio ─────────────────────────
   Intercepts the click on the start CTA (fase CAPTURA en document: corre
   ANTES que el listener del juego sin importar el orden de registro). */
function hook(sel, id) {
  if (!TEXTS[id]) return;
  var pass = false;
  document.addEventListener('click', function (e) {
    if (pass) return;
    if (W.__BACKROOMS_DEV) return;                    /* cinta DEV: sin tutorial */
    if (/(&|\?)dev=1/.test(location.search)) return;
    if (seen(id)) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest(sel);
    if (!btn || !document.querySelector(sel)) return;
    if (!askEl || askEl.classList.contains('hidden')) {
      if (tutEl && !tutEl.classList.contains('hidden')) { e.preventDefault(); e.stopPropagation(); return; }
    }
    e.preventDefault();
    e.stopPropagation();
    openAsk(id, TEXTS[id].name, function () {
      pass = true;
      try { btn.click(); } catch (err) {}
      setTimeout(function () { pass = false; }, 800);
    });
  }, true);
}

/* ───────────────────────── arranque declarativo (data-*) ───────────────────────── */
function boot() {
  var scripts = document.querySelectorAll('script[src*="qol.js"]');
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i], ds = s.dataset || {};
    if (ds.fit) fitTitle(ds.fit, ds.cont);
    if (ds.tut) {
      var parts = ds.tut.split('|');
      if (parts.length === 2) hook(parts[0], parts[1]);
    }
    /* [v3.8] aviso de la cinta DEV: data-dev="SELECTOR|hold|warn" */
    if (ds.dev) {
      var pd = ds.dev.split('|');
      if (pd.length >= 2) hookDev(pd[0], pd[1]);
    }
  }
  /* [v3.7] pestaña © CRÉDITOS en todos los niveles (con o sin data-fit) */
  var s0 = scripts[0], ds0 = (s0 && s0.dataset) || {};
  initCredits(ds0.fit || null);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* ───────────────────────── API pública + ganchos QA ───────────────────────── */
W.QOL = {
  fitTitle: fitTitle,
  levelLinks: levelLinks,
  makeX2: makeX2,
  LEVELS: LEVELS,
  enterFs: enterFs,
  devWarn: {
    isVeteran: isVeteran,
    open: openDevWarn,
    hook: hookDev
  },
  credits: { open: openCredits, tab: function () { return credTab; } },
  tut: {
    hook: hook,
    seen: seen,
    reset: function (id) { try { localStorage.removeItem(LS_SEEN(id)); } catch (e) {} },
    open: function (id, onDone) { if (TEXTS[id]) { openAsk(id, TEXTS[id].name, onDone); } },
    texts: TEXTS
  }
};
/* gancho de QA: estado + render determinista (para capturas sin rAF real) */
W.__QOL = {
  state: function () {
    return {
      askOpen: !!(askEl && !askEl.classList.contains('hidden')),
      tutOpen: !!(tutEl && !tutEl.classList.contains('hidden')),
      idx: T.idx, total: T.slides.length, id: T.id,
      luck: T.luck,
      txt: txtEl ? txtEl.textContent : ''
    };
  },
  /* render determinista: fuerza el frame t del slide idx */
  showAt: function (idx, t, keepOpen) {
    buildDOM();
    T.id = T.id || 'n0';
    T.slides = (TEXTS[T.id] || {}).slides || [];
    T.idx = Math.max(0, Math.min(idx, T.slides.length - 1));
    T.open = true;
    render();
    tutEl.classList.remove('hidden');
    T.tclock = t || 0;
    draw();
    if (!keepOpen) { T.open = false; }
    return this.state();
  },
  open: function (id) { buildDOM(); T.id = id; T.slides = (TEXTS[id] || {}).slides || []; T.idx = 0; T.open = true; render(); tutEl.classList.remove('hidden'); T.tclock = 2.0; draw(); return this.state(); },
  /* [v3.8] aviso DEV — estado + render determinista de la diapositiva */
  dev: {
    state: function () {
      return {
        open: devVisible(),
        veteran: isVeteran(),
        holding: holding, holdDone: holdDone,
        holdLbl: holdLbl ? holdLbl.textContent : '',
        fillW: holdFill ? holdFill.style.width : '0',
        txt: devEl ? devEl.querySelector('#qolDevTxt').textContent : '',
        buttons: devEl ? Array.prototype.map.call(devEl.querySelectorAll('#qolDevBtns button'), function (b) { return b.textContent.trim(); }) : []
      };
    },
    show: function (t) {   /* render determinista de UN frame de la diapositiva */
      buildDevWarn();
      devDrawFrame(t || 1.5);
      return true;
    },
    setVeteran: function (v) { try { v ? localStorage.setItem(LS_VET, '1') : localStorage.removeItem(LS_VET); } catch (e) {} }
  }
};
})();
