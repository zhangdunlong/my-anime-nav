/**
 * speed-app.js — 网站测速逻辑 v5
 * 配套 speed.html 使用，部署于 Cloudflare Pages
 * 下载：同源 /spd-asset.bin（国际链路）+ 国内源 cdn.npmmirror.com（阿里云 CDN）双源并行，叠加摸满千兆
 * 上传走同源函数 /speedtest-up；最终显示的均为过程中观测到的「峰值带宽」而非平均值
 */

(function () {
  'use strict';

  // ===== 同源测速资源 =====
  // 下载：静态资源 /spd-asset.bin（10MB，Cloudflare 边缘，国内可访问，不受 Functions 响应体限制）
  // 上传：Functions /speedtest-up 接收 POST
  var DL_FILE = '/spd-asset.bin';
  var CF_UP   = '/speedtest-up';
  // 国内测速源：阿里云 CDN 支撑的 npmmirror 大文件（9.4MB，纯国内对等，可喂饱千兆）
  // 注意：该源 CORS 回显精确 Origin；若你的域名不在其白名单内，会自动回退到同源（国际链路）
  var DL_FILE_CN = 'https://cdn.npmmirror.com/packages/three/0.160.0/three-0.160.0.tgz';

  // ===== 下载测速参数 =====
  var DL_PARALLEL = 12;       // 12连接并行（HTTP/2 多路复用，饱和带宽）
  var DL_TIME     = 12000;    // 12秒窗口
  var UP_PARALLEL = 4;
  var UP_SIZE     = 5000000;  // 5MB
  var UP_TIME     = 10000;

  // ===== Ping 测试节点 =====
  var PING_NODES = [
    { name: '本站 (同源)', url: location.origin + '/assets/images/favicon.svg', loc: 'Cloudflare CDN' },
    { name: 'Cloudflare', url: 'https://1.1.1.1/cdn-cgi/trace', loc: 'Global' },
    { name: 'Google DNS', url: 'https://dns.google/favicon.ico', loc: 'Global' },
    { name: '百度', url: 'https://www.baidu.com/favicon.ico', loc: 'China' },
    { name: '腾讯', url: 'https://www.qq.com/favicon.ico', loc: 'China' },
    { name: '阿里', url: 'https://www.aliyun.com/favicon.ico', loc: 'China' }
  ];

  // ===== 全球节点 =====
  var REGION_NODES = [
    { flag: '🇨🇳', name: '中国 (本站)', url: location.origin + '/assets/images/favicon.svg' },
    { flag: '🇭🇰', name: '中国香港', url: 'https://www.google.com.hk/favicon.ico' },
    { flag: '🇯🇵', name: '日本东京', url: 'https://www.google.co.jp/favicon.ico' },
    { flag: '🇰🇷', name: '韩国首尔', url: 'https://www.google.co.kr/favicon.ico' },
    { flag: '🇸🇬', name: '新加坡', url: 'https://www.google.com.sg/favicon.ico' },
    { flag: '🇺🇸', name: '美国', url: 'https://www.google.com/favicon.ico' },
    { flag: '🇬🇧', name: '英国', url: 'https://www.google.co.uk/favicon.ico' },
    { flag: '🇩🇪', name: '德国', url: 'https://www.google.de/favicon.ico' },
    { flag: '🇫🇷', name: '法国', url: 'https://www.google.fr/favicon.ico' },
    { flag: '🇦🇺', name: '澳大利亚', url: 'https://www.google.com.au/favicon.ico' },
    { flag: '🇨🇦', name: '加拿大', url: 'https://www.google.ca/favicon.ico' },
    { flag: '🇮🇳', name: '印度', url: 'https://www.google.co.in/favicon.ico' }
  ];

  // ===== DOM =====
  var startBtn = document.getElementById('startBtn');
  var startBtnText = document.getElementById('startBtnText');
  var dlProgress = document.getElementById('dlProgress');
  var dlValue = document.getElementById('dlValue');
  var dlUnit = document.getElementById('dlUnit');
  var dlSize = document.getElementById('dlSize');
  var dlTime = document.getElementById('dlTime');
  var dlStatus = document.getElementById('dlStatus');
  var dlBadge = document.getElementById('dlBadge');
  var pingBadge = document.getElementById('pingBadge');
  var regionBadge = document.getElementById('regionBadge');

  // 上传相关 DOM (如果存在)
  var upProgress = document.getElementById('upProgress');
  var upValue = document.getElementById('upValue');
  var upUnit = document.getElementById('upUnit');
  var upSize = document.getElementById('upSize');
  var upTime = document.getElementById('upTime');
  var upStatus = document.getElementById('upStatus');
  var upBadge = document.getElementById('upBadge');

  var isRunning = false;
  var dlCircle = 534;
  var upCircle = 534;

  // ===== 单独测试按钮 =====
  var pingSingleBtn = document.getElementById('pingSingleBtn');
  var dlSingleBtn   = document.getElementById('dlSingleBtn');
  var upSingleBtn   = document.getElementById('upSingleBtn');

  // 按钮 hover 效果（CSP 禁止内联 onmouseover）
  [pingSingleBtn, dlSingleBtn, upSingleBtn].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('mouseover', function () { btn.style.background = 'rgba(236,72,153,0.1)'; });
    btn.addEventListener('mouseout',  function () { btn.style.background = 'rgba(236,72,153,0.04)'; });
  });

  function disableSingleBtns(disabled) {
    [pingSingleBtn, dlSingleBtn, upSingleBtn].forEach(function (btn) {
      if (!btn) return;
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.5' : '1';
      btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    });
  }

  // ===== 工具 =====
  function fmtMs(ms) {
    if (ms < 0 || !isFinite(ms)) return '--';
    if (ms < 1) return '<1';
    return Math.round(ms).toString();
  }
  function getLatencyClass(ms) {
    if (ms < 0) return 'timeout';
    if (ms < 80) return 'good';
    if (ms < 200) return 'ok';
    return 'bad';
  }
  function getBarWidth(ms) {
    if (ms < 0) return 100;
    return Math.max(5, Math.min(100, (ms / 300) * 100));
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ===== Ping 网格 =====
  function initPingGrid() {
    var grid = document.getElementById('pingGrid');
    grid.innerHTML = '';
    PING_NODES.forEach(function (node, i) {
      var el = document.createElement('div');
      el.className = 'ping-item';
      el.id = 'ping_' + i;
      el.innerHTML =
        '<div class="ping-name">' + node.name + '</div>' +
        '<div class="ping-loc">' + node.loc + '</div>' +
        '<div class="ping-val pending" style="color:#ccc;font-size:11px;">待测</div>' +
        '<div class="ping-ms">&nbsp;</div>' +
        '<div class="ping-bar"><div class="ping-bar-fill" style="width:0;"></div></div>';
      grid.appendChild(el);
    });
  }

  function initRegionGrid() {
    var grid = document.getElementById('regionGrid');
    grid.innerHTML = '';
    REGION_NODES.forEach(function (node, i) {
      var el = document.createElement('div');
      el.className = 'region-item';
      el.id = 'region_' + i;
      el.innerHTML =
        '<span class="r-flag">' + node.flag + '</span>' +
        '<div class="r-info">' +
          '<div class="r-name">' + node.name + '</div>' +
          '<div class="r-url">' + node.url.replace(/https?:\/\//, '').split('/')[0] + '</div>' +
        '</div>' +
        '<div class="r-latency pending" style="color:#ccc;font-size:11px;">待测</div>';
      grid.appendChild(el);
    });
  }

  // ===== Ping 测试 =====
  function measurePing(url, count) {
    count = count || 3;
    var times = [];
    return (async function () {
      for (var i = 0; i < count; i++) {
        try {
          var t0 = performance.now();
          await fetch(url + '?_t=' + Date.now() + '_' + i, {
            method: 'GET', mode: 'no-cors', cache: 'no-store', redirect: 'follow'
          });
          times.push(performance.now() - t0);
        } catch (e) {}
      }
      if (times.length === 0) return -1;
      if (times.length > 1) times = times.slice(1);
      return times.reduce(function (a, b) { return a + b; }, 0) / times.length;
    })();
  }

  async function runPingTests() {
    pingBadge.textContent = '测速中...';
    pingBadge.style.background = 'rgba(168,85,247,0.15)';

    var promises = PING_NODES.map(function (node, i) {
      var el = document.getElementById('ping_' + i);
      var valEl = el.querySelector('.ping-val');
      var msEl = el.querySelector('.ping-ms');
      var barFill = el.querySelector('.ping-bar-fill');
      el.className = 'ping-item testing';
      valEl.className = 'ping-val testing';
      valEl.textContent = '测速中';

      return measurePing(node.url, 3).then(function (ms) {
        var cls = getLatencyClass(ms);
        el.className = 'ping-item done';
        if (ms < 0) {
          valEl.className = 'ping-val timeout';
          valEl.textContent = '超时';
          msEl.textContent = '—';
        } else {
          valEl.className = 'ping-val ' + cls;
          valEl.textContent = fmtMs(ms);
          msEl.textContent = 'ms';
        }
        barFill.className = 'ping-bar-fill ' + cls;
        barFill.style.width = getBarWidth(ms) + '%';
      }).catch(function () {
        el.className = 'ping-item done';
        valEl.className = 'ping-val timeout';
        valEl.textContent = '超时';
      });
    });

    await Promise.all(promises);
    pingBadge.textContent = '完成 ✓';
    pingBadge.style.background = '#e0f2fe';
    pingBadge.style.color = '#10b981';
  }

  // ===== 单独 Ping 测试入口 =====
  if (pingSingleBtn) {
    pingSingleBtn.addEventListener('click', function () {
      if (isRunning) return;
      isRunning = true;
      disableSingleBtns(true);
      initPingGrid();
      runPingTests()
        .catch(function () {})
        .finally(function () {
          isRunning = false;
          disableSingleBtns(false);
        });
    });
  }

  // ===== 全球节点 =====
  async function runRegionTests() {
    regionBadge.textContent = '测速中...';
    regionBadge.style.background = 'rgba(168,85,247,0.15)';

    var promises = REGION_NODES.map(function (node, i) {
      var el = document.getElementById('region_' + i);
      var latEl = el.querySelector('.r-latency');
      latEl.className = 'r-latency testing';
      latEl.textContent = '测速中';

      return measurePing(node.url, 3).then(function (ms) {
        var cls = getLatencyClass(ms);
        if (ms < 0) { latEl.className = 'r-latency ' + cls; latEl.textContent = '超时'; }
        else { latEl.className = 'r-latency ' + cls; latEl.textContent = fmtMs(ms) + 'ms'; }
      }).catch(function () { latEl.className = 'r-latency bad'; latEl.textContent = '超时'; });
    });

    await Promise.all(promises);
    regionBadge.textContent = '完成 ✓';
    regionBadge.style.background = '#e0f2fe';
    regionBadge.style.color = '#10b981';
  }

  // ===== 下载测速 (流式 reader + 双管道20流并行) =====
  // 无 AbortController，用 reader.cancel() + 时间戳检查
  async function runDownloadTest() {
    dlBadge.textContent = '测速中...';
    dlBadge.style.background = 'rgba(168,85,247,0.15)';
    dlStatus.textContent = '预热中';
    dlStatus.style.color = '#a855f7';
    dlProgress.style.strokeDashoffset = dlCircle;
    dlValue.textContent = '0';
    dlUnit.textContent = 'Mbps';
    dlSize.textContent = '0';
    dlTime.textContent = '0';

    // 1) 连通性确认（同源，HEAD 轻量；页面加载时连接已建立，warmup 主要防端点故障卡死）
    //    带 8 秒超时兜底 —— 即使端点异常也绝不无限卡在"预热中"
    var wac = new AbortController();
    var wt = setTimeout(function () { try { wac.abort(); } catch (e) {} }, 8000);
    try {
      await fetch(DL_FILE, { method: 'HEAD', cache: 'no-store', signal: wac.signal });
    } catch (e) {}
    clearTimeout(wt);

    // 1.5) 探测国内源（阿里云 CDN / npmmirror）：校验 CORS 与可达性，
    //      失败则回退只用同源（Cloudflare 国际链路）。带 6s 超时兜底。
    var useCn = false;
    try {
      var cnc = new AbortController();
      var cnt = setTimeout(function () { try { cnc.abort(); } catch (e) {} }, 6000);
      var cnResp = await fetch(DL_FILE_CN, { method: 'HEAD', cache: 'no-store', signal: cnc.signal, mode: 'cors' });
      clearTimeout(cnt);
      if (cnResp && (cnResp.ok || cnResp.status === 200)) useCn = true;
    } catch (e) { useCn = false; }
    dlStatus.textContent = useCn ? '测试中(双源)' : '测试中';

    // 2) 预热完成后才开始计时
    var totalBytes = 0;
    var startTime  = performance.now();
    var deadline   = startTime + DL_TIME;
    var lastBytes  = 0;       // 上一 UI tick 的累计字节（算瞬时速度用）
    var lastUiTime = startTime;
    var maxSpeed   = 0;       // 过程中的最大带宽（峰值）

    // 3) 循环下载：每个 worker 不断请求测速文件（随机参数绕过缓存），reader 实时累计字节。
    //    启用国内源时，12 连接按索引对半切：一半拉同源(国际链路)，一半拉国内源(阿里云 CDN)，
    //    两条链路并行叠加，才能摸满千兆；国内源偶发失败则本次回退同源，不浪费连接。
    var sources = useCn ? [DL_FILE, DL_FILE_CN] : [DL_FILE];
    async function dlWorker(wid) {
      var baseSrc = sources[wid % sources.length];
      while (performance.now() < deadline) {
        try {
          var url = baseSrc + '?_=' + Date.now() + '-' + wid + '-' + Math.random();
          var resp = await fetch(url, { cache: 'no-store' });
          if (!resp.ok && baseSrc === DL_FILE_CN) {
            // 国内源失败 → 本次回退同源
            try { resp = await fetch(DL_FILE + '?_=' + Date.now() + '-' + wid + '-' + Math.random(), { cache: 'no-store' }); } catch (e2) {}
          }
          if (!resp.ok) { await sleep(200); continue; }
          var reader = resp.body.getReader();
          while (true) {
            var chunk = await reader.read();
            if (chunk.done) break;
            totalBytes += chunk.value.length;
            if (performance.now() >= deadline) {
              try { reader.cancel(); } catch (e2) {}
              break;
            }
          }
          try { reader.releaseLock(); } catch (e3) {}
        } catch (e) {
          await sleep(200);
        }
      }
    }

    // UI 实时更新（显示瞬时速度，并追踪峰值）
    var uiTimer = setInterval(function () {
      var now = performance.now();
      var el = (now - startTime) / 1000;
      if (el > 0) {
        // 瞬时速度 = 相邻 tick 的字节增量 / 间隔，能反映真实带宽波动与峰值
        var dt = (now - lastUiTime) / 1000;
        var inst = dt > 0 ? ((totalBytes - lastBytes) * 8) / 1000000 / dt : 0;
        lastBytes = totalBytes;
        lastUiTime = now;
        if (inst > maxSpeed) maxSpeed = inst;
        var progress = Math.min(el / (DL_TIME / 1000), 1);
        dlValue.textContent = inst.toFixed(1);
        dlSize.textContent = (totalBytes / 1048576).toFixed(2);
        dlTime.textContent = el.toFixed(1);
        dlProgress.style.strokeDashoffset = dlCircle * (1 - progress);
      }
    }, 200);

    // 启动 DL_PARALLEL 个并发下载
    var workers = [];
    for (var i = 0; i < DL_PARALLEL; i++) workers.push(dlWorker(i));
    await Promise.allSettled(workers);
    clearInterval(uiTimer);

    var totalTime = (performance.now() - startTime) / 1000;

    // 最终显示峰值带宽（过程中观测到的最大瞬时速度），而非平均值
    dlValue.textContent = maxSpeed.toFixed(1);
    dlUnit.textContent = 'Mbps';
    dlSize.textContent = (totalBytes / 1048576).toFixed(2);
    dlTime.textContent = totalTime.toFixed(1);
    dlProgress.style.strokeDashoffset = 0;
    dlStatus.textContent = '完成';
    dlStatus.style.color = '#10b981';
    dlBadge.textContent = '完成 ✓';
    dlBadge.style.background = '#e0f2fe';
    dlBadge.style.color = '#10b981';
  }

  // 单独下载测试入口
  if (dlSingleBtn) {
    dlSingleBtn.addEventListener('click', function () {
      if (isRunning) return;
      isRunning = true;
      disableSingleBtns(true);
      runDownloadTest()
        .catch(function () {})
        .finally(function () {
          isRunning = false;
          disableSingleBtns(false);
        });
    });
  }

  // ===== 上传测速 =====
  async function runUploadTest() {
    if (!upBadge || !upProgress || !upValue) return; // DOM 不存在就跳过
    upBadge.textContent = '测速中...';
    upBadge.style.background = 'rgba(168,85,247,0.15)';
    upStatus.textContent = '准备中';
    upStatus.style.color = '#a855f7';
    upProgress.style.strokeDashoffset = upCircle;
    upValue.textContent = '0';
    upSize.textContent = '0';
    upTime.textContent = '0';

    // 预生成 4MB 数据
    var buf = new Uint8Array(UP_SIZE);
    for (var i = 0; i < UP_SIZE; i += 4096) buf[i] = (Math.random() * 256) | 0;
    var blob = new Blob([buf], { type: 'application/octet-stream' });

    upStatus.textContent = '测试中';

    var totalSent = 0;
    var startTime = performance.now();
    var deadline  = startTime + UP_TIME;
    var lastSent  = 0;       // 上一 UI tick 的累计字节（算瞬时速度用）
    var lastUiTime = startTime;
    var maxSpeed  = 0;       // 过程中的最大带宽（峰值）

    async function upWorker(wid) {
      while (performance.now() < deadline) {
        try {
          var url = CF_UP + '?_=' + Date.now() + '-' + wid + '-' + Math.random();
          await fetch(url, {
            method: 'POST', body: blob,
            headers: { 'Content-Type': 'application/octet-stream' }
          });
          totalSent += UP_SIZE;
        } catch (e) {
          await sleep(300);
        }
      }
    }

    var uiTimer = setInterval(function () {
      var now = performance.now();
      var el = (now - startTime) / 1000;
      if (el > 0) {
        // 瞬时速度 = 相邻 tick 的字节增量 / 间隔，能反映真实带宽波动与峰值
        var dt = (now - lastUiTime) / 1000;
        var inst = dt > 0 ? ((totalSent - lastSent) * 8) / 1000000 / dt : 0;
        lastSent = totalSent;
        lastUiTime = now;
        if (inst > maxSpeed) maxSpeed = inst;
        var progress = Math.min(el / (UP_TIME / 1000), 1);
        upValue.textContent = inst.toFixed(1);
        upSize.textContent = (totalSent / 1048576).toFixed(2);
        upTime.textContent = el.toFixed(1);
        upProgress.style.strokeDashoffset = upCircle * (1 - progress);
      }
    }, 300);

    var workers = [];
    for (var j = 0; j < UP_PARALLEL; j++) workers.push(upWorker(j));
    await Promise.allSettled(workers);
    clearInterval(uiTimer);

    var totalTime = (performance.now() - startTime) / 1000;

    // 最终显示峰值带宽（过程中观测到的最大瞬时速度），而非平均值
    upValue.textContent = maxSpeed > 0 ? maxSpeed.toFixed(1) : 'N/A';
    upUnit.textContent = maxSpeed > 0 ? 'Mbps' : '';
    upSize.textContent = (totalSent / 1048576).toFixed(2);
    upTime.textContent = totalTime.toFixed(1);
    upProgress.style.strokeDashoffset = 0;
    upStatus.textContent = '完成';
    upStatus.style.color = '#10b981';
    upBadge.textContent = '完成 ✓';
    upBadge.style.background = '#e0f2fe';
    upBadge.style.color = '#10b981';
  }

  if (upSingleBtn) {
    upSingleBtn.addEventListener('click', function () {
      if (isRunning) return;
      isRunning = true;
      disableSingleBtns(true);
      runUploadTest()
        .catch(function () {})
        .finally(function () {
          isRunning = false;
          disableSingleBtns(false);
        });
    });
  }

  // ===== 一键测速 =====
  async function startAllTests() {
    if (isRunning) return;
    isRunning = true;
    startBtn.disabled = true;
    disableSingleBtns(true);
    startBtnText.innerHTML = '<span class="spin">🔄</span> 测速进行中...';

    [pingBadge, dlBadge, regionBadge].forEach(function (b) {
      b.textContent = '等待'; b.style.background = '#f3e5f5'; b.style.color = '#a855f7';
    });
    if (upBadge) { upBadge.textContent = '等待'; upBadge.style.background = '#f3e5f5'; upBadge.style.color = '#a855f7'; }

    initPingGrid();
    initRegionGrid();

    // Ping
    await runPingTests();

    // 下载
    await runDownloadTest();

    // 上传
    if (upBadge) await runUploadTest();

    // 全球节点
    await runRegionTests();

    isRunning = false;
    startBtn.disabled = false;
    disableSingleBtns(false);
    startBtnText.innerHTML = '🚀 重新测速';
  }

  // ===== 初始化 =====
  initPingGrid();
  initRegionGrid();
  startBtn.addEventListener('click', startAllTests);

})();
