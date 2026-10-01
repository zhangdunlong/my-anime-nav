/**
 * IP 工具箱 — 网络核心逻辑
 * 配套 ip.html 使用，部署于 Cloudflare Pages
 *
 * 设计约束：
 *  - CSP 为 script-src 'self'，禁止内联事件，全部走 data-action 事件委托
 *  - 第三方接口优先直连，跨域/网络受限时回退到同源代理 /api/netprobe
 */
(function () {
  'use strict';

  // ══════════════════ 基础工具 ══════════════════

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s === null || s === undefined ? '' : String(s);
    return d.innerHTML;
  }

  function $(id) { return document.getElementById(id); }
  function setHtml(id, html) { var e = $(id); if (e) e.innerHTML = html; }
  function setText(id, t) { var e = $(id); if (e) e.textContent = t === null || t === undefined ? '—' : String(t); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** 竞争超时包装 */
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error('timeout')); }, ms);
      }),
    ]);
  }

  /** 代理请求：经同源 /api/netprobe 获取目标 */
  async function viaProxy(target, ms) {
    var url = '/api/netprobe?url=' + encodeURIComponent(target);
    var r = await withTimeout(fetch(url, { signal: AbortSignal.timeout(ms || 15000) }), (ms || 15000) + 1500);
    if (!r.ok) {
      var msg = '代理请求失败 (' + r.status + ')';
      try { var j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    return r.json();
  }

  /** 代理取 JSON */
  async function proxyJson(target, ms) {
    var j = await viaProxy(target, ms);
    try { return JSON.parse(j.body); }
    catch (e) { throw new Error('响应不是合法 JSON'); }
  }

  /** 直连取 JSON，失败抛错（由调用方决定是否回退代理） */
  async function directJson(target, ms) {
    var r = await withTimeout(fetch(target, { signal: AbortSignal.timeout(ms || 12000) }), (ms || 12000) + 1500);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /** 先直连，失败再走代理 */
  async function smartJson(target, ms) {
    try { return await directJson(target, ms); }
    catch (e) { return await proxyJson(target, ms); }
  }

  /** 先直连文本，失败再走代理 */
  async function smartText(target, ms) {
    try {
      var r = await withTimeout(fetch(target, { signal: AbortSignal.timeout(ms || 12000) }), (ms || 12000) + 1500);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      var j = await viaProxy(target, ms);
      return j.body;
    }
  }

  function isIPv4(s) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(String(s || '').trim()); }
  function isIPv6(s) { return String(s || '').indexOf(':') >= 0; }
  function isIP(s) { return isIPv4(s) || isIPv6(s); }

  // ══════════════════ 状态 ══════════════════

  var STATE = {
    mainIP: '',
    mainCf: null,   // /api/ip 返回
    info: null,     // 聚合后的 IP 情报
    detailQuery: '',
    gpLocation: 'world',
    riskScore: null,
  };

  // ══════════════════ 标签切换 ══════════════════

  function switchTab(name) {
    var tabs = document.querySelectorAll('#tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.tab === name);
    }
    var panels = document.querySelectorAll('.panel');
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('active', panels[j].id === 'panel-' + name);
    }
    if (history.replaceState) {
      history.replaceState(null, '', '#' + name);
    }
    // 进入浏览器/AI/网络面板时按需初始化，避免首屏发起过多请求
    if (name === 'browser' && window.IPBrowser && !window.IPBrowser.inited) {
      window.IPBrowser.init();
    }
    if (name === 'ai' && window.IPAi && !window.IPAi.inited) {
      window.IPAi.init();
    }
    if (name === 'network') ensureNetwork();
    if (name === 'detail' && !STATE.detailQuery) {
      queryDetail('');
    }
  }

  // 网络诊断面板的首次加载（只跑一次）
  var networkLoaded = false;
  function ensureNetwork() {
    if (networkLoaded) return;
    networkLoaded = true;
    queryExits();
    queryDns();
    queryCdn();
    queryPorts();
  }

  // ══════════════════ 概览：主 IP ══════════════════

  async function getMainIP() {
    try {
      var r = await fetch('/api/ip', { signal: AbortSignal.timeout(10000) });
      var data = await r.json();
      if (!data.ip || data.ip === 'unknown') throw new Error('无 IP');
      STATE.mainIP = data.ip;
      STATE.mainCf = data;
      window.__mainIP = data.ip;

      var el = $('mainIP');
      el.innerHTML = '<span class="status-dot online"></span>' + esc(data.ip);

      var tags = '';
      if (data.country) tags += '<span class="ip-tag loc">' + esc(data.country) + (data.city ? ' / ' + esc(data.city) : '') + '</span>';
      if (data.asOrganization) tags += '<span class="ip-tag isp">' + esc(data.asOrganization) + '</span>';
      if (data.asn) tags += '<span class="ip-tag asn">AS' + esc(String(data.asn).replace(/^AS/i, '')) + '</span>';
      if (data.colo) tags += '<span class="ip-tag colo">CF ' + esc(data.colo) + '</span>';
      if (data.httpProtocol) tags += '<span class="ip-tag asn">' + esc(data.httpProtocol) + '</span>';
      setHtml('mainMeta', tags);

      // 概况卡片
      var isV6 = isIPv6(data.ip);
      setText('geoValue', (data.country || '') + (data.city ? ' · ' + data.city : ''));
      setText('geoInfo', (data.region || '') + (data.timezone ? ' · ' + data.timezone : ''));
      setText('ispValue', data.asOrganization || '—');
      setText('ispInfo', (data.asn ? 'AS' + String(data.asn).replace(/^AS/i, '') : '') + (data.colo ? ' · 边缘 ' + data.colo : ''));

      if (isV6) {
        setText('ipv6Value', data.ip);
        setHtml('ipv6Info', esc((data.country || '') + ' ' + (data.city || '')) + '<br>' + esc(data.asOrganization || ''));
        setText('ipv4Value', '不适用');
        setText('ipv4Info', '当前网络无 IPv4 出口');
      } else {
        setText('ipv4Value', data.ip);
        setHtml('ipv4Info', esc((data.country || '') + ' ' + (data.city || '')) + '<br>' + esc(data.asOrganization || ''));
      }
    } catch (e) {
      setHtml('mainIP', '<span class="status-dot offline"></span>无法获取 IP');
    }

    detectSecondaryIP();
    refreshRisk();
    queryAllSources();
  }

  /** 通过 ipify 补充另一协议的出口地址 */
  function detectSecondaryIP() {
    fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(8000) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var cur = $('ipv4Value').textContent;
        if (d.ip && isIPv4(d.ip) && (cur === '检测中…' || cur === '不适用')) {
          setText('ipv4Value', d.ip);
        }
      })
      .catch(function () {});

    fetch('https://api6.ipify.org?format=json', { signal: AbortSignal.timeout(8000) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ip && isIPv6(d.ip)) {
          if ($('ipv6Value').textContent === '检测中…') {
            setText('ipv6Value', d.ip);
            fetchIPInfo(d.ip, 'ipv6Info');
          }
        }
      })
      .catch(function () {
        if ($('ipv6Value').textContent === '检测中…') {
          setText('ipv6Value', '不适用');
          setText('ipv6Info', '当前网络无 IPv6 出口');
        }
      });
  }

  function fetchIPInfo(ip, targetId) {
    fetch('https://ipinfo.io/' + encodeURIComponent(ip) + '/json', { signal: AbortSignal.timeout(10000) })
      .then(function (d) {
        if (d && d.ip) {
          var loc = [(d.country || ''), (d.region || ''), (d.city || '')].filter(Boolean).join(' ');
          setHtml(targetId, esc(loc) + (d.org ? '<br>' + esc(d.org) : ''));
        }
      })
      .catch(function () {});
  }

  // ══════════════════ 风险评估 ══════════════════

  /** 已知数据中心 / 云厂商 / VPN 特征关键词 */
  var DATACENTER_HINTS = [
    'cloudflare', 'amazon', 'aws', 'google', 'microsoft', 'azure', 'alibaba', 'aliyun',
    'tencent', 'digitalocean', 'linode', 'akamai', 'ovh', 'hetzner', 'contabo', 'vultr',
    'oracle', 'leaseweb', 'choopa', 'm247', 'datacamp', 'hostwinds', 'scaleway',
    'equinix', 'colo', 'datacenter', 'data center', 'hosting', 'server', 'cloud',
    'vpn', 'proxy', 'expressvpn', 'nordvpn', 'surfshark', 'mullvad', 'private internet',
    'hostinger', 'namecheap', 'godaddy', 'racknerd', 'buyvm', 'frantech', 'kamatera',
  ];

  function computeRisk(parts) {
    // parts: { proxy, hosting, mobile, tor, bogon, orgText }
    var score = 100;
    var flags = [];

    if (parts.bogon) { return { score: 0, flags: ['保留地址'], level: 'poor', blocked: true }; }

    if (parts.tor) { score -= 55; flags.push('Tor 出口'); }
    if (parts.proxy) { score -= 30; flags.push('代理'); }
    if (parts.hosting) { score -= 22; flags.push('机房 / 数据中心'); }
    if (parts.mobile) { score -= 8; flags.push('移动网络'); }

    var org = String(parts.orgText || '').toLowerCase();
    if (org) {
      for (var i = 0; i < DATACENTER_HINTS.length; i++) {
        if (org.indexOf(DATACENTER_HINTS[i]) >= 0) {
          if (!parts.hosting) { score -= 14; flags.push('云 / 托管网络特征'); }
          flags.push('ASN 归属：' + parts.orgText);
          break;
        }
      }
    }

    if (flags.length === 0) flags.push('未发现明显风险特征');

    score = Math.max(0, Math.min(100, score));
    var level = score >= 75 ? 'good' : (score >= 45 ? 'moderate' : 'poor');
    return { score: score, flags: flags, level: level };
  }

  function paintRisk(res, sourceCount) {
    var arc = $('riskArc');
    var circumference = 314.16;
    var color = res.level === 'good' ? '#10b981' : (res.level === 'moderate' ? '#f59e0b' : '#ef4444');

    if (arc) {
      arc.setAttribute('stroke', color);
      arc.style.strokeDashoffset = String(circumference * (1 - res.score / 100));
    }
    setText('riskScore', String(res.score));
    var lv = { good: '较干净', moderate: '一般', poor: '风险较高' }[res.level] || res.level;
    setText('riskLevel', lv);

    var badges = '<span class="badge ' + res.level + '">' + esc(lv) + '</span>';
    res.flags.forEach(function (f) {
      badges += '<span class="badge neutral">' + esc(f) + '</span>';
    });
    setHtml('riskFlags', badges);

    var desc = '综合 ' + sourceCount + ' 个公开数据源的标记计算，仅供参考，不代表任何平台的官方判定。';
    if (res.level === 'good') desc = '该 IP 未检出代理、VPN 或机房特征，属于较干净的住宅 / 企业网络。' + desc;
    else if (res.level === 'moderate') desc = '该 IP 存在部分非住宅网络特征，部分风控严格的平台可能会有所限制。' + desc;
    else desc = '该 IP 带有明显的代理、VPN 或机房特征，多数平台风控会将其视为高风险来源。' + desc;

    setText('riskDesc', desc);
    STATE.riskScore = res.score;
  }

  async function refreshRisk() {
    if (!STATE.mainIP) return;
    setHtml('riskScore', '<span class="skeleton">--</span>');
    setHtml('riskLevel', '<span class="skeleton">评估中</span>');

    var ip = STATE.mainIP;
    var cf = STATE.mainCf || {};
    var orgText = cf.asOrganization || '';
    var tasks = [];

    // ip-api.com 提供了 proxy / hosting / mobile 三项标记（仅 HTTP，故走代理）
    tasks.push(
      proxyJson('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=status,proxy,hosting,mobile,isp,org,as,asname,country,city,timezone,lat,lon', 15000)
        .then(function (d) { return d && d.status === 'success' ? d : null; })
        .catch(function () { return null; })
    );

    // ipapi.is 提供 bogon / 公司归属
    tasks.push(
      smartJson('https://api.ipapi.is/?q=' + encodeURIComponent(ip), 12000)
        .catch(function () { return null; })
    );

    var results = await Promise.all(tasks);
    var ipApi = results[0];
    var ipapiIs = results[1];

    var sourceCount = 0;
    var parts = { proxy: false, hosting: false, mobile: false, tor: false, bogon: false, orgText: orgText };

    if (ipApi) {
      sourceCount++;
      parts.proxy = !!ipApi.proxy;
      parts.hosting = !!ipApi.hosting;
      parts.mobile = !!ipApi.mobile;
      if (ipApi.org || ipApi.isp) parts.orgText = ipApi.org || ipApi.isp;
    }
    if (ipapiIs) {
      sourceCount++;
      if (ipapiIs.is_bogon) parts.bogon = true;
      if (ipapiIs.company) parts.orgText = ipapiIs.company;
    }

    // Tor 出口检测（check.torproject.org 无 CORS，走代理）
    try {
      var torData = await proxyJson('https://check.torproject.org/api/ip', 12000);
      if (torData && typeof torData.IsTor === 'boolean') {
        parts.tor = torData.IsTor;
        sourceCount++;
      }
    } catch (e) { /* 忽略 */ }

    if (sourceCount === 0) {
      setText('riskScore', '?');
      setText('riskLevel', '数据源不可用');
      setText('riskDesc', '所有公开数据源均无法访问，暂时无法评估。可稍后重试。');
      return;
    }

    var res = computeRisk(parts);
    paintRisk(res, sourceCount);
    STATE.riskParts = parts;

    // 同步补充概况卡片里的「运营网络」信息
    if (ipApi && !cf.asOrganization) {
      setText('ispValue', ipApi.isp || ipApi.org || '—');
    }
  }

  // ══════════════════ 概览：多源回显 ══════════════════

  var ECHO_SOURCES = [
    {
      name: '本站 · Cloudflare',
      tag: 'self',
      run: function () {
        return fetch('/api/ip', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json(); })
          .then(function (d) { return { ip: d.ip, loc: (d.country || '') + ' ' + (d.city || ''), isp: d.asOrganization }; });
      },
    },
    {
      name: 'Cloudflare 1.1.1.1',
      tag: 'direct',
      run: function () {
        return fetch('https://one.one.one.one/cdn-cgi/trace', { signal: AbortSignal.timeout(10000) })
          .then(function (r) { return r.text(); })
          .then(function (t) { return parseTrace(t, 'Cloudflare'); });
      },
    },
    {
      name: 'Cloudflare Edge',
      tag: 'direct',
      run: function () {
        return fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(10000) })
          .then(function (r) { return r.text(); })
          .then(function (t) { return parseTrace(t, 'Cloudflare'); });
      },
    },
    {
      name: 'ipify',
      tag: 'direct',
      run: function () {
        return fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(10000) })
          .then(function (r) { return r.json(); })
          .then(function (d) { return { ip: d.ip, loc: '', isp: 'ipify' }; });
      },
    },
    {
      name: 'ipinfo.io',
      tag: 'direct',
      run: function () {
        return fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(10000) })
          .then(function (r) { return r.json(); })
          .then(function (d) { return { ip: d.ip, loc: ((d.country || '') + ' ' + (d.city || '')).trim(), isp: d.org || '' }; });
      },
    },
    {
      name: 'ip.sb',
      tag: 'direct',
      run: function () {
        return fetch('https://api.ip.sb/ip', { signal: AbortSignal.timeout(10000) })
          .then(function (r) { return r.text(); })
          .then(function (t) { return { ip: t.trim(), loc: '', isp: 'ip.sb' }; });
      },
    },
    {
      name: 'icanhazip',
      tag: 'direct',
      run: function () {
        return fetch('https://icanhazip.com/', { signal: AbortSignal.timeout(10000) })
          .then(function (r) { return r.text(); })
          .then(function (t) { return { ip: t.trim(), loc: '', isp: 'icanhazip' }; });
      },
    },
    {
      name: 'ipapi.is',
      tag: 'direct',
      run: function () {
        return fetch('https://api.ipapi.is/', { signal: AbortSignal.timeout(10000) })
          .then(function (r) { return r.json(); })
          .then(function (d) { return { ip: d.ip, loc: (d.country || '') + ' ' + (d.city || ''), isp: d.asn || '' }; });
      },
    },
  ];

  function parseTrace(text, fallbackIsp) {
    var ip = '', loc = '', colo = '';
    String(text).split('\n').forEach(function (l) {
      if (l.indexOf('ip=') === 0) ip = l.slice(3);
      if (l.indexOf('loc=') === 0) loc = l.slice(4);
      if (l.indexOf('colo=') === 0) colo = l.slice(5);
    });
    return { ip: ip, loc: loc, isp: fallbackIsp + (colo ? ' · ' + colo : '') };
  }

  function queryAllSources() {
    var grid = $('sourceGrid');
    if (!grid) return;
    grid.innerHTML = '';

    ECHO_SOURCES.forEach(function (src) {
      var item = document.createElement('div');
      item.className = 'source-item';
      item.innerHTML = '<div class="source-name">' + esc(src.name) + '</div><div class="source-loading">查询中…</div>';
      grid.appendChild(item);

      src.run()
        .then(function (res) {
          var ipTxt = (res.ip || '').trim();
          if (!ipTxt || ipTxt === 'unknown') throw new Error('empty');
          var hasV6 = isIPv6(ipTxt);
          item.innerHTML =
            '<div class="source-name">' + esc(src.name) +
            '<span class="badge ' + (hasV6 ? 'info' : 'neutral') + '" style="padding:1px 7px;font-size:10px;">' +
            (hasV6 ? 'IPv6' : 'IPv4') + '</span></div>' +
            '<div class="source-ip">' + esc(ipTxt) + '</div>' +
            '<div class="source-loc">' + esc(res.loc || '') + (res.isp ? ' · ' + esc(res.isp) : '') + '</div>';
        })
        .catch(function () {
          item.innerHTML =
            '<div class="source-name">' + esc(src.name) + '</div>' +
            '<div class="source-error">不可达或查询失败</div>';
        });
    });
  }

  // ══════════════════ IP 详情 ══════════════════

  /**
   * 渲染键值表
   * 行格式：[标签, 值, 是否等宽字体] 或 ['__html__', 标签, 原始 HTML]
   */
  function kvRows(rows) {
    return rows.map(function (r) {
      if (r[0] === '__html__') return '<tr><th>' + esc(r[1]) + '</th><td>' + r[2] + '</td></tr>';
      var cls = r[2] ? ' class="mono"' : '';
      var v = (r[1] === null || r[1] === undefined || r[1] === '') ? '—' : r[1];
      return '<tr><th>' + esc(r[0]) + '</th><td' + cls + '>' + esc(v) + '</td></tr>';
    }).join('');
  }

  async function queryDetail(input) {
    var q = (input === undefined ? ($('detailInput') || {}).value : input) || '';
    q = String(q).trim();
    if (q === 'self') q = '';

    var target = q || STATE.mainIP;
    if (!target) {
      setHtml('detailBasic', kvRows([['状态', '还没有本机 IP，请输入要查询的 IP 或域名']]));
      return;
    }
    STATE.detailQuery = q;

    if ($('detailInput')) $('detailInput').value = q;

    setHtml('detailBasic', '<tr><th>状态</th><td><span class="status-dot loading"></span>查询中…</td></tr>');
    setHtml('detailGeo', '<tr><th>状态</th><td>查询中…</td></tr>');
    setHtml('detailSources', '<tr><th>数据源</th><td>查询中…</td></tr>');
    setHtml('detailFlags', '');
    if ($('rdapInput') && !$('rdapInput').value) $('rdapInput').value = q || target;

    var isIp = isIP(target);
    var tasks = [
      // ipwho.is 是少数支持「域名」查询的免费源，但并发易被限流，故仅在域名查询时调用
      isIp
        ? Promise.resolve(null)
        : smartJson('https://ipwho.is/' + encodeURIComponent(target), 12000)
            .then(function (d) { return (d && d.success !== false) ? d : null; })
            .catch(function () { return null; }),
      smartJson('https://api.ipapi.is/?q=' + encodeURIComponent(target), 12000)
        .then(function (d) { return (d && !d.error) ? d : null; })
        .catch(function () { return null; }),
      smartJson('https://ipinfo.io/' + encodeURIComponent(target) + '/json', 12000)
        .then(function (d) { return (d && d.ip) ? d : null; })
        .catch(function () { return null; }),
      isIp
        ? proxyJson('http://ip-api.com/json/' + encodeURIComponent(target) + '?fields=status,message,continent,country,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,reverse,query', 15000)
            .then(function (d) { return (d && d.status === 'success') ? d : null; })
            .catch(function () { return null; })
        : Promise.resolve(null),
      // 域名先经 DoH 解析，拿到 A 记录后再对首个地址做情报查询
      isIp
        ? Promise.resolve(null)
        : dohQuery(DOH_RESOLVERS[0], target, 'A')
            .then(function (d) {
              var arr = parseDohAnswer(d).filter(function (x) { return x.type === 1; });
              return arr.length ? arr.map(function (x) { return x.data; }) : null;
            })
            .catch(function () { return null; }),
    ];

    var res = await Promise.all(tasks);
    var who = res[0], apiIs = res[1], info = res[2], ipApi = res[3], resolvedIps = res[4];

    // 域名场景：用解析出的 IP 补一次情报查询，避免完全依赖单一数据源
    if (!isIp && resolvedIps && resolvedIps.length && !ipApi) {
      try {
        ipApi = await proxyJson('http://ip-api.com/json/' + encodeURIComponent(resolvedIps[0]) + '?fields=status,message,continent,country,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,reverse,query', 15000);
        if (ipApi && ipApi.status !== 'success') ipApi = null;
      } catch (e) { ipApi = null; }
    }

    if (!who && !apiIs && !info && !ipApi) {
      setHtml('detailBasic', kvRows([['状态', '所有数据源均不可达，请稍后重试']]));
      setHtml('detailGeo', kvRows([['状态', '—']]));
      setHtml('detailSources', kvRows([['数据源', '—']]));
      return;
    }

    var ip = (who && who.ip) || (apiIs && apiIs.ip) || (info && info.ip) || (ipApi && ipApi.query) || target;
    var conn = (who && who.connection) || {};

    // ── 基础与网络属性 ──
    var asnVal = '';
    if (conn.asn) asnVal = 'AS' + conn.asn;
    else if (apiIs && apiIs.asn) asnVal = apiIs.asn;
    else if (ipApi && ipApi.as) asnVal = ipApi.as;

    var netType = '未知';
    if (ipApi) {
      if (ipApi.mobile) netType = '移动网络';
      else if (ipApi.hosting) netType = '机房 / 数据中心';
      else netType = '住宅 / 企业宽带';
    }
    var rows = [
      ['查询目标', target + (q ? '' : '（本机出口）')],
      ['IP 地址', ip, 1],
      ['协议', isIPv6(ip) ? 'IPv6' : 'IPv4'],
      ['主机名 / 反解', (info && info.hostname) || (ipApi && ipApi.reverse) || '—'],
      ['ASN', asnVal, 1],
      ['ASN 名称', (ipApi && ipApi.asname) || (apiIs && apiIs.asn) || '—'],
      ['ISP / 组织', conn.isp || (ipApi && ipApi.isp) || (info && info.org) || '—'],
      ['公司 / 机构', (apiIs && apiIs.company) || (ipApi && ipApi.org) || '—'],
      ['网络类型', netType],
      ['Bogon / 保留地址', apiIs ? (apiIs.is_bogon ? '是' : '否') : '—'],
    ];

    if (STATE.mainIP && ip === STATE.mainIP && STATE.mainCf && STATE.mainCf.asn) {
      rows.push(['本机 ASN（CF）', 'AS' + String(STATE.mainCf.asn).replace(/^AS/i, ''), 1]);
    }

    // 域名查询：把 DoH 解析结果单独列出，便于核对真实来源
    if (!isIp && resolvedIps && resolvedIps.length) {
      rows.splice(1, 0, ['域名解析 (A)', resolvedIps.join(', '), 1]);
    }

    setHtml('detailBasic', kvRows(rows));

    // ── 地理位置 ──
    var lat = firstNum([who && who.latitude, apiIs && apiIs.lat, ipApi && ipApi.lat, info && info.loc && info.loc.split(',')[0]]);
    var lon = firstNum([who && who.longitude, apiIs && apiIs.lon, ipApi && ipApi.lon, info && info.loc && info.loc.split(',')[1]]);
    var tz = (who && who.timezone && who.timezone.id) || (apiIs && apiIs.timezone) || (ipApi && ipApi.timezone) || (info && info.timezone) || '';

    var geoRows = [
      ['国家 / 地区', (who && who.country) || (apiIs && apiIs.country) || (ipApi && ipApi.country) || (info && info.country) || '—'],
      ['国家代码', (who && who.country_code) || (info && info.country) || '—', 1],
      ['洲', (who && who.continent) || (ipApi && ipApi.continent) || '—'],
      ['省 / 州', (who && who.region) || (apiIs && apiIs.region) || (ipApi && ipApi.regionName) || (info && info.region) || '—'],
      ['城市', (who && who.city) || (apiIs && apiIs.city) || (ipApi && ipApi.city) || (info && info.city) || '—'],
      ['区 / 街道', (ipApi && ipApi.district) || '—'],
      ['邮政编码', (who && who.postal) || (ipApi && ipApi.zip) || (info && info.postal) || '—', 1],
      ['时区', tz, 1],
      ['经纬度', (lat !== null && lon !== null) ? lat + ', ' + lon : '—', 1],
    ];
    setHtml('detailGeo', kvRows(geoRows));

    if (lat !== null && lon !== null) {
      drawMap(lat, lon, (who && who.city) || (apiIs && apiIs.city) || (ipApi && ipApi.city) || '');
    } else {
      var mb = $('mapBox');
      if (mb) { mb.innerHTML = '<div class="map-hint">该 IP 未返回坐标信息</div>'; }
      setHtml('mapActions', '');
    }

    // ── 风险标记 ──
    var flags = [];
    if (apiIs && apiIs.is_bogon) flags.push(['bad', '保留 / Bogon 地址']);
    if (ipApi) {
      if (ipApi.proxy) flags.push(['bad', '代理 / VPN']);
      if (ipApi.hosting) flags.push(['warn', '机房 / 数据中心']);
      if (ipApi.mobile) flags.push(['info', '移动网络']);
      if (!ipApi.proxy && !ipApi.hosting && !ipApi.mobile) flags.push(['good', '未检出代理特征']);
    }
    if (flags.length === 0) flags.push(['neutral', '风险标记数据源不可用']);
    setHtml('detailFlags', flags.map(function (f) {
      return '<span class="badge ' + f[0] + '">' + esc(f[1]) + '</span>';
    }).join(''));

    // ── 多源位置对比 ──
    var cmp = [];
    if (who) cmp.push(['ipwho.is', ((who.country || '') + ' ' + (who.region || '') + ' ' + (who.city || '')).trim() || '—', conn.isp || '']);
    if (apiIs) cmp.push(['ipapi.is', ((apiIs.country || '') + ' ' + (apiIs.region || '') + ' ' + (apiIs.city || '')).trim() || '—', apiIs.asn || '']);
    if (ipApi) cmp.push(['ip-api.com', ((ipApi.country || '') + ' ' + (ipApi.regionName || '') + ' ' + (ipApi.city || '')).trim() || '—', ipApi.isp || '']);
    if (info) cmp.push(['ipinfo.io', ((info.country || '') + ' ' + (info.region || '') + ' ' + (info.city || '')).trim() || '—', info.org || '']);

    setHtml('detailSources', cmp.map(function (c) {
      return '<tr><th>' + esc(c[0]) + '</th><td>' + esc(c[1]) + (c[2] ? '<br><span style="font-size:11.5px;color:#a99cb8;">' + esc(c[2]) + '</span>' : '') + '</td></tr>';
    }).join('') || '<tr><th>数据源</th><td>—</td></tr>');

    STATE.info = { ip: ip, lat: lat, lon: lon, city: (who && who.city) || (ipApi && ipApi.city) || '' };
  }

  function firstNum(arr) {
    for (var i = 0; i < arr.length; i++) {
      var v = parseFloat(arr[i]);
      if (!isNaN(v) && isFinite(v)) return v;
    }
    return null;
  }

  // ══════════════════ 简易瓦片地图 ══════════════════

  function lon2tile(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
  function lat2tile(lat, z) {
    var r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  }

  function drawMap(lat, lon, label) {
    var box = $('mapBox');
    if (!box) return;

    var zoom = 10;
    var W = box.clientWidth || 600;
    var H = box.clientHeight || 260;

    var cx = lon2tile(lon, zoom);
    var cy = lat2tile(lat, zoom);
    var baseX = Math.floor(cx - 0.5);
    var baseY = Math.floor(cy - 0.5);

    var inner = '<div class="map-layer" style="position:absolute;left:0;top:0;width:768px;height:768px;will-change:transform;">';
    var loaded = 0, failed = 0;

    for (var gy = -1; gy <= 1; gy++) {
      for (var gx = -1; gx <= 1; gx++) {
        var tx = baseX + gx, ty = baseY + gy;
        var left = (gx + 1) * 256;
        var top = (gy + 1) * 256;
        inner += '<img class="tile" src="https://tile.openstreetmap.org/' + zoom + '/' + tx + '/' + ty + '.png" ' +
          'style="position:absolute;left:' + left + 'px;top:' + top + 'px;" alt="" loading="eager">';
      }
    }
    inner += '</div>';
    inner += '<div class="map-pin"></div>';
    inner += '<div class="map-attr">© OpenStreetMap</div>';

    box.innerHTML = inner;

    // 把目标点移到容器中心
    var pxX = (cx - baseX) * 256;
    var pxY = (cy - baseY) * 256;
    var layer = box.querySelector('.map-layer');
    var ox = W / 2 - pxX;
    var oy = H / 2 - pxY;
    layer.style.transform = 'translate(' + ox + 'px,' + oy + 'px)';

    // 瓦片加载失败时给出兜底提示
    var imgs = box.querySelectorAll('.tile');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener('load', function () { loaded++; });
      imgs[i].addEventListener('error', function () {
        failed++;
        if (failed >= 3 && loaded === 0) {
          var hint = document.createElement('div');
          hint.className = 'map-hint';
          hint.style.zIndex = '7';
          hint.textContent = '地图瓦片加载失败（可能受网络限制）';
          box.appendChild(hint);
        }
      });
    }

    setHtml('mapActions',
      esc(lat + ', ' + lon) + (label ? ' · ' + esc(label) : '') +
      ' &nbsp;·&nbsp; <a href="https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=12/' + lat + '/' + lon +
      '" target="_blank" rel="noopener noreferrer" style="color:#a855f7;">在 OSM 中打开 ↗</a>'
    );
  }

  // ══════════════════ RDAP / WHOIS ══════════════════

  async function queryRdap() {
    var q = ($('rdapInput') || {}).value || '';
    q = String(q).trim();
    if (!q) {
      q = STATE.detailQuery || STATE.mainIP;
    }
    if (!q) {
      setHtml('rdapResult', kvRows([['状态', '请输入域名或 IP']]));
      return;
    }
    if ($('rdapInput')) $('rdapInput').value = q;

    setHtml('rdapResult', '<tr><th>状态</th><td><span class="status-dot loading"></span>查询中…</td></tr>');
    if ($('rdapRawWrap')) $('rdapRawWrap').style.display = 'none';

    var kind = isIP(q) ? 'ip' : 'domain';
    var url = 'https://rdap.org/' + kind + '/' + encodeURIComponent(q);

    try {
      var data = await smartJson(url, 18000);
      renderRdap(data, kind);

      if ($('rdapRawWrap')) {
        $('rdapRawWrap').style.display = 'block';
        setText('rdapRaw', JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setHtml('rdapResult', kvRows([['状态', '查询失败：' + (e && e.message ? e.message : '未知错误')]]));
    }
  }

  function vcardName(entity) {
    if (!entity || !entity.vcardArray) return '';
    var arr = entity.vcardArray[1] || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i][0] === 'fn') return arr[i][3];
    }
    return '';
  }

  function renderRdap(d, kind) {
    var rows = [];
    rows.push(['查询对象', d.ldhName || d.handle || d.name || '—', 1]);

    if (kind === 'domain') {
      rows.push(['域名', d.ldhName || '—', 1]);
      rows.push(['注册状态', (d.status || []).join(', ') || '—']);
      if (d.events) {
        d.events.forEach(function (ev) {
          var map = { registration: '注册时间', expiration: '到期时间', 'last changed': '最后变更', 'last update of RDAP database': 'RDAP 数据更新' };
          var label = map[ev.eventAction] || ev.eventAction;
          rows.push([label, String(ev.eventDate || '').replace('T', ' ').replace('Z', ' UTC'), 1]);
        });
      }
      if (d.nameservers) {
        rows.push(['域名服务器', d.nameservers.map(function (n) { return n.ldhName || n.unicodeName || ''; }).filter(Boolean).join(', ') || '—', 1]);
      }
      var reg = (d.entities || []).filter(function (e) { return (e.roles || []).indexOf('registrar') >= 0; });
      if (reg.length) {
        rows.push(['注册商', vcardName(reg[0]) || '—']);
        var regId = (reg[0].publicIds || []).map(function (p) { return p.identifier; }).join(', ');
        if (regId) rows.push(['注册商 IANA ID', regId, 1]);
      }
      if (d.secureDNS) rows.push(['DNSSEC', d.secureDNS.delegationSigned ? '已启用' : '未启用']);
    } else {
      rows.push(['网段 (CIDR)', (d.cidr0_cidrs || []).map(function (c) { return c.v4prefix || c.v6prefix; }).filter(Boolean).join(', ') || d.handle || '—', 1]);
      rows.push(['IP 版本', (d.ipVersion || '').toUpperCase() || '—', 1]);
      rows.push(['起始地址', d.startAddress || '—', 1]);
      rows.push(['结束地址', d.endAddress || '—', 1]);
      rows.push(['分配类型', d.type || '—']);
      rows.push(['注册状态', (d.status || []).join(', ') || '—']);
      if (d.events) {
        d.events.forEach(function (ev) {
          var map = { registration: '分配时间', 'last changed': '最后变更', 'last update of RDAP database': 'RDAP 数据更新' };
          rows.push([map[ev.eventAction] || ev.eventAction, String(ev.eventDate || '').replace('T', ' ').replace('Z', ' UTC'), 1]);
        });
      }
      if (d.country) rows.push(['国家', d.country]);
      var orgEnt = (d.entities || []).find(function (e) { return (e.roles || []).indexOf('registrant') >= 0 || (e.roles || []).indexOf('administrative') >= 0; });
      if (orgEnt) rows.push(['机构', vcardName(orgEnt) || orgEnt.handle || '—']);
      if (d.port43) rows.push(['Whois 服务器', d.port43, 1]);
    }

    rows.push(['来源', (d.rdapConformance ? 'RDAP · ' : '') + (d.links && d.links[0] ? (function () {
      try { return new URL(d.links[0].href).host; } catch (e) { return '—'; }
    })() : '—'), 1]);

    setHtml('rdapResult', kvRows(rows));
  }

  // ══════════════════ 出口与网站分流 ══════════════════

  var EXIT_ENDPOINTS = [
    { name: 'Cloudflare', run: function () { return fetch('/api/ip', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json(); }).then(function (d) { return { ip: d.ip, extra: (d.city || '') + ' ' + (d.asOrganization || '') }; }); } },
    { name: 'ipify (v4)', run: function () { return fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json(); }).then(function (d) { return { ip: d.ip, extra: 'ipify' }; }); } },
    { name: 'ipify (v6)', run: function () { return fetch('https://api6.ipify.org?format=json', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json(); }).then(function (d) { return { ip: d.ip, extra: 'ipify v6' }; }); } },
    { name: 'ipinfo.io', run: function () { return fetch('https://ipinfo.io/ip', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.text(); }).then(function (t) { return { ip: t.trim(), extra: 'ipinfo' }; }); } },
    { name: 'icanhazip', run: function () { return fetch('https://icanhazip.com/', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.text(); }).then(function (t) { return { ip: t.trim(), extra: 'icanhazip' }; }); } },
    { name: 'ip.sb', run: function () { return fetch('https://api.ip.sb/ip', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.text(); }).then(function (t) { return { ip: t.trim(), extra: 'ip.sb' }; }); } },
    { name: 'Cloudflare 1.1.1.1', run: function () { return fetch('https://one.one.one.one/cdn-cgi/trace', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.text(); }).then(function (t) { return { ip: parseTrace(t, 'CF').ip, extra: 'colo ' + parseTrace(t, 'CF').loc }; }); } },
    { name: 'ipapi.is', run: function () { return fetch('https://api.ipapi.is/', { signal: AbortSignal.timeout(10000) }).then(function (r) { return r.json(); }).then(function (d) { return { ip: d.ip, extra: d.asn || '' }; }); } },
  ];

  // 注意：出口回显必须由浏览器直连目标，不能经 /api/netprobe 代理。
  // 经 CF 边缘代理发出时，目标看到的是 Cloudflare 的出口 IP，会让「出口分流」结果失真。

  async function queryExits() {
    var grid = $('exitGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var summary = $('exitSummary');
    summary.className = 'alert info';
    summary.innerHTML = '<span class="status-dot loading"></span>正在检测各站点出口…';

    var nodes = EXIT_ENDPOINTS.map(function (ep) {
      var item = document.createElement('div');
      item.className = 'source-item';
      item.innerHTML = '<div class="source-name">' + esc(ep.name) + '</div><div class="source-loading">检测中…</div>';
      grid.appendChild(item);
      return item;
    });

    var results = await Promise.all(EXIT_ENDPOINTS.map(function (ep) {
      return ep.run().then(function (r) {
        var ip = String(r.ip || '').trim();
        if (!ip || !isIP(ip)) throw new Error('bad');
        return { name: ep.name, ip: ip, extra: r.extra || '', ok: true };
      }).catch(function () {
        return { name: ep.name, ip: '', ok: false };
      });
    }));

    results.forEach(function (r, i) {
      if (r.ok) {
        nodes[i].innerHTML =
          '<div class="source-name">' + esc(r.name) + '</div>' +
          '<div class="source-ip">' + esc(r.ip) + '</div>' +
          '<div class="source-loc">' + esc(r.extra) + '</div>';
      } else {
        nodes[i].innerHTML =
          '<div class="source-name">' + esc(r.name) + '</div>' +
          '<div class="source-error">不可达</div>';
      }
    });

    // 按出口 IP 汇总
    var groups = {};
    results.forEach(function (r) {
      if (!r.ok) return;
      groups[r.ip] = (groups[r.ip] || 0) + 1;
    });
    var ips = Object.keys(groups).sort(function (a, b) { return groups[b] - groups[a]; });
    var okCount = results.filter(function (r) { return r.ok; }).length;

    if (ips.length === 0) {
      summary.className = 'alert bad';
      summary.innerHTML = '所有出口检测点均不可达，无法判断当前出口。可能是网络受限或代理拦截。';
    } else if (ips.length === 1) {
      summary.className = 'alert ok';
      summary.innerHTML = '✅ 出口一致：<b class="mono">' + esc(ips[0]) + '</b>，' + okCount + ' 个检测点全部返回同一地址，未发现分流失效。';
    } else {
      var detail = ips.map(function (ip) { return '<span class="mono">' + esc(ip) + '</span>（' + groups[ip] + ' 个检测点）'; }).join('、');
      summary.className = 'alert warn';
      summary.innerHTML = '⚠️ 检出 <b>' + ips.length + '</b> 个不同出口：' + detail +
        '。<br>出现多出口通常说明部分流量走了代理、部分直连，可检查分流规则。';
    }
  }

  // ══════════════════ DNS 解析（多 DoH）══════════════════

  var DOH_RESOLVERS = [
    { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query?name={q}&type={t}', accept: 'application/dns-json' },
    { name: 'Google', url: 'https://dns.google/resolve?name={q}&type={t}', accept: 'application/dns-json' },
    { name: '阿里 DNS', url: 'https://dns.alidns.com/resolve?name={q}&type={t}', accept: 'application/dns-json' },
    { name: 'DNSPod / 腾讯', url: 'https://doh.pub/dns-query?name={q}&type={t}', accept: 'application/dns-json' },
  ];

  var DNS_TYPE_ID = { A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28, SRV: 33, HTTPS: 65 };

  function dohQuery(resolver, name, type) {
    var url = resolver.url.replace('{q}', encodeURIComponent(name)).replace('{t}', encodeURIComponent(type));
    return withTimeout(
      fetch(url, { headers: { Accept: resolver.accept }, signal: AbortSignal.timeout(12000) }),
      13500
    )
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function () {
        // 回退到同源代理
        return dictQueryViaProxy(url);
      });
  }

  function dictQueryViaProxy(url) {
    return viaProxy(url, 14000).then(function (j) {
      try { return JSON.parse(j.body); } catch (e) { throw new Error('解析失败'); }
    });
  }

  function parseDohAnswer(d) {
    var out = [];
    if (d && d.Answer) {
      d.Answer.forEach(function (a) {
        out.push({ type: a.type, data: String(a.data || '').trim() });
      });
    }
    return out;
  }

  function dnsTypeName(id) {
    var map = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 65: 'HTTPS', 257: 'CAA' };
    return map[id] || ('TYPE' + id);
  }

  async function queryDns() {
    var name = (($('dnsInput') || {}).value || '').trim();
    var type = ($('dnsType') || {}).value || 'A';
    if (!name) return;

    var grid = $('dnsGrid');
    grid.innerHTML = '';
    setHtml('dnsVerdict', '');
    setHtml('dnsCname', kvRows([['CNAME 链', '解析中…']]));

    var nodes = DOH_RESOLVERS.map(function (rv) {
      var item = document.createElement('div');
      item.className = 'source-item';
      item.innerHTML = '<div class="source-name">' + esc(rv.name) + '</div><div class="source-loading">解析中…</div>';
      grid.appendChild(item);
      return item;
    });

    var results = await Promise.all(DOH_RESOLVERS.map(function (rv) {
      return dohQuery(rv, name, type).then(function (d) {
        return { name: rv.name, ok: true, answers: parseDohAnswer(d), status: d.Status };
      }).catch(function (e) {
        return { name: rv.name, ok: false, err: e && e.message };
      });
    }));

    var sigs = {};
    results.forEach(function (r, i) {
      if (!r.ok) {
        nodes[i].innerHTML = '<div class="source-name">' + esc(r.name) + '</div><div class="source-error">解析失败</div>';
        return;
      }
      if (!r.answers.length) {
        nodes[i].innerHTML = '<div class="source-name">' + esc(r.name) + '</div><div class="source-loc">无 ' + esc(type) + ' 记录' + (r.status === 3 ? '（NXDOMAIN）' : '') + '</div>';
        return;
      }
      var txt = r.answers.map(function (a) { return a.data; }).join(', ');
      // 一致性签名需先排序：同一组 IP 顺序不同不算差异（多解析器返回顺序本来就不固定）
      var sig = r.answers.map(function (a) { return a.data; }).sort().join('|');
      sigs[sig] = (sigs[sig] || 0) + 1;
      nodes[i].innerHTML =
        '<div class="source-name">' + esc(r.name) + '</div>' +
        '<div class="source-ip" style="font-size:12px;line-height:1.6;">' + esc(txt) + '</div>' +
        '<div class="source-loc">共 ' + r.answers.length + ' 条</div>';
    });

    var okCount = results.filter(function (r) { return r.ok; }).length;
    var sigKeys = Object.keys(sigs);

    var verdict = $('dnsVerdict');
    if (okCount === 0) {
      verdict.className = 'alert bad';
      verdict.innerHTML = '全部解析器均不可用，无法完成解析。';
    } else if (sigKeys.length <= 1) {
      verdict.className = 'alert ok';
      verdict.innerHTML = '✅ ' + okCount + ' 个解析器结果一致，未发现 DNS 污染或分流域名差异。';
    } else {
      verdict.className = 'alert warn';
      verdict.innerHTML = '⚠️ 不同解析器返回了 <b>' + sigKeys.length + '</b> 组不同结果，可能存在 DNS 污染、CDN 就近调度或解析器差异。';
    }

    // CNAME 链（仅当查询类型不是 CNAME 时额外查一次）
    if (type !== 'CNAME') {
      try {
        var c = await dohQuery(DOH_RESOLVERS[0], name, 'CNAME');
        var chain = parseDohAnswer(c).map(function (a) { return a.data; });
        setHtml('dnsCname', kvRows([
          ['CNAME 链', chain.length ? chain.join('  →  ') : '无（该域名不通过 CNAME 指向）', 1],
          ['解析器', DOH_RESOLVERS[0].name],
        ]));
      } catch (e) {
        setHtml('dnsCname', kvRows([['CNAME 链', '查询失败']]));
      }
    }
  }

  // ══════════════════ CDN 识别 ══════════════════

  var CDN_SIGNATURES = [
    { name: 'Cloudflare', cname: ['cdn.cloudflare.net', 'cloudflare.net', 'cloudflare.com', 'ns.cloudflare.com'], ip: [
      [0x68100000, 12], [0xac400000, 13], [0xa29e0000, 15], [0x6cbd0000, 18], [0xadf53000, 20],
      [0x67160000, 22], [0x671ec800, 22], [0x671f0400, 22], [0x8d656400, 18], [0xbe5df000, 20],
      [0xbc72c000, 17], [0xc5ee6000, 20], [0x83004800, 22],
    ] },
    { name: 'Fastly', cname: ['fastly.net', 'fastlylb.net'], ip: [[0x97650000, 16]] },
    { name: 'Akamai', cname: ['akamaiedge.net', 'akamai.net', 'akamaitechnologies.com', 'edgesuite.net', 'edgekey.net'], ip: [] },
    { name: 'Amazon CloudFront', cname: ['cloudfront.net'], ip: [] },
    { name: 'Microsoft Azure', cname: ['azureedge.net', 'azurefd.net', 'trafficmanager.net', 'msecnd.net'], ip: [] },
    { name: 'Google Cloud / GCP', cname: ['googleusercontent.com', 'googlevideo.com', 'googlehosted.com'], ip: [] },
    { name: 'Vercel', cname: ['vercel-dns.com', 'vercel.app', 'now.sh'], ip: [[0x4c4e0000, 16]] },
    { name: 'Netlify', cname: ['netlify.app', 'netlify.com'], ip: [] },
    { name: 'GitHub Pages', cname: ['github.io', 'github.com'], ip: [] },
    { name: '阿里云 CDN', cname: ['kunlun.com', 'kunlungr.com', 'alicdn.com', 'alikunlun.com', 'cdngslb.com'], ip: [] },
    { name: '腾讯云 CDN', cname: ['dnsv1.com', 'dnsv2.com', 'qcloud.com', 'cdntip.com', 'tencent-cloud.net'], ip: [] },
    { name: '百度云加速', cname: ['bdydns.cn', 'jomodns.com', 'bcebos.com', 'yunjiasu-cdn.net'], ip: [] },
    { name: '网宿科技', cname: ['wscdns.com', 'lxdns.com', 'chinanetcenter.com', 'wscloudcdn.com'], ip: [] },
    { name: '七牛云', cname: ['qiniudns.com', 'clouddn.com'], ip: [] },
    { name: '又拍云', cname: ['upyuncdn.com', 'upaiyun.com'], ip: [] },
    { name: '华为云 CDN', cname: ['hwclouds-dns.com', 'hwcdn.net'], ip: [] },
    { name: 'Bunny CDN', cname: ['b-cdn.net'], ip: [] },
    { name: 'Imperva / Incapsula', cname: ['incapdns.net'], ip: [] },
    { name: 'Sucuri', cname: ['sucuri.net', 'sucuridns.com'], ip: [] },
    { name: 'StackPath / Highwinds', cname: ['stackpathdns.com', 'hwcdn.net'], ip: [] },
    { name: 'CDN77', cname: ['cdn77.org', 'cdn77.com'], ip: [] },
    { name: 'Cloudflare Workers', cname: ['workers.dev'], ip: [] },
  ];

  function ipv4ToInt(ip) {
    var m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    return ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + (+m[4]);
  }

  function matchByIp(ip) {
    var v = ipv4ToInt(ip);
    if (v === null) return null;
    for (var i = 0; i < CDN_SIGNATURES.length; i++) {
      var sig = CDN_SIGNATURES[i];
      for (var j = 0; j < sig.ip.length; j++) {
        var base = sig.ip[j][0], bits = sig.ip[j][1];
        var mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        if (((v & mask) >>> 0) === ((base & mask) >>> 0)) return sig.name;
      }
    }
    return null;
  }

  async function queryCdn() {
    var name = (($('cdnInput') || {}).value || '').trim();
    if (!name) return;
    setHtml('cdnResult', kvRows([['状态', '检测中…']]));

    var rows = [];
    var cnameChain = [];
    var ips = [];
    var indentified = [];

    try {
      // 解析 CNAME 链
      var c = await dohQuery(DOH_RESOLVERS[0], name, 'CNAME');
      cnameChain = parseDohAnswer(c).map(function (a) { return a.data; });
    } catch (e) { /* 无 CNAME 属正常 */ }

    try {
      var a = await dohQuery(DOH_RESOLVERS[0], name, 'A');
      ips = parseDohAnswer(a).filter(function (x) { return x.type === 1; }).map(function (x) { return x.data; });
    } catch (e) { /* ignore */ }

    rows.push(['域名', name, 1]);
    rows.push(['A 记录', ips.length ? ips.join(', ') : '—', 1]);
    rows.push(['CNAME', cnameChain.length ? cnameChain.join('  →  ') : '无', 1]);

    // CNAME 特征匹配
    var cnameText = cnameChain.join(' ').toLowerCase();
    for (var i = 0; i < CDN_SIGNATURES.length; i++) {
      var sig = CDN_SIGNATURES[i];
      for (var j = 0; j < sig.cname.length; j++) {
        if (cnameText.indexOf(sig.cname[j]) >= 0) {
          if (indentified.indexOf(sig.name) < 0) indentified.push(sig.name);
          break;
        }
      }
    }

    // IP 段匹配
    ips.forEach(function (ip) {
      var hit = matchByIp(ip);
      if (hit && indentified.indexOf(hit) < 0) indentified.push(hit);
    });

    // HTTP 响应头特征
    var headerHints = [];
    try {
      var hostIp = ips[0];
      if (hostIp) {
        var r = await withTimeout(
          fetch('https://' + hostIp + '/', { method: 'HEAD', signal: AbortSignal.timeout(8000) }),
          9000
        );
        ['cf-ray', 'cf-cache-status', 'server', 'x-cache', 'x-served-by', 'x-amz-cf-id', 'x-azure-ref', 'via', 'x-akamai-transformed']
          .forEach(function (h) {
            var v = r.headers.get(h);
            if (v) headerHints.push(h + ': ' + v);
          });
        if (r.headers.get('cf-ray')) { if (indentified.indexOf('Cloudflare') < 0) indentified.push('Cloudflare'); }
        if (r.headers.get('x-served-by') || r.headers.get('x-cache')) { if (indentified.indexOf('Fastly') < 0) indentified.push('Fastly'); }
        if (r.headers.get('x-amz-cf-id')) { if (indentified.indexOf('Amazon CloudFront') < 0) indentified.push('Amazon CloudFront'); }
        if (r.headers.get('x-azure-ref')) { if (indentified.indexOf('Microsoft Azure') < 0) indentified.push('Microsoft Azure'); }
      }
    } catch (e) { /* CORS 或连接失败，忽略 */ }

    if (indentified.length) {
      rows.push(['__html__', '识别结果', indentified.map(function (n) {
        return '<span class="badge good">' + esc(n) + '</span>';
      }).join(' ')]);
    } else {
      rows.push(['__html__', '识别结果', '<span class="badge neutral">未匹配到已知 CDN 特征</span>' + (ips.length ? '<span class="badge info">自有 / 未知源站</span>' : '')]);
    }

    if (headerHints.length) {
      rows.push(['响应头特征', headerHints.join('\n'), 1]);
    }

    setHtml('cdnResult', kvRows(rows));
  }

  // ══════════════════ 常用服务连通性 ══════════════════

  var CONNECT_TARGETS = [
    { name: 'Cloudflare', tag: 'intl', url: 'https://one.one.one.one/favicon.ico' },
    { name: 'Google', tag: 'intl', url: 'https://www.google.com/favicon.ico' },
    { name: 'GitHub', tag: 'intl', url: 'https://github.githubassets.com/favicons/favicon.svg' },
    { name: 'Microsoft', tag: 'intl', url: 'https://www.microsoft.com/favicon.ico' },
    { name: 'Apple', tag: 'intl', url: 'https://www.apple.com/favicon.ico' },
    { name: 'Amazon', tag: 'intl', url: 'https://www.amazon.com/favicon.ico' },
    { name: '百度', tag: 'domestic', url: 'https://www.baidu.com/favicon.ico' },
    { name: '腾讯', tag: 'domestic', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico' },
    { name: '阿里云', tag: 'domestic', url: 'https://www.aliyun.com/favicon.ico' },
    { name: '知乎', tag: 'domestic', url: 'https://static.zhihu.com/heifetz/favicon.ico' },
  ];

  /**
   * 测量目标可达性与耗时
   * 使用 no-cors fetch：能 resolve 即说明 DNS + TCP + TLS 全部成功，
   * 只有网络层真正失败时才会 reject。
   * （不用 Image 测量，因为 img.onerror 无法区分「404」与「连接失败」，
   *   会把不可达的目标也判为连通。）
   */
  function measureReach(url, timeoutMs) {
    var ms = timeoutMs || 8000;
    var start = performance.now();
    return withTimeout(
      fetch(url, {
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        signal: AbortSignal.timeout(ms),
      }),
      ms + 800
    )
      .then(function () { return { ms: Math.round(performance.now() - start), ok: true }; })
      .catch(function () { return { ms: null, ok: false }; });
  }

  async function queryPorts() {
    var grid = $('portGrid');
    if (!grid) return;

    var items = grid.querySelectorAll('.source-item');
    if (!items.length) {
      grid.innerHTML = '';
      CONNECT_TARGETS.forEach(function (t) {
        var d = document.createElement('div');
        d.className = 'source-item';
        d.innerHTML = '<div class="source-name">' + esc(t.name) + '</div><div class="source-loading">等待检测…</div>';
        grid.appendChild(d);
      });
      items = grid.querySelectorAll('.source-item');
    }

    await Promise.all(CONNECT_TARGETS.map(async function (t, i) {
      var node = items[i];
      node.innerHTML = '<div class="source-name">' + esc(t.name) + '</div><div class="source-loading">检测中…</div>';
      var r = await measureReach(t.url, 8000);
      var cls = r.ok ? 'good' : 'bad';
      var label = r.ok ? (r.ms < 300 ? '通畅' : (r.ms < 1000 ? '较慢' : '很慢')) : '不可达';
      node.innerHTML =
        '<div class="source-name">' + esc(t.name) + '<span class="badge ' + cls + '" style="padding:1px 7px;font-size:10px;">' + esc(label) + '</span></div>' +
        '<div class="source-ip" style="font-size:15px;">' + (r.ok ? r.ms + '<span class="ping-ms">ms</span>' : '—') + '</div>' +
        '<div class="source-loc">' + (t.tag === 'domestic' ? '国内' : '国际') + '</div>';
    }));
  }

  // ══════════════════ 延迟测试（多轮采样）══════════════════

  var PING_TARGETS = [
    { name: '百度', tag: 'domestic', url: 'https://www.baidu.com/favicon.ico' },
    { name: '淘宝', tag: 'domestic', url: 'https://www.taobao.com/favicon.ico' },
    { name: '哔哩哔哩', tag: 'domestic', url: 'https://www.bilibili.com/favicon.ico' },
    { name: '微博', tag: 'domestic', url: 'https://weibo.com/favicon.ico' },
    { name: '抖音', tag: 'domestic', url: 'https://www.douyin.com/favicon.ico' },
    { name: '微信', tag: 'domestic', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico' },
    { name: '京东', tag: 'domestic', url: 'https://www.jd.com/favicon.ico' },
    { name: '知乎', tag: 'domestic', url: 'https://static.zhihu.com/heifetz/favicon.ico' },
    { name: 'GitHub', tag: 'intl', url: 'https://github.githubassets.com/favicons/favicon.svg' },
    { name: 'Cloudflare', tag: 'intl', url: 'https://www.cloudflare.com/favicon.ico' },
    { name: 'jsDelivr', tag: 'intl', url: 'https://cdn.jsdelivr.net/favicon.ico' },
    { name: 'Google', tag: 'intl', url: 'https://www.google.com/favicon.ico' },
    { name: 'YouTube', tag: 'intl', url: 'https://www.youtube.com/favicon.ico' },
    { name: 'Cloudinary', tag: 'intl', url: 'https://cloudinary.com/favicon.ico' },
  ];

  var ROUNDS = 3;

  async function testAllLatency() {
    var grid = $('pingGrid');
    if (!grid) return;
    grid.innerHTML = '';

    PING_TARGETS.forEach(function (t) {
      var item = document.createElement('div');
      item.className = 'ping-item testing';
      item.innerHTML =
        '<div class="ping-name">' + esc(t.name) +
        '<span class="ping-tag ' + t.tag + '">' + (t.tag === 'domestic' ? '国内' : '国际') + '</span></div>' +
        '<div class="ping-value testing">测试中…</div>' +
        '<div class="ping-lines">第 1 / ' + ROUNDS + ' 轮</div>';
      grid.appendChild(item);
    });

    var items = grid.querySelectorAll('.ping-item');

    await Promise.all(PING_TARGETS.map(async function (t, i) {
      var node = items[i];
      var valEl = node.querySelector('.ping-value');
      var lineEl = node.querySelector('.ping-lines');
      var samples = [];

      for (var r = 0; r < ROUNDS; r++) {
        lineEl.textContent = '第 ' + (r + 1) + ' / ' + ROUNDS + ' 轮';
        if (r > 0) await sleep(160);
        var res = await measureReach(t.url, 8000);
        if (res.ok) samples.push(res.ms);
      }

      node.classList.remove('testing');
      node.classList.add('done');

      if (!samples.length) {
        valEl.className = 'ping-value timeout';
        valEl.textContent = '超时';
        lineEl.textContent = '全部超时';
        return;
      }

      samples.sort(function (a, b) { return a - b; });
      var median = samples[Math.floor(samples.length / 2)];
      valEl.className = 'ping-value ' + (median < 100 ? 'good' : (median < 300 ? 'ok' : 'bad'));
      valEl.innerHTML = median + '<span class="ping-ms">ms</span>';
      lineEl.textContent = '样本 ' + samples.join(' / ') + ' ms' + (samples.length < ROUNDS ? '（' + (ROUNDS - samples.length) + ' 次超时）' : '');
    }));
  }

  // ══════════════════ 全球 Ping（Globalping）══════════════════

  var GP_LOCATIONS = {
    world: [{ magic: 'world' }],
    CN: [{ country: 'CN' }],
    US: [{ country: 'US' }],
    DE: [{ country: 'DE' }],
    JP: [{ country: 'JP' }],
    SG: [{ country: 'SG' }],
  };

  /** 创建 Globalping 测量任务 */
  async function createGpMeasurement(body) {
    var r = await withTimeout(
      fetch('https://api.globalping.io/v1/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      }),
      16000
    );
    var j = await r.json();
    if (!r.ok) {
      throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
    }
    return j;
  }

  async function queryGlobalping() {
    var target = (($('gpTarget') || {}).value || '').trim();
    var type = ($('gpType') || {}).value || 'ping';
    if (!target) return;

    var btn = document.querySelector('[data-action="queryGlobalping"]');
    if (btn) btn.disabled = true;

    var status = $('gpStatus');
    var grid = $('gpGrid');
    grid.innerHTML = '';
    status.className = 'alert info';
    status.innerHTML = '<span class="status-dot loading"></span>正在创建测量任务…';

    var body = {
      type: type,
      target: target,
      locations: GP_LOCATIONS[STATE.gpLocation] || GP_LOCATIONS.world,
      limit: STATE.gpLocation === 'world' ? 6 : 4,
    };

    try {
      var created;
      try {
        created = await createGpMeasurement(body);
      } catch (firstErr) {
        // `magic: world` 偶发不被接受时，回退到多国探针
        if (STATE.gpLocation === 'world') {
          body.locations = [{ country: 'US' }, { country: 'DE' }, { country: 'JP' }, { country: 'SG' }];
          body.limit = 4;
          created = await createGpMeasurement(body);
        } else {
          throw firstErr;
        }
      }

      status.innerHTML = '<span class="status-dot loading"></span>测量进行中…（探针 ' + (created.probesCount || '?') + ' 个）';

      var result = null;
      for (var i = 0; i < 30; i++) {
        await sleep(2000);
        var m = await fetch('https://api.globalping.io/v1/measurements/' + created.id, {
          signal: AbortSignal.timeout(12000),
        }).then(function (r) { return r.json(); });
        if (m && m.status === 'finished') { result = m; break; }
      }

      if (!result) {
        status.className = 'alert warn';
        status.innerHTML = '测量超时未返回结果，请稍后重试。';
        return;
      }

      renderGlobalping(result);
    } catch (e) {
      status.className = 'alert bad';
      status.innerHTML = '测量失败：' + esc(e && e.message ? e.message : '未知错误') + '<br>Globalping 匿名接口有速率限制，请稍后再试。';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderGlobalping(m) {
    var status = $('gpStatus');
    var grid = $('gpGrid');
    var results = (m.results) || [];

    if (!results.length) {
      status.className = 'alert warn';
      status.innerHTML = '未获得任何探针返回结果。';
      return;
    }

    status.className = 'alert info';
    status.innerHTML = '测量完成，共 ' + results.length + ' 个探针返回结果。';

    results.forEach(function (r) {
      var probe = r.probe || {};
      var geo = probe.city ? (probe.city + ', ') : '';
      geo += (probe.country || probe.continent || '').toUpperCase();
      if (probe.network) geo += ' · ' + probe.network;

      var node = document.createElement('div');
      node.className = 'source-item';

      var body = '';
      // 注意：Globalping 的探针结果不一定带 status 字段，判定成败要看 result 是否存在
      if (!r.result) {
        body = '<div class="source-error">' + esc(r.status || '未返回结果') + '</div>';
      } else if (m.type === 'ping') {
        var stats = r.result.stats || {};
        var avg = stats.avg !== undefined && stats.avg !== null ? Math.round(stats.avg) : null;
        var loss = stats.loss !== undefined && stats.loss !== null ? stats.loss : null;
        var cls = avg === null ? 'bad' : (avg < 100 ? 'good' : (avg < 300 ? 'warn' : 'bad'));
        body =
          '<div class="source-ip" style="font-size:19px;">' + (avg === null ? '—' : avg + '<span class="ping-ms">ms</span>') +
          ' <span class="badge ' + cls + '" style="padding:1px 7px;font-size:10px;">丢包 ' + (loss === null ? '?' : Math.round(loss * 100) + '%') + '</span></div>' +
          '<div class="source-loc">最小 ' + (stats.min != null ? Math.round(stats.min) : '—') +
          ' / 平均 ' + (stats.avg != null ? Math.round(stats.avg) : '—') +
          ' / 最大 ' + (stats.max != null ? Math.round(stats.max) : '—') + ' ms' +
          (stats.rcv != null && stats.total != null ? ' · 收包 ' + stats.rcv + '/' + stats.total : '') + '</div>';
      } else if (m.type === 'http') {
        var totalMs = r.result.timings && r.result.timings.total !== undefined ? Math.round(r.result.timings.total) : null;
        body = '<div class="source-ip" style="font-size:17px;">' + (totalMs === null ? '—' : totalMs + '<span class="ping-ms">ms</span>') + '</div>' +
          '<div class="source-loc">HTTP ' + (r.result.statusCode || '—') + ' · TLS ' + (r.result.tls ? '是' : '否') + '</div>';
      } else if (m.type === 'traceroute') {
        var hops = r.result.hops || [];
        body = '<div class="source-ip" style="font-size:14px;">' + hops.length + ' 跳</div>' +
          '<div class="source-loc">' + hops.slice(0, 4).map(function (h) {
            return h.resolvedAddress || h.address || '';
          }).filter(Boolean).join(' → ') + '</div>';
      } else {
        body = '<div class="source-loc">无结果</div>';
      }

      node.innerHTML = '<div class="source-name">' + esc(geo) + '</div>' + body;
      grid.appendChild(node);
    });
  }

  // ══════════════════ 事件绑定 ══════════════════

  function bindGlobalEvents() {
    document.addEventListener('click', function (e) {
      var tabEl = e.target.closest('#tabs .tab');
      if (tabEl) { switchTab(tabEl.dataset.tab); return; }

      var chip = e.target.closest('.chip');
      if (chip) {
        var parent = chip.parentNode;
        if (parent && parent.id === 'detailChips') {
          var chips = parent.querySelectorAll('.chip');
          for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
          chip.classList.add('active');
          var v = chip.dataset.ip;
          if ($('detailInput')) $('detailInput').value = v === 'self' ? '' : v;
          queryDetail(v === 'self' ? '' : v);
          if ($('rdapInput')) $('rdapInput').value = v === 'self' ? (STATE.mainIP || '') : v;
          return;
        }
        if (parent && parent.id === 'gpcChips') {
          var gchips = parent.querySelectorAll('.chip');
          for (var k = 0; k < gchips.length; k++) gchips[k].classList.remove('active');
          chip.classList.add('active');
          STATE.gpLocation = chip.dataset.loc;
          return;
        }
      }

      var el = e.target.closest('[data-action]');
      if (!el) return;

      switch (el.dataset.action) {
        case 'queryAllSources': queryAllSources(); break;
        case 'testAllLatency': testAllLatency(); break;
        case 'refreshRisk': refreshRisk(); break;
        case 'queryDetail': queryDetail(); break;
        case 'queryRdap': queryRdap(); break;
        case 'queryExits': queryExits(); break;
        case 'queryDns': queryDns(); break;
        case 'queryCdn': queryCdn(); break;
        case 'queryPorts': queryPorts(); break;
        case 'queryGlobalping': queryGlobalping(); break;
        case 'refreshBrowser': window.IPBrowser && window.IPBrowser.refresh(); break;
        case 'queryWebrtc': window.IPBrowser && window.IPBrowser.webrtc(); break;
        case 'queryPermissions': window.IPBrowser && window.IPBrowser.permissions(); break;
        case 'queryAi': window.IPAi && window.IPAi.queryAi(); break;
        case 'queryStatus': window.IPAi && window.IPAi.queryStatus(); break;
      }
    });

    // 回车触发
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var id = e.target && e.target.id;
      if (id === 'detailInput') queryDetail();
      else if (id === 'rdapInput') queryRdap();
      else if (id === 'dnsInput') queryDns();
      else if (id === 'cdnInput') queryCdn();
      else if (id === 'gpTarget') queryGlobalping();
    });
  }

  // ══════════════════ 启动 ══════════════════

  function boot() {
    bindGlobalEvents();
    getMainIP();
    testAllLatency();

    var hash = (location.hash || '').replace('#', '');
    if (hash && document.getElementById('panel-' + hash)) {
      switchTab(hash);
    } else {
      switchTab('overview');
    }
  }

  // 暴露给其他模块复用
  window.IPApp = {
    esc: esc, $: $, setHtml: setHtml, setText: setText,
    sleep: sleep, withTimeout: withTimeout,
    viaProxy: viaProxy, proxyJson: proxyJson, directJson: directJson,
    smartJson: smartJson, smartText: smartText,
    isIPv4: isIPv4, isIPv6: isIPv6, isIP: isIP,
    measureReach: measureReach, parseTrace: parseTrace,
    switchTab: switchTab,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
