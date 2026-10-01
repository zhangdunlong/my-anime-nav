/**
 * IP 工具箱 — 浏览器环境检测 / 指纹 / 自动化特征 / WebRTC 泄漏
 * 配套 ip.html 使用
 *
 * 说明：全部计算在本机完成，任何指纹结果都不会上传到服务器。
 */
(function () {
  'use strict';

  var A = window.IPApp;
  if (!A) return;
  var esc = A.esc, $ = A.$, setHtml = A.setHtml, setText = A.setText;

  // ══════════════════ 哈希（cyrb53）══════════════════

  function hash53(str, seed) {
    seed = seed || 0;
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(13, '0');
  }

  /**
   * 渲染键值表
   * 行格式：[标签, 值, 是否等宽字体] 或 ['__html__', 标签, 原始 HTML]
   */
  function kv(rows) {
    return rows.map(function (r) {
      if (r[0] === '__html__') return '<tr><th>' + esc(r[1]) + '</th><td>' + r[2] + '</td></tr>';
      var cls = r[2] ? ' class="mono"' : '';
      var v = (r[1] === null || r[1] === undefined || r[1] === '') ? '—' : r[1];
      return '<tr><th>' + esc(r[0]) + '</th><td' + cls + '>' + esc(v) + '</td></tr>';
    }).join('');
  }

  function badge(level, text) {
    return '<span class="badge ' + level + '">' + esc(text) + '</span>';
  }

  // ══════════════════ 环境信息 ══════════════════

  function collectEnv() {
    var n = navigator, s = screen, w = window;
    var env = {};

    env.ua = n.userAgent || '';
    env.platform = n.platform || '';
    env.vendor = n.vendor || '';
    env.language = n.language || '';
    env.languages = (n.languages || []).join(', ');
    env.timezone = safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, '');
    env.utcOffset = -(new Date().getTimezoneOffset() / 60);
    env.hardwareConcurrency = n.hardwareConcurrency || '';
    env.deviceMemory = n.deviceMemory || '';
    env.maxTouchPoints = n.maxTouchPoints === undefined ? '' : n.maxTouchPoints;
    env.cookieEnabled = n.cookieEnabled ? '是' : '否';
    env.doNotTrack = n.doNotTrack || w.doNotTrack || '未设置';
    env.pdfViewerEnabled = n.pdfViewerEnabled === undefined ? '' : (n.pdfViewerEnabled ? '是' : '否');
    env.onLine = n.onLine ? '在线' : '离线';
    env.connection = safe(function () {
      var c = n.connection || n.mozConnection || n.webkitConnection;
      if (!c) return '';
      return (c.effectiveType || '') + (c.downlink ? ' · ' + c.downlink + ' Mbps' : '') + (c.rtt ? ' · RTT ' + c.rtt + 'ms' : '');
    }, '');

    env.screenRes = s.width + ' × ' + s.height;
    env.availRes = s.availWidth + ' × ' + s.availHeight;
    env.viewport = w.innerWidth + ' × ' + w.innerHeight;
    env.outerWindow = w.outerWidth + ' × ' + w.outerHeight;
    env.dpr = w.devicePixelRatio;
    env.colorDepth = s.colorDepth + ' bit';
    env.pixelDepth = s.pixelDepth + ' bit';
    env.orientation = safe(function () { return s.orientation && s.orientation.type; }, '');
    env.colorGamut = safe(function () { return matchMedia('(color-gamut: p3)').matches ? 'P3' : (matchMedia('(color-gamut: srgb)').matches ? 'sRGB' : '未知'); }, '');
    env.windowState = (w.outerWidth === w.innerWidth && w.outerHeight === w.innerHeight) ? '全屏 / 无边框' : '窗口化';

    env.userAgentData = safe(function () {
      var uad = n.userAgentData;
      if (!uad) return '';
      return (uad.brands || []).map(function (b) { return b.brand + ' ' + b.version; }).join(', ') +
        ' · 移动端:' + (uad.mobile ? '是' : '否') + ' · 平台:' + (uad.platform || '');
    }, '');

    env.storage = safe(function () {
      return 'localStorage ' + (w.localStorage ? '可用' : '不可用') +
        ' · sessionStorage ' + (w.sessionStorage ? '可用' : '不可用') +
        ' · IndexedDB ' + (w.indexedDB ? '可用' : '不可用');
    }, '');

    env.webgpu = safe(function () { return n.gpu ? '支持' : '不支持'; }, '');
    env.serviceWorker = safe(function () { return n.serviceWorker ? '支持' : '不支持'; }, '');

    return env;
  }

  function safe(fn, fallback) {
    try { var v = fn(); return v === undefined || v === null ? fallback : v; }
    catch (e) { return fallback; }
  }

  function renderEnv(env) {
    setHtml('envTable', kv([
      ['User-Agent', env.ua ? env.ua.slice(0, 180) : '—', 1],
      ['Client Hints', env.userAgentData || '（浏览器未提供）', 1],
      ['平台', env.platform || '—', 1],
      ['渲染引擎厂商', env.vendor || '—'],
      ['浏览器语言', env.language || '—'],
      ['语言偏好', env.languages || '—', 1],
      ['时区', (env.timezone || '—') + '  (UTC' + (env.utcOffset >= 0 ? '+' : '') + env.utcOffset + ')', 1],
      ['CPU 逻辑核心', env.hardwareConcurrency || '—'],
      ['设备内存', env.deviceMemory ? env.deviceMemory + ' GB' : '—'],
      ['触控点数', env.maxTouchPoints === '' ? '—' : String(env.maxTouchPoints)],
      ['屏幕分辨率', env.screenRes + '  (可用 ' + env.availRes + ')', 1],
      ['浏览器视口', env.viewport + '  ·  窗口 ' + env.outerWindow, 1],
      ['设备像素比', String(env.dpr)],
      ['色彩深度', env.colorDepth],
      ['色域', env.colorGamut],
      ['屏幕方向', env.orientation || '—'],
      ['Cookie', env.cookieEnabled],
      ['本地存储', env.storage || '—', 1],
      ['网络状态', env.onLine + (env.connection ? ' · ' + env.connection : ''), 1],
      ['Do Not Track', env.doNotTrack, 1],
      ['内置 PDF 阅读器', env.pdfViewerEnabled],
      ['WebGPU', env.webgpu],
      ['Service Worker', env.serviceWorker],
    ]));
  }

  // ══════════════════ 一致性校验 ══════════════════

  function checkConsistency() {
    var n = navigator, s = screen, w = window;
    var out = [];

    function item(level, title, detail) {
      out.push({ level: level, title: title, detail: detail });
    }

    // 1. 时区自洽
    var tzName = safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, '');
    var offsetHours = -new Date().getTimezoneOffset() / 60;
    var tzOffsetFromName = safe(function () {
      if (!tzName) return null;
      var now = new Date();
      var dtf = new Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'shortOffset' });
      var parts = dtf.formatToParts(now);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'timeZoneName') {
          var m = parts[i].value.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
          if (m) return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 60 : 0));
        }
      }
      return null;
    }, null);

    if (tzName && tzOffsetFromName !== null) {
      if (Math.abs(tzOffsetFromName - offsetHours) < 0.02) {
        item('good', '时区自洽', '时区名称 ' + tzName + ' 与系统 UTC 偏移 UTC' + (offsetHours >= 0 ? '+' : '') + offsetHours + ' 一致。');
      } else {
        item('bad', '时区不一致', '时区名称 ' + tzName + ' 对应 UTC' + (tzOffsetFromName >= 0 ? '+' : '') + tzOffsetFromName +
          '，但系统实际偏移为 UTC' + (offsetHours >= 0 ? '+' : '') + offsetHours + '。这是典型的时区伪装特征。');
      }
    } else {
      item('neutral', '时区检测', '未能取得时区名称，跳过校验。');
    }

    // 2. 语言自洽
    var langs = n.languages || [];
    if (langs.length && n.language) {
      if (langs.indexOf(n.language) >= 0) {
        item('good', '语言自洽', '主语言 ' + n.language + ' 存在于语言偏好列表中（' + langs.join(', ') + '）。');
      } else {
        item('bad', '语言不一致', '主语言 ' + n.language + ' 不在语言偏好列表 ' + langs.join(', ') + ' 中。');
      }
    } else if (!langs.length) {
      item('warn', '语言列表为空', 'navigator.languages 为空，正常浏览器通常不会出现。');
    }

    // 3. 平台 / UA 自洽
    var ua = n.userAgent || '';
    var plat = n.platform || '';
    var uaOs = /Windows/.test(ua) ? 'Windows' : (/Macintosh|Mac OS X/.test(ua) ? 'macOS' :
      (/Android/.test(ua) ? 'Android' : (/iPhone|iPad|iPod/.test(ua) ? 'iOS' : (/Linux/.test(ua) ? 'Linux' : '未知'))));
    var platOs = /Win/.test(plat) ? 'Windows' : (/Mac/.test(plat) ? 'macOS' :
      (/Android/.test(plat) ? 'Android' : (/Linux/.test(plat) ? 'Linux' : (/iPhone|iPad/.test(plat) ? 'iOS' : plat))));

    if (uaOs === '未知' || platOs === plat) {
      item('good', '平台自洽', 'navigator.platform 为「' + plat + '」，与 UA 中的系统标识一致。');
    } else if (platOs === uaOs || (platOs === 'Windows' && uaOs === 'Windows')) {
      item('good', '平台自洽', 'platform「' + plat + '」与 UA 系统「' + uaOs + '」一致。');
    } else {
      item('warn', '平台可能不一致', 'platform 显示「' + plat + '」（推断 ' + platOs + '），UA 显示「' + uaOs + '」。可能是伪装或 User-Agent 覆盖。');
    }

    // 4. Client Hints 与 UA 自洽
    var uad = n.userAgentData;
    if (uad && uad.platform) {
      var hintOs = uad.platform;
      var uaShort = uaOs === 'macOS' ? 'macOS' : uaOs;
      var hintShort = hintOs === 'Windows' ? 'Windows' : hintOs;
      if (hintShort === uaShort || (hintShort === 'macOS' && uaShort === 'macOS') || (hintShort === 'Windows' && uaShort === 'Windows')) {
        item('good', 'Client Hints 自洽', 'UA-CH 平台「' + hintOs + '」与 UA 字符串一致。');
      } else {
        item('bad', 'Client Hints 不一致', 'UA-CH 报告平台为「' + hintOs + '」，但 UA 字符串显示「' + uaOs + '」。这是伪装环境的高危特征。');
      }
    } else {
      item('neutral', 'Client Hints', '浏览器未提供 userAgentData，无法比对（Firefox / Safari 属正常）。');
    }

    // 5. 屏幕与视口合理性
    if (w.outerWidth === 0 || w.outerHeight === 0) {
      item('bad', '窗口尺寸异常', 'window.outerWidth/outerHeight 为 0，这是无头浏览器的典型特征。');
    } else if (w.innerWidth > s.availWidth || w.innerHeight > s.availHeight) {
      item('warn', '视口超出可用屏幕', '视口 ' + w.innerWidth + '×' + w.innerHeight + ' 大于可用屏幕 ' + s.availWidth + '×' + s.availHeight + '。');
    } else {
      item('good', '屏幕尺寸合理', '视口 ' + w.innerWidth + '×' + w.innerHeight + ' 位于可用屏幕 ' + s.availWidth + '×' + s.availHeight + ' 范围内。');
    }

    // 6. 触屏能力自洽
    var mtp = n.maxTouchPoints || 0;
    var hasTouchEvt = ('ontouchstart' in w) || (n.maxTouchPoints > 0);
    if ((mtp > 0) === hasTouchEvt) {
      item('good', '触屏能力自洽', mtp > 0 ? '报告 ' + mtp + ' 个触控点，并支持触控事件。' : '未报告触控点，与不支持触控事件一致。');
    } else {
      item('warn', '触屏能力不一致', 'maxTouchPoints = ' + mtp + '，但触控事件支持情况为 ' + (hasTouchEvt ? '支持' : '不支持') + '。');
    }

    // 7. 硬件合理性
    var cores = n.hardwareConcurrency || 0;
    if (cores === 0) {
      item('warn', 'CPU 核心数异常', 'hardwareConcurrency 返回 0 或未定义。');
    } else if (cores > 128) {
      item('warn', 'CPU 核心数异常', 'hardwareConcurrency 返回 ' + cores + '，远超常见设备范围。');
    } else {
      item('good', '硬件信息合理', '检测到 ' + cores + ' 个逻辑核心' + (n.deviceMemory ? '、' + n.deviceMemory + ' GB 内存' : '') + '。');
    }

    // 8. WebGL 渲染器与平台匹配
    var gl = getWebGLInfo();
    if (gl && gl.renderer && uaOs !== '未知') {
      var r = gl.renderer.toLowerCase();
      var mismatch = false;
      if (uaOs === 'Windows' && /linux|mesa|swiftshader/.test(r) && !/direct3d|d3d|angle/.test(r)) mismatch = true;
      if (uaOs === 'macOS' && /direct3d|d3d11/.test(r)) mismatch = true;
      if (/swiftshader|llvmpipe|software/.test(r)) {
        item('warn', 'WebGL 使用软件渲染', '渲染器为「' + gl.renderer + '」，通常出现在虚拟机、无头浏览器或禁用 GPU 的环境中。');
      } else if (mismatch) {
        item('bad', 'WebGL 与系统不匹配', 'UA 显示 ' + uaOs + '，但 WebGL 渲染器为「' + gl.renderer + '」。');
      } else {
        item('good', 'WebGL 与系统匹配', '渲染器「' + gl.renderer + '」符合 ' + uaOs + ' 环境特征。');
      }
    } else {
      item('neutral', 'WebGL 检测', '无法获取 WebGL 渲染器信息。');
    }

    return out;
  }

  function renderConsistency(list) {
    var html = list.map(function (c) {
      var icon = { good: '✅', warn: '⚠️', bad: '❌', neutral: '➖' }[c.level] || '➖';
      return '<div class="alert ' + (c.level === 'good' ? 'ok' : (c.level === 'warn' ? 'warn' : (c.level === 'bad' ? 'bad' : 'info'))) +
        '" style="margin-bottom:8px;"><b>' + icon + ' ' + esc(c.title) + '</b><br>' + esc(c.detail) + '</div>';
    }).join('');
    setHtml('consistencyList', html || '<div class="alert info">暂无可校验项。</div>');
  }

  // ══════════════════ 指纹 ══════════════════

  function getWebGLInfo() {
    return safe(function () {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return null;
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var info = {
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxViewport: (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || []).join('x'),
        extensions: (gl.getSupportedExtensions() || []).length,
      };
      return info;
    }, null);
  }

  function canvasFingerprint() {
    return safe(function () {
      var c = document.createElement('canvas');
      c.width = 260; c.height = 60;
      var ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 120, 22);
      ctx.fillStyle = '#069';
      ctx.fillText('IP工具箱 🌸 fingerprint', 2, 4);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('IP工具箱 🌸 fingerprint', 4, 18);

      // 渐变与曲线，增加区分度
      var grad = ctx.createLinearGradient(0, 0, 260, 0);
      grad.addColorStop(0, 'rgba(236,72,153,0.6)');
      grad.addColorStop(1, 'rgba(168,85,247,0.6)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(200, 30, 22, 0, Math.PI * 2);
      ctx.fill();

      return c.toDataURL();
    }, '');
  }

  async function audioFingerprint() {
    try {
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return '';
      var ctx = new OAC(1, 44100, 44100);
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 10000;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -50;
      comp.knee.value = 40;
      comp.ratio.value = 12;
      comp.attack.value = 0;
      comp.release.value = 0.25;
      osc.connect(comp);
      comp.connect(ctx.destination);
      osc.start(0);
      var buffer = await ctx.startRendering();
      var data = buffer.getChannelData(0);
      var sum = 0;
      for (var i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
      return sum.toFixed(8);
    } catch (e) {
      return '';
    }
  }

  var FONT_LIST = [
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New',
    'Georgia', 'Helvetica', 'Impact', 'Lucida Console', 'Microsoft YaHei', 'Microsoft JhengHei',
    'Palatino Linotype', 'Segoe UI', 'SimHei', 'SimSun', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana', 'Wingdings', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC',
    'Roboto', 'Ubuntu', 'Menlo', 'Monaco',
  ];

  function detectFonts() {
    var baseFonts = ['monospace', 'sans-serif', 'serif'];
    var testString = 'mmmmmmmmmmlli';
    var testSize = '72px';
    var span = document.createElement('span');
    span.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:' + testSize + ';';
    span.textContent = testString;
    document.body.appendChild(span);

    var baseline = {};
    baseFonts.forEach(function (b) {
      span.style.fontFamily = b;
      baseline[b] = span.offsetWidth + 'x' + span.offsetHeight;
    });

    var detected = [];
    FONT_LIST.forEach(function (font) {
      var found = false;
      for (var i = 0; i < baseFonts.length; i++) {
        span.style.fontFamily = '"' + font + '",' + baseFonts[i];
        if ((span.offsetWidth + 'x' + span.offsetHeight) !== baseline[baseFonts[i]]) { found = true; break; }
      }
      if (found) detected.push(font);
    });

    document.body.removeChild(span);
    return detected;
  }

  function renderFingerprint(fp) {
    var rows = [
      ['Canvas 指纹', fp.canvas ? fp.canvas : '（不可用）', 1],
      ['Canvas Hash', fp.canvasHash || '—', 1],
      ['WebGL 厂商', (fp.gl && fp.gl.vendor) || '—', 1],
      ['WebGL 渲染器', (fp.gl && fp.gl.renderer) || '—', 1],
      ['WebGL 版本', (fp.gl && fp.gl.version) || '—'],
      ['GLSL 版本', (fp.gl && fp.gl.glsl) || '—', 1],
      ['最大纹理尺寸', (fp.gl && fp.gl.maxTexture) || '—'],
      ['最大视口', (fp.gl && fp.gl.maxViewport) || '—'],
      ['WebGL 扩展数', (fp.gl && fp.gl.extensions) || '—'],
      ['Audio 指纹', fp.audio ? fp.audio : '（不可用）', 1],
      ['字体指纹 Hash', fp.fontHash || '—', 1],
      ['已安装字体数', String(fp.fonts.length)],
      ['检测到的字体', fp.fonts.join(', ') || '—', 1],
      ['综合设备指纹', fp.composite || '—', 1],
    ];
    setHtml('fpTable', kv(rows));
  }

  // ══════════════════ 自动化特征 ══════════════════

  function detectAutomation() {
    var n = navigator, w = window, d = document;
    var out = [];

    function add(level, title, detail) { out.push({ level: level, title: title, detail: detail }); }

    // webdriver
    if (n.webdriver === true) add('bad', 'navigator.webdriver 为 true', '这是最直接的自动化标志，Selenium / Puppeteer / Playwright 默认会暴露该属性。');
    else add('good', 'navigator.webdriver 未置位', 'navigator.webdriver 为 false 或 undefined，未暴露标准自动化标志。');

    // HeadlessChrome
    if (/HeadlessChrome/i.test(n.userAgent)) add('bad', 'UA 中出现 HeadlessChrome', 'User-Agent 字符串直接暴露了无头模式。');
    else add('good', 'UA 未暴露无头标识', 'User-Agent 中未出现 Headless 字样。');

    // plugins
    var pluginCount = n.plugins ? n.plugins.length : 0;
    if (pluginCount === 0) add('warn', '插件列表为空', 'navigator.plugins 长度为 0。现代 Chrome 中属常见（PDF 内置化），但无头环境也很典型。');
    else add('good', '插件列表正常', 'navigator.plugins 报告 ' + pluginCount + ' 个插件。');

    // mimeTypes
    var mimeCount = n.mimeTypes ? n.mimeTypes.length : 0;
    if (mimeCount === 0) add('warn', 'MIME 类型为空', 'navigator.mimeTypes 长度为 0。');
    else add('good', 'MIME 类型正常', 'navigator.mimeTypes 报告 ' + mimeCount + ' 项。');

    // window.chrome
    if (n.vendor && /Google/i.test(n.vendor)) {
      if (typeof w.chrome === 'undefined') add('bad', '缺少 window.chrome 对象', 'UA 声称是 Chrome，但 window.chrome 未定义，常见于伪装成 Chrome 的自动化环境。');
      else add('good', 'window.chrome 正常', 'window.chrome 对象存在。');
    }

    // 权限一致性（无头环境经典特征）
    try {
      if (w.Notification && w.Notification.permission === 'denied' && n.permissions) {
        n.permissions.query({ name: 'notifications' }).then(function (st) {
          if (st.state === 'prompt') {
            add('bad', '权限状态矛盾', 'Notification.permission 为 denied，但 permissions.query 返回 prompt。这是无头 Chrome 的经典特征。');
            renderAutomation(out);
          }
        }).catch(function () {});
      }
    } catch (e) { /* ignore */ }

    // outerWidth/Height
    if (w.outerWidth === 0 && w.outerHeight === 0) add('bad', '窗口外尺寸为 0', 'window.outerWidth 与 outerHeight 均为 0，无头浏览器典型特征。');
    else add('good', '窗口尺寸正常', '窗口外尺寸 ' + w.outerWidth + '×' + w.outerHeight + '。');

    // CDP 特征：Error.stack 中是否含 evaluate
    try {
      var stack = '';
      var obj = {};
      Object.defineProperty(obj, 'x', { get: function () { stack = new Error().stack || ''; return 1; } });
      void obj.x;
      if (/puppeteer|playwright|__puppeteer|cdp/i.test(stack)) add('bad', '堆栈中出现自动化框架标识', 'Error.stack 含自动化框架特征字符串。');
      else add('good', '堆栈未发现框架标识', 'Error.stack 中未匹配到 puppeteer / playwright / CDP 特征。');
    } catch (e) { /* ignore */ }

    // 语言列表
    if (!n.languages || n.languages.length === 0) add('bad', '语言偏好列表为空', '真实浏览器几乎不会返回空的语言列表。');
    else add('good', '语言偏好正常', '报告 ' + n.languages.length + ' 个语言偏好。');

    // 硬件并发
    if (n.hardwareConcurrency === 0) add('warn', 'CPU 核心数为 0', '无头环境常见。');

    // iframe / 沙箱逃逸特征
    if (w.top !== w.self) add('neutral', '运行在 iframe 中', '当前页面被嵌入到其他页面里（可能是站内预览）。');

    // document.hasFocus 与 visibilityState
    try {
      if (d.visibilityState === 'visible' && !d.hasFocus() && w.outerWidth > 0) {
        add('neutral', '页面未获得焦点', '页面可见但未聚焦，如果你切换到了其他窗口则属正常。');
      }
    } catch (e) { /* ignore */ }

    // 触摸与 UA 一致性（移动端伪装常见）
    var uaMobile = /Mobile|Android|iPhone/i.test(n.userAgent);
    var mtp = n.maxTouchPoints || 0;
    if (uaMobile && mtp === 0) add('warn', '移动 UA 但无触控点', 'UA 声称移动设备，但 maxTouchPoints 为 0。');
    else if (!uaMobile && mtp > 0) add('neutral', '桌面 UA 带触控', '可能是触屏笔记本或二合一设备，属正常情况。');

    // 屏幕像素比异常
    if (w.devicePixelRatio === 0) add('bad', '设备像素比为 0', '异常值。');

    return out;
  }

  function renderAutomation(list) {
    var html = list.map(function (c) {
      var icon = { good: '✅', warn: '⚠️', bad: '❌', neutral: '➖' }[c.level] || '➖';
      var cls = c.level === 'good' ? 'ok' : (c.level === 'warn' ? 'warn' : (c.level === 'bad' ? 'bad' : 'info'));
      return '<div class="alert ' + cls + '" style="margin-bottom:8px;"><b>' + icon + ' ' + esc(c.title) + '</b><br>' + esc(c.detail) + '</div>';
    }).join('');
    setHtml('autoList', html || '<div class="alert ok">未发现明显的自动化特征。</div>');
  }

  // ══════════════════ WebRTC 泄漏检测 ══════════════════

  async function webrtcCheck() {
    var verdict = $('webrtcVerdict');
    var table = $('webrtcTable');
    verdict.className = 'alert info';
    verdict.innerHTML = '<span class="status-dot loading"></span>正在收集 ICE 候选…';
    table.innerHTML = kv([['ICE 候选', '收集中…']]);

    if (!window.RTCPeerConnection) {
      verdict.className = 'alert warn';
      verdict.innerHTML = '当前浏览器不支持 RTCPeerConnection，无法检测。';
      return;
    }

    var candidates = [];
    var pc;
    try {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      });
      pc.createDataChannel('probe');
      pc.onicecandidate = function (e) {
        if (e.candidate && e.candidate.candidate) candidates.push(e.candidate.candidate);
      };
      var offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    } catch (e) {
      verdict.className = 'alert warn';
      verdict.innerHTML = '无法创建 RTCPeerConnection：' + esc(e && e.message ? e.message : '未知错误');
      return;
    }

    // 等待收集完成或 6 秒超时
    await new Promise(function (resolve) {
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      pc.onicecandidate = function (e) {
        if (!e.candidate) { finish(); return; }
        if (e.candidate.candidate) candidates.push(e.candidate.candidate);
      };
      setTimeout(finish, 6000);
    });

    try { pc.close(); } catch (e) { /* ignore */ }

    // 解析候选
    var parsed = [];
    candidates.forEach(function (line) {
      var parts = String(line).split(' ');
      if (parts.length < 8) return;
      var ip = parts[4];
      var port = parts[5];
      var typ = '';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] === 'typ') { typ = parts[i + 1]; break; }
      }
      if (!ip) return;
      var proto = parts[2] || '';
      parsed.push({ ip: ip, port: port, type: typ, proto: proto });
    });

    // 去重
    var seen = {};
    parsed = parsed.filter(function (c) {
      var k = c.ip + '|' + c.type + '|' + c.proto;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });

    if (!parsed.length) {
      verdict.className = 'alert warn';
      verdict.innerHTML = '未收集到任何 ICE 候选。可能是网络完全无法访问 STUN 服务器，或浏览器已启用 mDNS 混淆且无公网候选。';
      table.innerHTML = kv([['ICE 候选', '无']]);
      return;
    }

    var hostCands = parsed.filter(function (c) { return c.type === 'host'; });
    var srflxCands = parsed.filter(function (c) { return c.type === 'srflx'; });
    var relayCands = parsed.filter(function (c) { return c.type === 'relay'; });

    // 公网候选 IP 列表（真实值，排除 mDNS）
    var realPublic = srflxCands.map(function (c) { return c.ip; })
      .filter(function (ip) { return ip && ip.indexOf('.local') < 0 && A.isIP(ip); });

    var rows = [
      ['候选总数', String(parsed.length)],
      ['host（本地）', hostCands.length ? hostCands.map(function (c) { return c.ip + ':' + c.port; }).join(', ') : '无', 1],
      ['srflx（公网）', realPublic.length ? realPublic.join(', ') : (srflxCands.length ? '（已被 mDNS 混淆）' : '无'), 1],
      ['relay（中继）', relayCands.length ? relayCands.map(function (c) { return c.ip; }).join(', ') : '无', 1],
    ];

    // 与出口 IP 比对
    var exitIp = (window.IPApp && window.__mainIP) || null;
    if (!exitIp) {
      try {
        var r = await fetch('/api/ip', { signal: AbortSignal.timeout(8000) });
        var d = await r.json();
        exitIp = d.ip;
      } catch (e) { /* ignore */ }
    }

    rows.push(['本机出口 IP', exitIp || '未知', 1]);

    setHtml('webrtcTable', kv(rows));

    if (!realPublic.length) {
      verdict.className = 'alert ok';
      verdict.innerHTML = '✅ 未通过 WebRTC 暴露公网地址' + (hostCands.length ? '（仅出现本地 / mDNS 候选）' : '') + '，不存在 WebRTC 泄漏。';
    } else if (exitIp && realPublic.indexOf(exitIp) >= 0) {
      verdict.className = 'alert ok';
      verdict.innerHTML = '✅ WebRTC 暴露的公网地址 <b class="mono">' + esc(realPublic.join(', ')) + '</b> 与代理出口一致，未发现泄漏。';
    } else if (exitIp) {
      verdict.className = 'alert bad';
      verdict.innerHTML = '⚠️ 检测到 WebRTC 泄漏！<br>WebRTC 暴露的公网地址为 <b class="mono">' + esc(realPublic.join(', ')) +
        '</b>，但网页出口为 <b class="mono">' + esc(exitIp) + '</b>，两者不一致。<br>说明浏览器的 WebRTC 流量未走代理，真实 IP 可能被泄露给站点。建议在浏览器中关闭 WebRTC 或启用代理的 WebRTC 接管。';
    } else {
      verdict.className = 'alert warn';
      verdict.innerHTML = 'WebRTC 暴露了公网地址 <b class="mono">' + esc(realPublic.join(', ')) + '</b>，但无法取得网页出口进行比对。';
    }
  }

  // ══════════════════ 权限 ══════════════════

  var PERM_NAMES = [
    ['geolocation', '地理位置'],
    ['notifications', '通知'],
    ['camera', '摄像头'],
    ['microphone', '麦克风'],
    ['clipboard-read', '读取剪贴板'],
    ['clipboard-write', '写入剪贴板'],
    ['local-fonts', '本地字体'],
    ['midi', 'MIDI 设备'],
    ['payment-handler', '支付处理'],
    ['push', '推送'],
    ['screen-wake-lock', '屏幕常亮'],
    ['storage-access', '存储访问'],
    ['accelerometer', '加速度计'],
    ['gyroscope', '陀螺仪'],
    ['magnetometer', '磁力计'],
    ['background-sync', '后台同步'],
    ['persistent-storage', '持久化存储'],
  ];

  var PERM_LABEL = { granted: '已授权', prompt: '询问', denied: '已拒绝' };
  var PERM_CLASS = { granted: 'good', prompt: 'info', denied: 'neutral' };

  async function queryPermissions() {
    var grid = $('permGrid');
    if (!grid) return;
    if (!navigator.permissions || !navigator.permissions.query) {
      grid.innerHTML = '<div class="alert warn">当前浏览器不支持 Permissions API。</div>';
      return;
    }
    grid.innerHTML = '';

    await Promise.all(PERM_NAMES.map(async function (p) {
      var name = p[0], label = p[1];
      var item = document.createElement('div');
      item.className = 'source-item';
      item.innerHTML = '<div class="source-name">' + esc(label) + '</div><div class="source-loading">查询中…</div>';
      grid.appendChild(item);

      try {
        var st = await navigator.permissions.query({ name: name });
        var state = st.state || 'unknown';
        item.innerHTML =
          '<div class="source-name">' + esc(label) + '</div>' +
          '<div><span class="badge ' + (PERM_CLASS[state] || 'neutral') + '">' + esc(PERM_LABEL[state] || state) + '</span></div>' +
          '<div class="source-loc mono">' + esc(name) + '</div>';
      } catch (e) {
        item.innerHTML =
          '<div class="source-name">' + esc(label) + '</div>' +
          '<div class="source-loc">该权限名不被支持</div>' +
          '<div class="source-loc mono">' + esc(name) + '</div>';
      }
    }));
  }

  // ══════════════════ 编排 ══════════════════

  var state = { inited: false, fp: null };

  async function init() {
    if (state.inited) return;
    state.inited = true;

    var env = collectEnv();
    renderEnv(env);

    var cons = checkConsistency();
    renderConsistency(cons);

    var auto = detectAutomation();
    // 异步的权限一致性检查可能稍后再补一条，先渲染一次
    renderAutomation(auto);
    setTimeout(function () { renderAutomation(auto); }, 800);

    // 指纹（Canvas/字体同步，Audio 异步）
    var canvasData = canvasFingerprint();
    var fonts = safe(detectFonts, []);
    var gl = getWebGLInfo();

    state.fp = {
      canvas: canvasData ? (canvasData.slice(0, 60) + '…') : '',
      canvasHash: canvasData ? hash53(canvasData) : '',
      gl: gl,
      fonts: fonts,
      fontHash: '',
      audio: '',
      composite: '',
    };
    state.fp.fontHash = hash53(fonts.join(','));
    renderFingerprint(state.fp);

    var audio = await audioFingerprint();
    state.fp.audio = audio;
    state.fp.composite = hash53([
      canvasData ? hash53(canvasData) : '',
      fonts.join(','),
      gl ? (gl.vendor + '|' + gl.renderer) : '',
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      window.devicePixelRatio,
      navigator.hardwareConcurrency || '',
      navigator.language || '',
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      audio,
      navigator.maxTouchPoints || 0,
    ].join('###'));
    renderFingerprint(state.fp);

    // 权限状态随面板一起加载，无需再点一次
    queryPermissions();
  }

  function refresh() {
    state.inited = false;
    init();
    queryPermissions();
  }

  window.IPBrowser = {
    init: init,
    refresh: refresh,
    webrtc: webrtcCheck,
    permissions: queryPermissions,
    get inited() { return state.inited; },
  };
})();
