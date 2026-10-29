// Slope mods: background, environment colour, weather, ball skins and light-trail skins.
// The game itself is a compiled Unity build, so this works from the outside:
//  - it hooks the WebGL calls the game makes, to recolour what it draws and add fog,
//  - it draws rain, snow, the ball's glow and sparks on a layer above the game,
//  - it reads your best score from the game's own save to unlock skins.
// Load this file BEFORE Unity's loader so the hooks are in place when the game starts.
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Choices. "best" is the best score needed to unlock a skin.
  // Colours are [r, g, b] from 0 to 1.
  // ---------------------------------------------------------------------------
  var ENVIRONMENTS = [
    { id: 'green', name: 'Classic', color: [0, 1, 0] },
    { id: 'cyan', name: 'Cyan', color: [0, 0.9, 1] },
    { id: 'blue', name: 'Blue', color: [0.2, 0.45, 1] },
    { id: 'purple', name: 'Purple', color: [0.65, 0.3, 1] },
    { id: 'pink', name: 'Pink', color: [1, 0.25, 0.75] },
    { id: 'orange', name: 'Orange', color: [1, 0.55, 0] },
    { id: 'yellow', name: 'Yellow', color: [1, 0.95, 0.1] },
    { id: 'white', name: 'White', color: [0.95, 0.95, 0.95] },
  ];

  // solid: the game's background colour. css: a picture behind the game instead.
  var BACKGROUNDS = [
    { id: 'black', name: 'Black', solid: [0, 0, 0] },
    { id: 'navy', name: 'Navy', solid: [0.02, 0.04, 0.14] },
    { id: 'wine', name: 'Wine', solid: [0.12, 0.02, 0.06] },
    { id: 'space', name: 'Space', css: 'radial-gradient(ellipse at 50% 30%, #1b1640 0%, #07061a 55%, #000 100%)', stars: true },
    { id: 'sunset', name: 'Sunset', css: 'linear-gradient(#1a0533 0%, #6b1159 38%, #ff6a3d 62%, #2a0a2e 63%, #05010a 100%)' },
    { id: 'synth', name: 'Synthwave', css: 'linear-gradient(#000 0%, #12002b 30%, #4b0a6e 52%, #ff2fa8 61%, #000 62%)', sun: true },
    { id: 'aurora', name: 'Aurora', css: 'linear-gradient(160deg, #001a14 0%, #003b3a 30%, #002a55 55%, #1b0035 80%, #000 100%)', aurora: true },
  ];

  var WEATHERS = [
    { id: 'clear', name: 'Clear' },
    { id: 'fog', name: 'Fog', fog: [0.55, 0.6, 0.65], density: 0.018 },
    { id: 'rain', name: 'Rain', fog: [0.08, 0.1, 0.13], density: 0.012, rain: 1 },
    { id: 'snow', name: 'Snow', fog: [0.75, 0.8, 0.88], density: 0.014, snow: 1 },
    { id: 'storm', name: 'Storm', fog: [0.03, 0.03, 0.06], density: 0.016, rain: 2, lightning: true },
  ];

  // pattern: drawn on the ball instead of the original grid. rainbow: colours cycle.
  var BALLS = [
    { id: 'classic', name: 'Classic', best: 0 },
    { id: 'ice', name: 'Ice', best: 3, color: [0.35, 0.9, 1] },
    { id: 'sun', name: 'Sun', best: 6, color: [1, 0.85, 0.1] },
    { id: 'bubblegum', name: 'Bubblegum', best: 10, color: [1, 0.35, 0.8] },
    { id: 'dots', name: 'Dots', best: 15, color: [0.4, 1, 0.4], pattern: 'dots' },
    { id: 'checker', name: 'Checker', best: 20, color: [1, 1, 1], pattern: 'checker' },
    { id: 'gold', name: 'Gold', best: 30, color: [1, 0.8, 0.25], fill: [0.25, 0.16, 0.02] },
    { id: 'tiger', name: 'Tiger', best: 40, color: [1, 0.5, 0], pattern: 'stripes' },
    { id: 'rainbow', name: 'Rainbow', best: 60, rainbow: 0.25 },
    { id: 'galaxy', name: 'Galaxy', best: 80, pattern: 'stars', rainbow: 0.08, fill: [0.06, 0.02, 0.12] },
    { id: 'plasma', name: 'Plasma', best: 100, pattern: 'checker', rainbow: 1.2 },
  ];

  var TRAILS = [
    { id: 'classic', name: 'Classic', best: 0 },
    { id: 'ice', name: 'Ice', best: 2, color: [0.3, 0.85, 1] },
    { id: 'fire', name: 'Fire', best: 5, color: [1, 0.45, 0.05] },
    { id: 'violet', name: 'Violet', best: 12, color: [0.7, 0.3, 1] },
    { id: 'light', name: 'Pure light', best: 18, color: [1, 1, 1] },
    { id: 'gold', name: 'Gold', best: 25, color: [1, 0.78, 0.2] },
    { id: 'rainbow', name: 'Rainbow', best: 45, rainbow: 0.3 },
    { id: 'plasma', name: 'Plasma', best: 70, rainbow: 1.5 },
  ];

  var KEY = 'slope-mods-v1';
  var settings = { env: 'green', bg: 'black', weather: 'clear', ball: 'classic', trail: 'classic', glow: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* storage blocked */ } }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].best > best ? list[0] : list[i];
    return list[0];
  }

  // best score seen so far, kept so unlocked skins work right away on the next visit
  var best = settings.best || 0;
  var startTime = performance.now();
  function now() { return (performance.now() - startTime) / 1000; }

  // ---------------------------------------------------------------------------
  // WebGL hooks
  // ---------------------------------------------------------------------------
  var FRAG_HEAD = [
    'uniform mediump float _mOn;',
    'uniform mediump vec3 _mTarget;',
    'uniform mediump vec3 _mFill;',
    'uniform mediump vec4 _mFog;',
    'uniform highp float _mFogD;',
    'uniform highp vec4 _mFx;',
    'mediump vec3 _mHue(highp float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }',
    'mediump vec4 _mApply(mediump vec4 c) {',
    '  if (_mOn < 0.5) return c;',
    // only the green part (green above red and blue) changes colour, so red, white and black stay as they are
    '  mediump float k = max(c.g - max(c.r, c.b), 0.0);',
    '  mediump vec3 target = _mFx.x > 0.0 ? _mHue(fract(gl_FragCoord.y * 0.0016 + gl_FragCoord.x * 0.0004 + _mFx.y)) : _mTarget;',
    '  mediump vec3 col = c.rgb + k * (target - vec3(0.0, 1.0, 0.0));',
    '  col += _mFill * (1.0 - clamp(k * 1.5, 0.0, 1.0));',
    '  col *= _mFx.z;',
    '  highp float f = _mFog.a * (1.0 - exp(-_mFogD / gl_FragCoord.w));',
    '  col = mix(col, _mFog.rgb, f);',
    '  return vec4(col, c.a);',
    '}',
  ].join('\n');

  function injectFragment(src) {
    if (src.indexOf('_mApply') >= 0 || !/void\s+main\s*\(\s*\)/.test(src)) return src;
    var out = null;
    var m = src.match(/out\s+(?:(?:highp|mediump|lowp)\s+)?vec4\s+(\w+)\s*;/);
    if (m) out = m[1];
    else if (src.indexOf('gl_FragColor') >= 0) out = 'gl_FragColor';
    else if (src.indexOf('gl_FragData[0]') >= 0) out = 'gl_FragData[0]';
    if (!out) return src;
    src = src.replace(/void\s+main\s*\(\s*\)/, 'void _mMain()');
    // put our helpers after the precision / version lines, before the shader's own code
    var lines = src.split('\n'), at = 0;
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*(#version|#extension|precision)\b/.test(lines[i])) at = i + 1;
    }
    lines.splice(at, 0, FRAG_HEAD);
    return lines.join('\n') + '\nvoid main() { _mMain(); ' + out + ' = _mApply(' + out + '); }\n';
  }


  var gl = null;
  var ballTex = {};
  var ballScreen = null; // where the ball was drawn this frame, for the glow
  var frameBall = null;
  var flash = 0; // lightning
  var transparentBg = false;

  function hookContext(ctx) {
    if (ctx.__mods) return ctx;
    ctx.__mods = true;
    gl = ctx;
    var shaderType = new WeakMap();
    var cur = null;

    var createShader = ctx.createShader.bind(ctx);
    ctx.createShader = function (type) { var s = createShader(type); if (s) shaderType.set(s, type); return s; };
    var shaderSource = ctx.shaderSource.bind(ctx);
    ctx.shaderSource = function (s, src) {
      var isFrag = shaderType.get(s) === ctx.FRAGMENT_SHADER;
      if (isFrag) {
        var mod = injectFragment(src);
        if (mod !== src) { s.__modsSrc = src; s.__modsInj = true; src = mod; }
        s.__ui = /_TextureSampleAdd/.test(src);
      }
      shaderSource(s, src);
    };
    var compileShader = ctx.compileShader.bind(ctx);
    ctx.compileShader = function (s) {
      compileShader(s);
      // if our change broke the shader, put the original back
      if (s.__modsInj && !ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
        console.warn('[mods] shader hook skipped:', ctx.getShaderInfoLog(s));
        s.__modsInj = false;
        shaderSource(s, s.__modsSrc);
        compileShader(s);
      }
    };
    var attachShader = ctx.attachShader.bind(ctx);
    ctx.attachShader = function (p, s) {
      if (shaderType.get(s) === ctx.FRAGMENT_SHADER) { p.__frag = s; }
      attachShader(p, s);
    };
    var linkProgram = ctx.linkProgram.bind(ctx);
    ctx.linkProgram = function (p) {
      linkProgram(p);
      var f = p.__frag;
      p.__u = null;
      p.__ui = !!(f && f.__ui);
      if (f && f.__modsInj) {
        var L = function (n) { return ctx.getUniformLocation(p, n); };
        p.__u = { on: L('_mOn'), target: L('_mTarget'), fill: L('_mFill'), fog: L('_mFog'), fogD: L('_mFogD'), fx: L('_mFx') };
        p.__tex = L('_MainTex');
        p.__o2w = L('hlslcc_mtx4x4unity_ObjectToWorld[0]') ? [0, 1, 2, 3].map(function (i) { return L('hlslcc_mtx4x4unity_ObjectToWorld[' + i + ']'); }) : null;
        p.__vp = L('hlslcc_mtx4x4unity_MatrixVP[0]') ? [0, 1, 2, 3].map(function (i) { return L('hlslcc_mtx4x4unity_MatrixVP[' + i + ']'); }) : null;
      }
    };
    var useProgram = ctx.useProgram.bind(ctx);
    ctx.useProgram = function (p) { cur = p; useProgram(p); };

    var clearColor = ctx.clearColor.bind(ctx);
    ctx.clearColor = function (r, g, b, a) {
      if (r < 0.01 && g < 0.01 && b < 0.01) {
        var c = backgroundColor();
        if (c) { clearColor(c[0], c[1], c[2], 1); return; }
        if (transparentBg) { clearColor(0, 0, 0, 0); return; }
      }
      clearColor(r, g, b, a);
    };

    // At the end of each frame the game fills the alpha channel with 1 so the page never shows through.
    // With a picture background we skip that, so the picture shows wherever nothing was drawn.
    var alphaOnly = false;
    var colorMask = ctx.colorMask.bind(ctx);
    ctx.colorMask = function (r, g, b, a) { alphaOnly = !r && !g && !b && a; colorMask(r, g, b, a); };
    var clear = ctx.clear.bind(ctx);
    ctx.clear = function (mask) {
      if (transparentBg && alphaOnly) mask &= ~ctx.COLOR_BUFFER_BIT;
      if (mask) clear(mask);
    };

    function apply(kind) {
      var u = cur && cur.__u;
      if (!u) return;
      var look = lookFor(kind);
      ctx.uniform1f(u.on, 1);
      ctx.uniform3fv(u.target, look.target);
      ctx.uniform3fv(u.fill, look.fill);
      ctx.uniform4fv(u.fog, look.fog);
      ctx.uniform1f(u.fogD, look.fogD);
      ctx.uniform4fv(u.fx, look.fx);
    }

    var drawElements = ctx.drawElements.bind(ctx);
    ctx.drawElements = function (mode, count, type, offset) {
      if (!cur || !cur.__u) return drawElements(mode, count, type, offset);
      var isBall = count === 2304 && !cur.__ui;
      if (cur.__ui) { apply('ui'); return drawElements(mode, count, type, offset); }
      if (!isBall) { apply('env'); return drawElements(mode, count, type, offset); }
      apply('ball');
      if (settings.glow) trackBall();
      var skin = find(BALLS, settings.ball);
      var tex = skin.pattern ? patternTexture(skin.pattern) : null;
      if (!tex || !cur.__tex) return drawElements(mode, count, type, offset);
      var unit = ctx.getUniform(cur, cur.__tex) | 0;
      var active = ctx.getParameter(ctx.ACTIVE_TEXTURE);
      ctx.activeTexture(ctx.TEXTURE0 + unit);
      var prev = ctx.getParameter(ctx.TEXTURE_BINDING_2D);
      ctx.bindTexture(ctx.TEXTURE_2D, tex);
      drawElements(mode, count, type, offset);
      ctx.bindTexture(ctx.TEXTURE_2D, prev);
      ctx.activeTexture(active);
    };
    var drawArrays = ctx.drawArrays.bind(ctx);
    ctx.drawArrays = function (mode, first, count) {
      if (cur && cur.__u) apply(cur.__ui ? 'ui' : mode === ctx.TRIANGLE_STRIP ? 'trail' : 'env');
      drawArrays(mode, first, count);
    };

    // where the ball is on screen, from the matrices the game uses to draw it
    function trackBall() {
      if (!cur.__o2w || !cur.__vp) return;
      var o = ctx.getUniform(cur, cur.__o2w[3]);
      var vp = cur.__vp.map(function (l) { return ctx.getUniform(cur, l); });
      var s = ctx.getUniform(cur, cur.__o2w[0]);
      function project(x, y, z) {
        var c = [0, 1, 2, 3].map(function (i) { return vp[0][i] * x + vp[1][i] * y + vp[2][i] * z + vp[3][i]; });
        return c[3] > 0.01 ? [c[0] / c[3], c[1] / c[3]] : null;
      }
      var a = project(o[0], o[1], o[2]);
      var r = Math.hypot(s[0], s[1], s[2]) * 0.5;
      var b = project(o[0] + r, o[1], o[2]);
      if (a && b) frameBall = { x: a[0], y: a[1], r: Math.hypot(b[0] - a[0], b[1] - a[1]) };
    }
    return ctx;
  }

  // Force the game's canvas to keep a transparent background so picture backgrounds show through
  var getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    var isGL = /webgl/.test(type);
    if (isGL && this.closest && this.closest('#gameContainer')) {
      attrs = Object.assign({}, attrs || {}, { alpha: true, premultipliedAlpha: true });
    }
    var ctx = getContext.call(this, type, attrs);
    if (ctx && isGL && this.closest && this.closest('#gameContainer')) hookContext(ctx);
    return ctx;
  };

  // ---------------------------------------------------------------------------
  // What each kind of draw should look like right now
  // ---------------------------------------------------------------------------
  var NOFILL = [0, 0, 0];
  function weather() { return find(WEATHERS, settings.weather); }
  function background() { return find(BACKGROUNDS, settings.bg); }
  function fogColor() {
    var w = weather();
    if (w.fog) return flash > 0 ? [0.8, 0.85, 1] : w.fog;
    var b = background();
    return b.solid || [0, 0, 0];
  }
  function backgroundColor() {
    var w = weather();
    if (w.fog) return fogColor();
    var b = background();
    if (b.solid) return b.solid;
    return null;
  }
  function lookFor(kind) {
    var w = weather(), t = now();
    var fogAmt = w.fog ? 1 : 0;
    var env = find(ENVIRONMENTS, settings.env);
    var bright = flash > 0 ? 1.6 : 1;
    if (kind === 'ui') return { target: env.color, fill: NOFILL, fog: [0, 0, 0, 0], fogD: 0, fx: [0, 0, 1, 0] };
    if (kind === 'env') return { target: env.color, fill: NOFILL, fog: fogColor().concat(fogAmt), fogD: w.density || 0, fx: [0, 0, bright, 0] };
    if (kind === 'ball') {
      var s = find(BALLS, settings.ball);
      return {
        target: s.color || env.color,
        fill: s.fill || NOFILL, fog: [0, 0, 0, 0], fogD: 0,
        fx: [s.rainbow ? 1 : 0, s.rainbow ? t * s.rainbow : 0, s.id === 'classic' ? 1 : 1.15, 0],
      };
    }
    // trail: additive light, so fog fades it to black and it gets a brightness boost
    var tr = find(TRAILS, settings.trail);
    return {
      target: tr.color || env.color,
      fill: NOFILL, fog: [0, 0, 0, fogAmt], fogD: (w.density || 0) * 0.5,
      fx: [tr.rainbow ? 1 : 0, tr.rainbow ? t * tr.rainbow : 0, 1.7, 0],
    };
  }

  // Tiling textures for patterned balls, drawn in green so the skin colour applies to them
  function patternTexture(name) {
    if (ballTex[name] !== undefined) return ballTex[name];
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = '#121212'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#00ff00';
    if (name === 'dots') { g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.fill(); }
    if (name === 'checker') { g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); }
    if (name === 'stripes') { for (var i = -64; i < 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 14, 0); g.lineTo(i + 14 + 64, 64); g.lineTo(i + 64, 64); g.fill(); } }
    if (name === 'stars') {
      g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#00ff00';
      [[10, 12, 3], [44, 8, 2], [30, 34, 4], [54, 46, 2], [14, 52, 2], [50, 26, 1.5], [24, 18, 1.5]].forEach(function (s) {
        g.beginPath(); g.arc(s[0], s[1], s[2], 0, Math.PI * 2); g.fill();
      });
    }
    var t = gl.createTexture();
    var prev = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, prev);
    ballTex[name] = t;
    return t;
  }

  // ---------------------------------------------------------------------------
  // Layers: a picture behind the game, and weather + ball glow in front of it
  // ---------------------------------------------------------------------------
  var back, fx, fxg, backg;
  var drops = [], sparks = [];
  function setupLayers() {
    back = document.createElement('canvas');
    back.id = 'mods-back';
    document.body.insertBefore(back, document.body.firstChild);
    backg = back.getContext('2d');
    fx = document.createElement('canvas');
    fx.id = 'mods-fx';
    document.body.appendChild(fx);
    fxg = fx.getContext('2d');
    window.addEventListener('resize', sizeLayers);
    sizeLayers();
    requestAnimationFrame(tick);
  }
  function sizeLayers() {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    [back, fx].forEach(function (c) { c.width = innerWidth * d; c.height = innerHeight * d; });
    fxg.setTransform(d, 0, 0, d, 0, 0);
    backg.setTransform(d, 0, 0, d, 0, 0);
    drawBack();
  }
  var stars = [];
  for (var i = 0; i < 220; i++) stars.push([Math.random(), Math.random() * 0.62, Math.random() * 1.4 + 0.3, Math.random() * 6]);
  function drawBack() {
    var b = background();
    transparentBg = !!b.css;
    document.documentElement.style.setProperty('--mods-back', b.css || 'none');
    back.hidden = !b.css;
  }
  function paintBackDetails(t) {
    var b = background(), W = innerWidth, H = innerHeight;
    if (!b.css) return;
    backg.clearRect(0, 0, W, H);
    if (b.stars || b.aurora) {
      stars.forEach(function (s) {
        var a = 0.45 + 0.55 * Math.sin(t * 1.3 + s[3]);
        backg.fillStyle = 'rgba(255,255,255,' + (a * 0.9).toFixed(2) + ')';
        backg.fillRect(s[0] * W, s[1] * H, s[2], s[2]);
      });
    }
    if (b.sun) {
      var cx = W / 2, cy = H * 0.5, r = Math.min(W, H) * 0.18;
      var gr = backg.createLinearGradient(0, cy - r, 0, cy + r);
      gr.addColorStop(0, '#ffe76a'); gr.addColorStop(1, '#ff2f8f');
      backg.save(); backg.beginPath(); backg.arc(cx, cy, r, Math.PI, 0); backg.closePath(); backg.clip();
      backg.fillStyle = gr; backg.fillRect(cx - r, cy - r, r * 2, r);
      backg.fillStyle = '#12002b';
      for (var k = 0; k < 6; k++) backg.fillRect(cx - r, cy - r * 0.08 - k * r * 0.14, r * 2, 2 + k * 0.6);
      backg.restore();
    }
    if (b.aurora) {
      for (var j = 0; j < 3; j++) {
        backg.beginPath();
        for (var x = 0; x <= W; x += 16) {
          var y = H * (0.18 + j * 0.07) + Math.sin(x * 0.006 + t * (0.4 + j * 0.15) + j) * H * 0.05;
          if (x === 0) backg.moveTo(x, y); else backg.lineTo(x, y);
        }
        backg.lineWidth = 26 - j * 6;
        backg.strokeStyle = ['rgba(60,255,170,0.18)', 'rgba(80,200,255,0.14)', 'rgba(190,90,255,0.12)'][j];
        backg.stroke();
      }
    }
  }

  var lastT = performance.now(), nextFlash = 4;
  function tick(ms) {
    var dt = Math.min(0.05, (ms - lastT) / 1000); lastT = ms;
    var t = now(), W = innerWidth, H = innerHeight;
    paintBackDetails(t);
    fxg.clearRect(0, 0, W, H);
    var w = weather();

    // lightning
    if (w.lightning) {
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 0.18; nextFlash = 3 + Math.random() * 6; }
    }
    if (flash > 0) {
      fxg.fillStyle = 'rgba(200,210,255,' + (flash * 2).toFixed(2) + ')';
      fxg.fillRect(0, 0, W, H);
      flash -= dt;
    }

    // rain and snow fall towards the camera
    var want = w.rain ? 140 * w.rain : w.snow ? 160 : 0;
    while (drops.length < want) drops.push(newDrop(true));
    if (drops.length > want) drops.length = want;
    fxg.lineCap = 'round';
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      if (w.rain) {
        d.y += d.v * dt * H; d.x += d.v * dt * H * 0.12;
        fxg.strokeStyle = 'rgba(170,200,255,' + d.a + ')';
        fxg.lineWidth = d.s;
        fxg.beginPath(); fxg.moveTo(d.x, d.y); fxg.lineTo(d.x - d.v * 0.012 * H, d.y - d.v * 0.09 * H); fxg.stroke();
      } else {
        d.y += d.v * dt * H * 0.25; d.x += Math.sin(t * 1.5 + d.p) * 20 * dt;
        fxg.fillStyle = 'rgba(255,255,255,' + d.a + ')';
        fxg.beginPath(); fxg.arc(d.x, d.y, d.s * 1.6, 0, Math.PI * 2); fxg.fill();
      }
      if (d.y > H + 20 || d.x > W + 40) drops[i] = newDrop(false);
    }

    // glow around the ball and sparks of light behind it, in the trail's colour
    var ball = frameBall; frameBall = null;
    if (ball && settings.glow) {
      var rect = canvasRect();
      var bx = rect.left + (ball.x * 0.5 + 0.5) * rect.width;
      var by = rect.top + (0.5 - ball.y * 0.5) * rect.height;
      var br = Math.max(6, ball.r * 0.5 * rect.height);
      var col = trailRGB(t);
      var css = function (a) { return 'rgba(' + col.map(function (v) { return Math.round(v * 255); }).join(',') + ',' + a + ')'; };
      fxg.globalCompositeOperation = 'lighter';
      var g = fxg.createRadialGradient(bx, by, br * 0.6, bx, by, br * 2.4);
      g.addColorStop(0, css(0.28)); g.addColorStop(1, css(0));
      fxg.fillStyle = g;
      fxg.fillRect(bx - br * 2.5, by - br * 2.5, br * 5, br * 5);
      if (ballScreen) {
        var moved = Math.hypot(bx - ballScreen.x, by - ballScreen.y);
        var n = Math.min(4, 1 + moved * 0.2);
        for (var k = 0; k < n; k++) {
          sparks.push({ x: bx + (Math.random() - 0.5) * br * 1.4, y: by + br * (0.4 + Math.random() * 0.6),
            vx: (Math.random() - 0.5) * 60 - (bx - ballScreen.x) * 4, vy: 40 + Math.random() * 120, life: 1, s: 1 + Math.random() * 2.2 });
        }
      }
      ballScreen = { x: bx, y: by };
      for (var j = sparks.length - 1; j >= 0; j--) {
        var s = sparks[j];
        s.life -= dt * 1.8;
        if (s.life <= 0) { sparks.splice(j, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt;
        fxg.fillStyle = css((s.life * 0.9).toFixed(2));
        fxg.beginPath(); fxg.arc(s.x, s.y, s.s * s.life + 0.4, 0, Math.PI * 2); fxg.fill();
      }
      if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
      fxg.globalCompositeOperation = 'source-over';
    } else {
      ballScreen = null;
      sparks.length = 0;
    }
    requestAnimationFrame(tick);
  }
  function newDrop(anywhere) {
    var W = innerWidth, H = innerHeight;
    return { x: Math.random() * (W + 80) - 80, y: anywhere ? Math.random() * H : -20 - Math.random() * 60,
      v: 0.9 + Math.random() * 0.8, s: 0.8 + Math.random() * 1.2, a: (0.25 + Math.random() * 0.45).toFixed(2), p: Math.random() * 6 };
  }
  function canvasRect() {
    var c = document.querySelector('#gameContainer canvas');
    return c ? c.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  }
  function hueRGB(h) {
    return [0, 4, 2].map(function (o) { return Math.min(1, Math.max(0, Math.abs(((h * 6 + o) % 6) - 3) - 1)); });
  }
  function trailRGB(t) {
    var tr = find(TRAILS, settings.trail);
    if (tr.rainbow) return hueRGB((t * tr.rainbow) % 1);
    return tr.color || find(ENVIRONMENTS, settings.env).color;
  }

  // ---------------------------------------------------------------------------
  // Best score, read from the game's save (Unity keeps it in IndexedDB)
  // ---------------------------------------------------------------------------
  var BEST_KEY = 'HighScoreSlope';
  function readBest() {
    return new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open('/idbfs'); } catch (e) { resolve(null); return; }
      req.onerror = function () { resolve(null); };
      req.onupgradeneeded = function () { req.transaction.abort(); resolve(null); };
      req.onsuccess = function () {
        var db = req.result, found = null;
        if (!db.objectStoreNames.contains('FILE_DATA')) { db.close(); resolve(null); return; }
        var cursor = db.transaction('FILE_DATA').objectStore('FILE_DATA').openCursor();
        cursor.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) { db.close(); resolve(found); return; }
          if (/\/PlayerPrefs$/.test(String(c.key)) && c.value && c.value.contents) {
            var v = parsePref(c.value.contents, BEST_KEY);
            if (v !== null) found = Math.max(found || 0, v);
          }
          c.continue();
        };
        cursor.onerror = function () { db.close(); resolve(found); };
      };
    });
  }
  // PlayerPrefs file: "UnityPrf" header, then [name length][name][type][value]; type 0xFE is a 4 byte integer
  function parsePref(bytes, key) {
    var u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var name = new TextEncoder().encode(key);
    for (var i = 0; i < u.length - name.length - 5; i++) {
      if (u[i] !== name.length) continue;
      var ok = true;
      for (var j = 0; j < name.length; j++) if (u[i + 1 + j] !== name[j]) { ok = false; break; }
      if (!ok) continue;
      var p = i + 1 + name.length;
      if (u[p] === 0xfe) return new DataView(u.buffer, u.byteOffset + p + 1, 4).getInt32(0, true);
      if (u[p] === 0xfd) return Math.floor(new DataView(u.buffer, u.byteOffset + p + 1, 4).getFloat32(0, true));
    }
    return null;
  }
  function pollBest() {
    readBest().then(function (v) {
      if (v !== null && v > best) {
        var before = best;
        best = v;
        settings.best = v;
        save();
        var unlocked = BALLS.concat(TRAILS).filter(function (s) { return s.best > before && s.best <= best; });
        if (unlocked.length && before > 0) toast('Unlocked: ' + unlocked.map(function (s) { return s.name; }).join(', '));
        renderMenu();
      }
    }).finally(function () { setTimeout(pollBest, 2500); });
  }

  // ---------------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------------
  var menu, button, toastEl, open = false;
  function setupMenu() {
    button = document.createElement('button');
    button.id = 'mods-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Customize');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
      '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.2" fill="#000"/><circle cx="15" cy="12" r="2.2" fill="#000"/><circle cx="7" cy="18" r="2.2" fill="#000"/></svg>';
    button.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    document.body.appendChild(button);

    menu = document.createElement('div');
    menu.id = 'mods-menu';
    menu.hidden = true;
    menu.addEventListener('click', onMenuClick);
    ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'keyup'].forEach(function (ev) {
      menu.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
    });
    document.body.appendChild(menu);

    toastEl = document.createElement('div');
    toastEl.id = 'mods-toast';
    toastEl.hidden = true;
    document.body.appendChild(toastEl);

    window.addEventListener('keydown', function (e) {
      if (e.code === 'KeyM') { toggle(); }
      else if (e.code === 'Escape' && open) { toggle(); }
    });
    renderMenu();
  }
  function toggle() {
    open = !open;
    menu.hidden = !open;
    var m = window.gameInstance && window.gameInstance.Module;
    try {
      if (m && m.pauseMainLoop && m.resumeMainLoop) { if (open) m.pauseMainLoop(); else m.resumeMainLoop(); }
    } catch (e) { /* the game keeps running */ }
    if (!open) { var c = document.querySelector('#gameContainer canvas'); if (c) c.focus(); }
  }
  function swatch(c) { return 'rgb(' + c.map(function (v) { return Math.round(v * 255); }).join(',') + ')'; }
  function section(title, group, list, render) {
    var h = '<section><h2>' + title + '</h2><div class="mods-grid">';
    list.forEach(function (item) {
      var locked = item.best > best;
      var on = find(list, settings[group]).id === item.id;
      h += '<button type="button" data-group="' + group + '" data-id="' + item.id + '"' +
        (locked ? ' disabled' : '') + ' class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '">' +
        '<span class="mods-chip">' + render(item) + '</span><span class="mods-name">' + item.name + '</span>' +
        (locked ? '<span class="mods-lock">BEST ' + item.best + '</span>' : '') + '</button>';
    });
    return h + '</div></section>';
  }
  function skinChip(item, isTrail) {
    if (item.rainbow) return '<i style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red)"></i>';
    var c = swatch(item.color || [0, 1, 0]);
    if (isTrail) return '<i style="background:linear-gradient(90deg,transparent,' + c + ')"></i>';
    var pat = item.pattern === 'checker' ? 'repeating-conic-gradient(' + c + ' 0 25%,#111 0 50%) 0 0/12px 12px'
      : item.pattern === 'dots' ? 'radial-gradient(' + c + ' 30%,#111 34%) 0 0/10px 10px'
        : item.pattern === 'stripes' ? 'repeating-linear-gradient(45deg,' + c + ' 0 4px,#111 4px 9px)'
          : item.pattern === 'stars' ? 'radial-gradient(#fff 1px,transparent 2px) 0 0/8px 8px,#1a0a33'
            : 'radial-gradient(circle at 35% 30%,#444,#0a0a0a 70%)';
    return '<i class="ball" style="background:' + pat + ';box-shadow:inset 0 0 0 2px ' + c + '"></i>';
  }
  function renderMenu() {
    if (!menu) return;
    var h = '<div class="mods-head"><h1>CUSTOMIZE</h1><button type="button" class="mods-close" data-close aria-label="Close">&times;</button></div>' +
      '<p class="mods-best">BEST SCORE <b>' + best + '</b><span>Beat your best to unlock more skins</span></p>';
    h += section('BALL', 'ball', BALLS, function (i) { return skinChip(i, false); });
    h += section('LIGHT TRAIL', 'trail', TRAILS, function (i) { return skinChip(i, true); });
    h += section('ENVIRONMENT', 'env', ENVIRONMENTS, function (i) { return '<i style="background:#090909;box-shadow:inset 0 0 0 3px ' + swatch(i.color) + '"></i>'; });
    h += section('BACKGROUND', 'bg', BACKGROUNDS, function (i) { return '<i style="background:' + (i.css || swatch(i.solid)) + '"></i>'; });
    h += section('WEATHER', 'weather', WEATHERS, function (i) { return '<i class="wx wx-' + i.id + '"></i>'; });
    h += '<label class="mods-toggle"><input type="checkbox" data-glow' + (settings.glow ? ' checked' : '') + '> Ball glow and sparks</label>';
    h += '<p class="mods-hint">Press M to open or close this menu. The game pauses while it is open.</p>';
    menu.innerHTML = h;
  }
  function onMenuClick(e) {
    if (e.target.closest('[data-close]')) { toggle(); return; }
    var glow = e.target.closest('[data-glow]');
    if (glow) { settings.glow = glow.checked; save(); return; }
    var b = e.target.closest('button[data-group]');
    if (!b || b.disabled) return;
    settings[b.dataset.group] = b.dataset.id;
    save();
    if (b.dataset.group === 'bg') drawBack();
    renderMenu();
  }
  var toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 4000);
  }

  function start() {
    setupLayers();
    setupMenu();
    pollBest();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.slopeMods = { settings: settings, get best() { return best; }, BALLS: BALLS, TRAILS: TRAILS };
})();
