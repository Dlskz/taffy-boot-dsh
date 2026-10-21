/* ============================================================
 * 永雏塔菲 × DeepSeek Harness 启动动画 —— 引擎
 *
 * 用法 A（注入 DSH 窗口）：由 injector.mjs 注入执行
 * 用法 B（独立预览）：demo/boot-preview.html 直接 <script> 引入
 *
 * 可配置项（在脚本之前定义 window.__TAFFY_BOOT_CONFIG__）：
 *   duration   {number} 主时间轴时长，默认 9000ms
 *   playOnce   {boolean} 每个窗口只播一次（sessionStorage），默认 true
 *   preview    {boolean} 预览模式：无图片时显示引导提示
 *   images     {string[]} 立绘图片地址（data:URL 或相对地址）
 *   lines      {string[]} 轮播台词
 *   easterLines{string[]} 点击彩蛋台词
 *   steps      {Array<[number,string]>} [毫秒, 状态文案]
 *   auto       {boolean} 是否自动播放，默认 true
 *
 * 全局接口：
 *   window.__TAFFY_BOOT__.skip()     跳过并淡出
 *   window.__TAFFY_BOOT__.destroy()  立即移除
 *   window.__TAFFY_BOOT_PLAY__()     重新播放（预览页用）
 * ============================================================ */
