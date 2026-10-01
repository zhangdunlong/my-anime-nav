/**
 * IP 工具箱 — AI 平台连通性 与 服务状态聚合
 * 配套 ip.html 使用
 */
(function () {
  'use strict';

  var A = window.IPApp;
  if (!A) return;
  var esc = A.esc, $ = A.$, setHtml = A.setHtml, setText = A.setText;
  var sleep = A.sleep, withTimeout = A.withTimeout, viaProxy = A.viaProxy, proxyJson = A.proxyJson;

  // ══════════════════ AI 平台连通性 ══════════════════

  var AI_TARGETS = [
    { name: 'ChatGPT', tag: 'OpenAI', url: 'https://chatgpt.com/favicon.ico' },
    { name: 'Claude', tag: 'Anthropic', url: 'https://claude.ai/favicon.ico' },
    { name: 'Grok', tag: 'xAI', url: 'https://grok.com/favicon.ico' },
    { name: 'Gemini', tag: 'Google', url: 'https://gemini.google.com/favicon.ico' },
    { name: 'Perplexity', tag: 'Perplexity', url: 'https://www.perplexity.ai/favicon.ico' },
    { name: 'DeepSeek', tag: '深度求索', url: 'https://www.deepseek.com/favicon.ico' },
    { name: '通义千问', tag: '阿里云', url: 'https://chat.qwen.ai/favicon.ico' },
    { name: 'Kimi', tag: '月之暗面', url: 'https://kimi.moonshot.cn/favicon.ico' },
    { name: 'Copilot', tag: 'Microsoft', url: 'https://copilot.microsoft.com/favicon.ico' },
    { name: 'Mistral', tag: 'Mistral', url: 'https://chat.mistral.ai/favicon.ico' },
  ];

  /**
   * 用 no-cors 请求探测可达性
   * 能 resolve 说明 DNS + TCP + TLS 全部成功；reject 则说明网络层不可达
   */
  function probeReach(url, ms) {
    var start = performance.now();
    return withTimeout(
      fetch(url, {
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        signal: AbortSignal.timeout(ms || 8000),
      }),
      (ms || 8000) + 800
    )
      .then(function () { return { ok: true, ms: Math.round(performance.now() - start) }; })
      .catch(function () { return { ok: false, ms: null }; });
  }

  async function queryAi() {
    var grid = $('aiGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var nodes = AI_TARGETS.map(function (t) {
      var item = document.createElement('div');
      item.className = 'ping-item testing';
      item.innerHTML =
        '<div class="ping-name">' + esc(t.name) +
        '<span class="ping-tag intl">' + esc(t.tag) + '</span></div>' +
        '<div class="ping-value testing">检测中…</div>';
      grid.appendChild(item);
      return item;
    });

    var verdict = $('aiVerdict');
    verdict.className = 'alert info';
    verdict.innerHTML = '<span class="status-dot loading"></span>正在从本机探测各 AI 平台…';

    var results = await Promise.all(AI_TARGETS.map(function (t) {
      return probeReach(t.url, 8000);
    }));

    var reachable = 0;

    results.forEach(function (r, i) {
      var node = nodes[i];
      var valEl = node.querySelector('.ping-value');
      node.classList.remove('testing');
      node.classList.add('done');

      if (r.ok) {
        reachable++;
        valEl.className = 'ping-value ' + (r.ms < 500 ? 'good' : (r.ms < 2000 ? 'ok' : 'bad'));
        valEl.innerHTML = r.ms + '<span class="ping-ms">ms</span>';
      } else {
        valEl.className = 'ping-value timeout';
        valEl.textContent = '不可达';
      }
    });

    var total = AI_TARGETS.length;
    if (reachable === total) {
      verdict.className = 'alert ok';
      verdict.innerHTML = '✅ 全部 ' + total + ' 个 AI 平台资源均可建立连接，当前网络对这些服务的访问没有明显阻碍。';
    } else if (reachable === 0) {
      verdict.className = 'alert bad';
      verdict.innerHTML = '❌ 所有 AI 平台均不可达。可能是网络中断、代理异常，或当前网络对境外服务整体阻断。';
    } else {
      var failed = AI_TARGETS.filter(function (t, i) { return !results[i].ok; }).map(function (t) { return t.name; });
      verdict.className = 'alert warn';
      verdict.innerHTML = '⚠️ ' + reachable + ' / ' + total + ' 个平台可达。不可达：<b>' + esc(failed.join('、')) +
        '</b>。<br>部分平台（如 ChatGPT、Claude、Gemini）在境内网络中通常需要代理才能访问。';
    }
  }

  // ══════════════════ 服务状态聚合 ══════════════════

  var STATUS_PAGES = [
    { name: 'OpenAI', host: 'https://status.openai.com' },
    { name: 'Anthropic', host: 'https://status.anthropic.com' },
    { name: 'Claude', host: 'https://status.claude.com' },
    { name: 'DeepSeek', host: 'https://status.deepseek.com' },
    { name: 'xAI (Grok)', host: 'https://status.x.ai' },
    { name: 'Perplexity', host: 'https://status.perplexity.ai' },
    { name: 'Groq', host: 'https://status.groq.com' },
    { name: 'Mistral', host: 'https://status.mistral.ai' },
    { name: 'Cloudflare', host: 'https://www.cloudflarestatus.com' },
    { name: 'GitHub', host: 'https://www.githubstatus.com' },
    { name: 'Vercel', host: 'https://www.vercel-status.com' },
    { name: 'Cursor', host: 'https://status.cursor.com' },
    { name: 'Hugging Face', host: 'https://status.huggingface.co' },
  ];

  var INDICATOR = {
    none: { label: '运行正常', level: 'good' },
    minor: { label: '轻微故障', level: 'warn' },
    major: { label: '严重故障', level: 'bad' },
    critical: { label: '服务中断', level: 'bad' },
    maintenance: { label: '维护中', level: 'info' },
  };

  async function fetchStatus(page) {
    var url = page.host + '/api/v2/status.json';
    // 取回完整代理响应，以便区分「接口非标准」与「被拦截 / 暂时取不到」
    var res = await viaProxy(url, 15000);

    if (res.status >= 500) {
      var e5 = new Error('upstream');
      e5.unavailable = true;
      throw e5;
    }

    var d = null;
    try { d = JSON.parse(res.body); } catch (e) { d = null; }

    if (!d || !d.status || !d.status.indicator) {
      // 403 / 404 或返回 HTML，说明该平台没有可用的标准 Statuspage JSON 接口
      var err = new Error('nonstandard');
      err.nonstandard = true;
      throw err;
    }

    return {
      name: page.name,
      host: page.host,
      indicator: d.status.indicator,
      description: d.status.description || '',
      pageName: (d.page && d.page.name) || page.name,
      updatedAt: (d.page && d.page.updated_at) || '',
      ok: true,
    };
  }

  async function queryStatus() {
    var grid = $('statusGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var nodes = STATUS_PAGES.map(function (p) {
      var item = document.createElement('div');
      item.className = 'source-item';
      item.innerHTML = '<div class="source-name">' + esc(p.name) + '</div><div class="source-loading">获取中…</div>';
      grid.appendChild(item);
      return item;
    });

    var results = await Promise.all(STATUS_PAGES.map(function (p) {
      return fetchStatus(p).catch(function (e) {
        var msg = (e && e.message) || '';
        var nonstandard = (e && e.nonstandard) || /不是合法 JSON/.test(msg) || /不在允许列表/.test(msg);
        return { name: p.name, host: p.host, ok: false, nonstandard: nonstandard, msg: msg };
      });
    }));

    var problems = [];

    results.forEach(function (r, i) {
      var node = nodes[i];
      if (!r.ok) {
        var label = r.nonstandard ? '需手动查看' : '暂时取不到';
        var note = r.nonstandard
          ? '该平台状态页未提供标准 JSON 接口，只能点击前往查看'
          : '网络未能获取，可稍后重试或直接访问状态页';
        node.innerHTML =
          '<div class="source-name">' + esc(r.name) + '</div>' +
          '<div><span class="badge neutral">' + esc(label) + '</span></div>' +
          '<div class="source-loc">' + esc(note) + '</div>' +
          '<div class="source-loc"><a href="' + esc(r.host) + '" target="_blank" rel="noopener noreferrer" style="color:#a855f7;">打开状态页 ↗</a></div>';
        return;
      }

      var meta = INDICATOR[r.indicator] || { label: r.description || '状态描述缺失', level: 'neutral' };
      var desc = r.description && r.description !== meta.label ? r.description : '';
      node.innerHTML =
        '<div class="source-name">' + esc(r.name) + '</div>' +
        '<div><span class="badge ' + meta.level + '">' + esc(meta.label) + '</span></div>' +
        (desc ? '<div class="source-loc">' + esc(desc) + '</div>' : '') +
        (r.updatedAt ? '<div class="source-loc" style="font-size:10px;">更新 ' + esc(String(r.updatedAt).replace('T', ' ').replace('Z', '')) + '</div>' : '');

      if (r.indicator !== 'none' && r.indicator !== 'unknown') {
        problems.push(r);
      }
    });

    // 详情区：列出有问题的服务
    var detail = $('statusDetail');
    if (problems.length === 0) {
      detail.innerHTML = '<div class="alert ok">✅ 所有已接入的平台当前均报告运行正常。</div>';
    } else {
      detail.innerHTML = problems.map(function (r) {
        var meta = INDICATOR[r.indicator] || { level: 'neutral', label: r.indicator };
        return '<div class="alert ' + (meta.level === 'info' ? 'info' : (meta.level === 'warn' ? 'warn' : 'bad')) + '">' +
          '<b>' + esc(r.name) + '：' + esc(meta.label) + '</b><br>' + esc(r.description || '') +
          '<br><a href="' + esc(r.host) + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">查看状态页 ↗</a>' +
          '</div>';
      }).join('');
    }
  }

  // ══════════════════ 编排 ══════════════════

  var state = { inited: false };

  function init() {
    if (state.inited) return;
    state.inited = true;
    queryAi();
    queryStatus();
  }

  window.IPAi = {
    init: init,
    queryAi: queryAi,
    queryStatus: queryStatus,
    get inited() { return state.inited; },
  };
})();