(function () {
  'use strict';

  if (window.__TAFFY_BOOT_LOADED__) return;
  window.__TAFFY_BOOT_LOADED__ = true;
  if (window.__TAFFY_BOOT_ACTIVE__) return;

  var DEFAULTS = {
    duration: 9000,
    playOnce: true,
    preview: false,
    auto: true,
    images: [],
    lines: [
      '关注永雏塔菲谢谢喵～',
      '塔菲最可爱了！',
      '呜呜…塔菲正在帮你启动 DSH',
      '今天是和塔菲一起写代码的日子喵！',
      '塔菲喜欢你！(๑•̀ㅂ•́)و✧',
      '启动完成！今天也要加油哦～'
    ],
    easterLines: [
      '戳戳塔菲…呜喵～',
      '再戳塔菲就要生气了哦（并不是）',
      '塔菲会一直陪着你写代码的！',
      '诶嘿～被塔菲发现你在偷看啦',
      '关注永雏塔菲，每天都是好心情喵！'
    ],
    steps: [
      [900, '检查运行环境…'],
      [2600, '加载 DSH 内核…'],
      [4600, '同步工作区…'],
      [6400, '唤醒塔菲中…'],
      [8200, '启动完成！']
    ]
  };

  var cfg = Object.assign({}, DEFAULTS, window.__TAFFY_BOOT_CONFIG__ || {});
  var images = (cfg.images && cfg.images.length ? cfg.images : window.TAFFY_BOOT_IMAGES || []).filter(Boolean);
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) cfg.duration = Math.min(cfg.duration, 2200);

  var root = null;
  var timers = [];
  var raf = 0;
  var alive = false;
  var listeners = [];
  var typedText = '';
  var clickCount = 0;
  var idleShown = false;
  var lastMove = Date.now();
  var imgEls = [];
  var imgTimer = 0;
  var mascotShown = false;

  /* ---------------- 工具 ---------------- */
  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  }
  function markPlayed() {
    try { sessionStorage.setItem('taffy-boot:played', '1'); } catch (e) { /* 无法写入时忽略 */ }
  }
  function hasPlayed() {
    try { return sessionStorage.getItem('taffy-boot:played') === '1'; } catch (e) { return false; }
  }
  function $sel(sel) { return root ? root.querySelector(sel) : null; }

  /* ---------------- 占位角色（无图片时的原创吉祥物） ---------------- */
  var MASCOT_SVG = [
    '<svg class="tb-mascot" viewBox="0 0 240 240" aria-hidden="true">',
    '<defs>',
    '<linearGradient id="tbBodyGrad" x1="0" y1="0" x2="0.4" y2="1">',
    '<stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#fff0f7"/><stop offset="1" stop-color="#ffd9e8"/>',
    '</linearGradient>',
    '<linearGradient id="tbEarGrad" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#ffd6e6"/><stop offset="1" stop-color="#ffa8c8"/>',
    '</linearGradient>',
    '<linearGradient id="tbBellyGrad" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="1" stop-color="#fff5fa" stop-opacity="0.7"/>',
    '</linearGradient>',
    '</defs>',
    '<ellipse cx="120" cy="214" rx="52" ry="9" fill="#d6588f" opacity="0.16"/>',
    /* 耳朵 */
    '<path d="M82 104 C73 78 72 58 80 50 C88 43 99 50 107 66 L116 88 Z" fill="url(#tbEarGrad)"/>',
    '<path d="M158 104 C167 78 168 58 160 50 C152 43 141 50 133 66 L124 88 Z" fill="url(#tbEarGrad)"/>',
    '<path d="M86 96 C80 78 80 64 85 59 C90 54 96 60 101 71 L106 84 Z" fill="#ff9ec4" opacity="0.75"/>',
    '<path d="M154 96 C160 78 160 64 155 59 C150 54 144 60 139 71 L134 84 Z" fill="#ff9ec4" opacity="0.75"/>',
    /* 呆毛 */
    '<path class="tb-ahoge" d="M120 100 C112 82 116 62 130 54 C120 58 112 70 113 84 C113 90 116 96 120 100 Z" fill="#ff7fae"/>',
    '<circle cx="131" cy="53" r="4.2" fill="#ff7fae"/>',
    /* 身体 */
    '<rect x="56" y="92" width="128" height="112" rx="54" fill="url(#tbBodyGrad)" stroke="#ffd0e2" stroke-width="1.5"/>',
    /* 肚皮 */
    '<ellipse cx="120" cy="172" rx="40" ry="26" fill="url(#tbBellyGrad)"/>',
    /* 眼睛（闭眼笑） */
    '<path class="tb-eye" d="M88 150 q11 -14 22 0" fill="none" stroke="#6b3550" stroke-width="5.5" stroke-linecap="round"/>',
    '<path class="tb-eye" d="M130 150 q11 -14 22 0" fill="none" stroke="#6b3550" stroke-width="5.5" stroke-linecap="round"/>',
    /* 腮红 */
    '<ellipse cx="78" cy="166" rx="11" ry="6" fill="#ffb0cb" opacity="0.8"/>',
    '<ellipse cx="162" cy="166" rx="11" ry="6" fill="#ffb0cb" opacity="0.8"/>',
    /* 嘴 */
    '<path d="M110 166 q5 7 10 0 q5 7 10 0" fill="none" stroke="#6b3550" stroke-width="4" stroke-linecap="round"/>',
    /* 爪子 */
    '<ellipse cx="64" cy="192" rx="12" ry="9" fill="#fff" stroke="#ffd0e2" stroke-width="1.5"/>',
    '<ellipse cx="176" cy="192" rx="12" ry="9" fill="#fff" stroke="#ffd0e2" stroke-width="1.5"/>',
    /* 蝴蝶结 */
    '<path class="tb-bow" d="M84 74 l-17 -9 v18 z" fill="#ff7fae"/>',
    '<path class="tb-bow" d="M84 74 l17 -9 v18 z" fill="#ff7fae"/>',
    '<circle cx="84" cy="74" r="4.6" fill="#ff5f9a"/>',
    /* 小闪光 */
    '<path d="M206 70 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 z" fill="#ffffff" opacity="0.9"/>',
    '<path d="M38 128 l1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 z" fill="#ffffff" opacity="0.75"/>',
    '</svg>'
  ].join('');

  /* ---------------- 粒子层 ---------------- */
  function startParticles(canvas) {
    if (reduced) return function () {};
    var ctx = canvas.getContext('2d');
    if (!ctx) return function () {};
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var COLORS = ['#ff9ec4', '#ff6f9f', '#ffc7dc', '#a7e2ff', '#ffe9a8', '#ffffff', '#d9b8ff'];
    var parts = [];
    var running = true;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makePart(initial) {
      var kind = pickKind();
      return {
        kind: kind,
        x: Math.random() * W,
        y: initial ? Math.random() * H : -30 - Math.random() * 80,
        r: (kind === 'dot' ? 1.6 : 3.2) + Math.random() * (kind === 'dot' ? 2.2 : 4.4),
        vy: 14 + Math.random() * 34,
        sway: 18 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 1.8,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        alpha: 0.35 + Math.random() * 0.5
      };
    }
    function pickKind() {
      var r = Math.random();
      if (r < 0.46) return 'heart';
      if (r < 0.72) return 'star';
      if (r < 0.88) return 'dot';
      return 'diamond';
    }
    function spawn() {
      var count = Math.round((W * H) / 60000);
      count = Math.max(18, Math.min(62, count));
      for (var i = 0; i < count; i++) parts.push(makePart(true));
    }

    var t0 = performance.now();
    function frame(now) {
      if (!running) return;
      var dt = Math.min((now - t0) / 1000, 0.05);
      t0 = now;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y += p.vy * dt;
        p.phase += dt * 1.3;
        p.rot += p.vrot * dt;
        var x = p.x + Math.sin(p.phase) * p.sway * 0.35;
        if (p.y > H + 40) {
          parts[i] = makePart(false);
          continue;
        }
        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        drawShape(ctx, p.kind, p.r);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    spawn();
    frame(performance.now());
    on(window, 'resize', function () { resize(); });

    var visHandler = function () {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; t0 = performance.now(); frame(performance.now()); }
    };
    on(document, 'visibilitychange', visHandler);

    return function stop() {
      running = false;
      cancelAnimationFrame(raf);
    };
  }

  function drawShape(ctx, kind, r) {
    if (kind === 'heart') {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.42);
      ctx.bezierCurveTo(0, 0, -r, -r * 0.05, -r, -r * 0.42);
      ctx.bezierCurveTo(-r, -r * 0.85, -r * 0.35, -r * 0.95, 0, -r * 0.5);
      ctx.bezierCurveTo(r * 0.35, -r * 0.95, r, -r * 0.85, r, -r * 0.42);
      ctx.bezierCurveTo(r, -r * 0.05, 0, 0, 0, r * 0.42);
      ctx.fill();
      return;
    }
    if (kind === 'star') {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var ang = (Math.PI / 5) * i - Math.PI / 2;
        var rad = i % 2 === 0 ? r : r * 0.42;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (kind === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.62, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.62, 0);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------------- 结构 ---------------- */
  function build(canvas) {
    var wrap = document.createElement('div');
    wrap.id = 'taffy-boot';
    wrap.className = 'taffy-boot';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', '永雏塔菲启动动画');
    wrap.innerHTML = [
      '<div class="tb-backdrop" aria-hidden="true"></div>',
      '<div class="tb-grain" aria-hidden="true"></div>',
      '<canvas class="tb-particles" aria-hidden="true"></canvas>',
      '<div class="tb-card" role="document">',
      '  <span class="tb-spark s1" aria-hidden="true"></span>',
      '  <span class="tb-spark s2" aria-hidden="true"></span>',
      '  <span class="tb-spark s3" aria-hidden="true"></span>',
      '  <span class="tb-spark s4" aria-hidden="true"></span>',
      '  <div class="tb-head">',
      '    <span class="tb-brand"><span class="tb-brand-dot"></span>DEEPSEEK HARNESS</span>',
      '    <span class="tb-x">×</span>',
      '    <span class="tb-tag">永雏塔菲</span>',
      '    <span class="tb-spacer"></span>',
      '    <span class="tb-hint">点击塔菲有惊喜 · Esc 跳过</span>',
      '  </div>',
      '  <div class="tb-body">',
      '    <div class="tb-stage" title="戳戳塔菲">',
      '      <div class="tb-photo"></div>',
      '      <div class="tb-stage-badge">TAFFY</div>',
      '    </div>',
      '    <div class="tb-side">',
      '      <div class="tb-bubble"><span class="tb-bubble-text"></span><span class="tb-caret"></span></div>',
      '      <div class="tb-name">永雏塔菲 <span class="tb-name-sub">/ TAFFY</span></div>',
      '      <div class="tb-progress">',
      '        <div class="tb-bar"><div class="tb-fill"></div><div class="tb-shine"></div></div>',
      '        <div class="tb-meta"><span class="tb-status">准备启动…</span><span class="tb-pct">0%</span></div>',
      '      </div>',
      '      <div class="tb-chips">',
      '        <span class="tb-chip">原生插件</span>',
      '        <span class="tb-chip">每次启动</span>',
      '        <span class="tb-chip">可跳过</span>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <button class="tb-skip" type="button">跳过 ▸</button>',
      '</div>'
    ].join('\n');
    var holder = document.body || document.documentElement;
    holder.appendChild(wrap);
    return wrap;
  }

  /* ---------------- 立绘 / 占位角色 ---------------- */
  function renderStage() {
    var photo = $sel('.tb-photo');
    if (!photo) return;
    if (!images.length) {
      photo.innerHTML = MASCOT_SVG;
      mascotShown = true;
      if (cfg.preview) {
        var hint = document.createElement('div');
        hint.className = 'tb-empty-hint';
        hint.innerHTML = '把塔菲图片放进 <code>backgrounds/</code> 文件夹再运行即可';
        $sel('.tb-stage').appendChild(hint);
      }
      return;
    }
    var loaded = 0;
    images.forEach(function (src, idx) {
      var img = new Image();
      img.decoding = 'async';
      img.alt = '永雏塔菲';
      img.draggable = false;
      img.addEventListener('load', function () {
        loaded++;
        if (idx === 0) img.classList.add('tb-active');
      });
      img.addEventListener('error', function () {
        img.remove();
        imgEls = imgEls.filter(function (x) { return x !== img; });
        if (!imgEls.length && !mascotShown) {
          photo.innerHTML = MASCOT_SVG;
          mascotShown = true;
        }
      });
      img.src = src;
      photo.appendChild(img);
      imgEls.push(img);
    });
    if (imgEls.length > 1) {
      var idx = 0;
      // 换图节奏：9 秒里每 1.8 秒换一张，一轮能看到 5～6 张
      var swapMs = Number(cfg.swapMs) > 0 ? Number(cfg.swapMs) : 1800;
      imgTimer = setInterval(function () {
        if (!alive) return;
        imgEls[idx].classList.remove('tb-active');
        idx = (idx + 1) % imgEls.length;
        imgEls[idx].classList.add('tb-active');
      }, swapMs);
    }
  }

  /* ---------------- 台词 ---------------- */
  function typeStart(text, speed, done) {
    var bubble = $sel('.tb-bubble-text');
    if (!bubble) return;
    typedText = '';
    bubble.textContent = '';
    var i = 0;
    var timer = 0;
    function step() {
      i += 1;
      typedText = text.slice(0, i);
      bubble.textContent = typedText;
      if (i < text.length) {
        timer = later(step, speed);
      } else if (done) {
        done();
      }
    }
    step();
  }

  function say(text) {
    var bubble = $sel('.tb-bubble-text');
    if (!bubble) return;
    typedText = text;
    bubble.textContent = text;
  }

  /* ---------------- 进度 ---------------- */
  function startProgress() {
    var fill = $sel('.tb-fill');
    var pct = $sel('.tb-pct');
    var status = $sel('.tb-status');
    if (!fill || !pct) return function () {};
    var t0 = performance.now();
    var lastStep = -1;

    function frame(now) {
      if (!alive) return;
      var p = Math.min((now - t0) / cfg.duration, 1);
      if (p < 1) {
        // easeOutCubic：进度条前快后慢，接近完成时更"稳"
        var eased = 1 - Math.pow(1 - p, 3);
        var val = Math.round(eased * 96);
        fill.style.width = val + '%';
        pct.textContent = val + '%';
        raf = requestAnimationFrame(frame);
      } else {
        fill.style.width = '100%';
        pct.textContent = '100%';
        if (status) status.textContent = '启动完成！';
      }
    }
    raf = requestAnimationFrame(frame);
    return function () {
      cancelAnimationFrame(raf);
      if (status) status.textContent = '启动完成！';
      fill.style.width = '100%';
      pct.textContent = '100%';
    };
  }

  /* ---------------- 彩蛋 ---------------- */
  function burstHearts(x, y) {
    var stage = $sel('.tb-stage');
    if (!stage) return;
    for (var i = 0; i < 7; i++) {
      var h = document.createElement('span');
      h.className = 'tb-heart';
      var dx = (Math.random() - 0.5) * 90;
      h.style.left = (x || stage.clientWidth / 2) + 'px';
      h.style.top = (y || stage.clientHeight * 0.42) + 'px';
      h.style.setProperty('--tb-dx', dx.toFixed(1) + 'px');
      h.style.animationDelay = (i * 26) + 'ms';
      h.style.width = h.style.height = (11 + Math.random() * 10).toFixed(1) + 'px';
      stage.appendChild(h);
      (function (node) {
        setTimeout(function () { node.remove(); }, 1500);
      })(h);
    }
  }

  function easterClick(ev) {
    var stage = $sel('.tb-stage');
    if (!stage) return;
    var rect = stage.getBoundingClientRect();
    burstHearts(ev.clientX - rect.left, ev.clientY - rect.top);
    stage.classList.remove('tb-bonk');
    void stage.offsetWidth;
    stage.classList.add('tb-bonk');
    clickCount++;
    if (clickCount === 4) {
      say('呜喵！塔菲要被戳晕啦…');
    } else if (clickCount === 7) {
      say('再戳…塔菲就…晕了…(x_x)');
      clickCount = 0;
    } else if (clickCount !== 4) {
      var pool = cfg.easterLines && cfg.easterLines.length ? cfg.easterLines : DEFAULTS.easterLines;
      say(pool[(Math.random() * pool.length) | 0]);
    }
  }

  function watchIdle() {
    on(window, 'mousemove', function () { lastMove = Date.now(); });
    on(window, 'keydown', function () { lastMove = Date.now(); });
    var check = setInterval(function () {
      if (!alive) return clearInterval(check);
      if (!idleShown && Date.now() - lastMove > 6000) {
        idleShown = true;
        say('塔菲在等你哦～');
      }
    }, 900);
    timers.push(check);
  }

  /* ---------------- 生命周期 ---------------- */
  function destroy() {
    alive = false;
    timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
    timers = [];
    cancelAnimationFrame(raf);
    if (imgTimer) clearInterval(imgTimer);
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    listeners = [];
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    // 插件场景：移除首屏遮罩与页面锁定
    var veil = document.getElementById('dsh-taffy-veil');
    if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    document.documentElement.classList.remove('dtb-lock');
    window.__TAFFY_BOOT_ACTIVE__ = false;
    try {
      window.dispatchEvent(new CustomEvent('taffy-boot:done'));
    } catch (e) { /* ignore */ }
  }

  function fadeOut(after) {
    if (!root) return;
    root.classList.add('tb-out');
    if (!root.classList.contains('tb-in')) {
      // 还没进入就要求退出（隐藏标签/快速跳过）
    }
    later(function () {
      if (typeof after === 'function') after();
      destroy();
    }, 620);
  }

  function skip() {
    if (!root) return;
    var hint = $sel('.tb-hint');
    if (hint) hint.textContent = '已跳过';
    fadeOut();
  }

  function finish() {
    var done = false;
    function go() {
      if (done) return;
      done = true;
      fadeOut();
    }
    // 揭幕前等应用真正挂载：插件场景下 React 应用晚于 readyState 就绪
    var start = performance.now();
    var budget = cfg.waitApp ? 4200 : 2600;
    (function waitReady() {
      if (!alive) return;
      var elapsed = performance.now() - start;
      var ready;
      if (cfg.waitApp) {
        var mount = document.getElementById('root');
        ready = (mount && mount.childElementCount > 0) || (document.body && document.body.childElementCount > 2);
      } else {
        ready = document.readyState === 'complete';
      }
      if (ready || elapsed > budget) go();
      else later(waitReady, 120);
    })();
    later(function () { go(); }, budget + 400);
  }

  function run() {
    if (alive) return;
    alive = true;
    window.__TAFFY_BOOT_ACTIVE__ = true;
    root = build();

    // 多图时随机打散，每次启动看到的塔菲不重样
    if (images.length > 1) {
      images = images.slice().sort(function () { return Math.random() - 0.5; });
    }

    var stopParticles = startParticles(root.querySelector('.tb-particles'));
    var stopProgress = startProgress();
    renderStage();

    // 入场
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (root) root.classList.add('tb-in');
      });
    });

    // 逐句台词：首句打字完成后再按节奏轮换
    var lineIdx = 0;
    var linesStopped = false;
    var linePool = cfg.lines && cfg.lines.length ? cfg.lines : DEFAULTS.lines;
    function nextLine() {
      if (!alive || linesStopped) return;
      var text = linePool[lineIdx % linePool.length];
      lineIdx++;
      typeStart(text, 46, function () {
        if (!alive || linesStopped) return;
        later(nextLine, 1700);
      });
    }
    later(nextLine, 520);

    // 状态文案
    cfg.steps.forEach(function (s) {
      later(function () {
        if (!alive) return;
        var status = $sel('.tb-status');
        if (status) status.textContent = s[1];
      }, s[0]);
    });

    // 收尾
    later(function () {
      if (!alive) return;
      linesStopped = true;
      stopProgress();
      say('启动完成！塔菲最可爱了～');
      burstHearts(0, 0);
    }, cfg.duration - 260);
    later(finish, cfg.duration + 240);

    // 安全兜底：最长 16 秒必须消失
    later(function () {
      if (alive) fadeOut();
    }, 16000);

    // 交互
    on($sel('.tb-stage'), 'click', easterClick);
    on($sel('.tb-skip'), 'click', skip);
    on(window, 'keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        skip();
      }
    }, true);
    watchIdle();

    // 清理粒子
    var oldDestroy = destroy;
    destroy = function () {
      try { stopParticles(); } catch (e) { /* ignore */ }
      try { stopProgress(); } catch (e) { /* ignore */ }
      oldDestroy();
    };
  }

  // 对外接口
  window.__TAFFY_BOOT__ = {
    skip: function () { skip(); },
    destroy: function () { destroy(); },
    playing: function () { return alive; }
  };
  window.__TAFFY_BOOT_PLAY__ = function () {
    if (alive) return;
    run();
  };

  // 自动播放
  if (!cfg.auto) return;
  if (cfg.playOnce) {
    if (hasPlayed()) return;
    markPlayed();
  }
  if (document.visibilityState === 'hidden') return;
  run();
})();
