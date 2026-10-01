/**
 * Cloudflare Pages Function — 网络诊断代理
 * GET /api/netprobe?url=<encoded-url>
 *
 * 用途：为 IP 工具箱（/ip.html）代理第三方网络诊断接口，解决两类问题：
 *   1. 跨域（CORS）受限的目标，例如仅提供 HTTP 的 ip-api.com
 *   2. 国内网络直连不稳定、但 Cloudflare 边缘可正常访问的目标（状态页 / DoH）
 *
 * 安全策略：
 *   - 严格域名白名单（精确匹配 + 受控后缀匹配），不构成开放代理
 *   - SSRF 防护（禁止私网 / 环回 / 链路本地地址）
 *   - 速率限制（每 IP 每分钟 60 次，KV 计数）
 *   - 请求超时 12 秒、响应体上限 1 MB
 *   - 错误信息脱敏
 *   - 仅允许 GET；GET 无副作用，故不校验 CSRF
 */
// ===== 跨域来源配置 =====
// 同源请求（浏览器访问本站下自己的页面）一律放行，所以部署到任意域名都能开箱即用。
// 如需额外放行其他来源（本地开发端口、自定义子域等），在 Cloudflare Pages 控制台
// 「Settings → Environment variables」新增一项，逗号分隔：
//     ALLOWED_ORIGINS = http://localhost:5173,https://your-domain.com
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
];

function allowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || '';
  return DEFAULT_ALLOWED_ORIGINS.concat(
    raw.split(',').map((s) => s.trim()).filter(Boolean)
  );
}

/** 来源白名单判定：同源始终放行，其余比对可配置名单 */
function isAllowedOrigin(origin, request, env) {
  if (!origin) return false;
  try {
    if (origin === new URL(request.url).origin) return true;
  } catch (e) { /* ignore */ }
  return allowedOrigins(env).some(
    (allowed) =>
      origin === allowed ||
      origin.endsWith('.' + allowed.replace(/^https?:\/\//, ''))
  );
}

// ── 精确白名单 ────────────────────────────────────────────────
const ALLOWED_HOSTS = new Set([
  // IP 归属 / 风险标记
  'ip-api.com',
  'api.ipapi.is',
  'ipwho.is',
  'ipinfo.io',
  'api.ip.sb',
  // RDAP / WHOIS
  'rdap.org',
  'rdap.apnic.net',
  'rdap.arin.net',
  'rdap.ripe.net',
  'rdap.lacnic.net',
  'rdap.afrinic.net',
  'rdap.verisign.com',
  'rdap.identitydigital.services',
  // DNS over HTTPS
  'cloudflare-dns.com',
  'dns.google',
  'dns.quad9.net',
  'doh.pub',
  'dns.alidns.com',
  // 网络测量
  'api.globalping.io',
  'check.torproject.org',
  // 服务状态（Statuspage / 自建）
  'status.openai.com',
  'status.anthropic.com',
  'status.claude.com',
  'status.deepseek.com',
  'status.x.ai',
  'status.perplexity.ai',
  'status.groq.com',
  'status.mistral.ai',
  'status.suno.com',
  'status.midjourney.com',
  'www.cloudflarestatus.com',
  'www.githubstatus.com',
  'status.cloud.google.com',
  'status.aws.amazon.com',
  'www.vercel-status.com',
  'status.linear.app',
  'status.cursor.com',
  'status.huggingface.co',
  'status.twilio.com',
  'status.stripe.com',
  'status.figma.com',
  'status.notion.so',
  'status.slack.com',
  'status.zoom.us',
]);

// ── 受控后缀白名单（第三方状态托管平台）────────────────────────
const ALLOWED_SUFFIXES = [
  '.statuspage.io',
  '.instatus.com',
  '.status.io',
];

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function getOrigin(request) {
  return request.headers.get('Origin') || '';
}

function corsHeaders(request, env) {
  const origin = getOrigin(request);
  const allowOrigin = origin ? (isAllowedOrigin(origin, request, env) ? origin : 'null') : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/** 目标域名是否在白名单内 */
function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return true;
  // 允许白名单域名的子域（例如 www.dns.google）
  for (const allowed of ALLOWED_HOSTS) {
    if (host.endsWith('.' + allowed)) return true;
  }
  return ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** SSRF 防护：禁止私网 / 环回 / 链路本地 / 保留地址 */
function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host === '::1' || host === '::') return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
  if (host.startsWith('::ffff:')) return true;

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = m.slice(1).map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }

  if (/^\d+$/.test(host)) {
    const num = parseInt(host, 10);
    if (num >= 0 && num <= 0xffffffff) {
      const a = (num >>> 24) & 0xff;
      const b = (num >>> 16) & 0xff;
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
    }
  }

  if (/^0x[0-9a-f]+/i.test(host) || /^0[0-7]+\./.test(host)) return true;

  // IPv6 私网 fc00::/7 与链路本地 fe80::/10
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return true;

  return false;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const headers = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'GET') {
    return json({ error: '仅支持 GET 请求' }, 405, headers);
  }

  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url');

  if (!target) {
    return json({ error: '缺少 url 参数' }, 400, headers);
  }

  let u;
  try {
    u = new URL(target);
  } catch (e) {
    return json({ error: '无效的 url' }, 400, headers);
  }

  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return json({ error: '仅支持 http/https 协议' }, 400, headers);
  }

  if (!isAllowedHost(u.hostname)) {
    return json({ error: '该目标不在允许列表中' }, 403, headers);
  }

  if (isPrivateHost(u.hostname)) {
    return json({ error: '该目标不在允许列表中' }, 403, headers);
  }

  // 速率限制
  if (env && env.NAV_DATA) {
    const clientIP =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      'unknown';
    const rateKey = `ratelimit:netprobe:${clientIP}`;
    const now = Date.now();

    let rateData = { count: 0, windowStart: now };
    const raw = await env.NAV_DATA.get(rateKey);
    if (raw) {
      try {
        rateData = JSON.parse(raw);
        if (rateData.windowStart < now - RATE_LIMIT.windowMs) {
          rateData = { count: 0, windowStart: now };
        }
      } catch (e) {
        rateData = { count: 0, windowStart: now };
      }
    }

    rateData.count += 1;
    if (rateData.count > RATE_LIMIT.maxRequests) {
      return new Response(
        JSON.stringify({ error: '请求过于频繁，请稍后再试' }),
        {
          status: 429,
          headers: {
            ...headers,
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': '60',
          },
        }
      );
    }

    await env.NAV_DATA.put(rateKey, JSON.stringify(rateData), {
      expirationTtl: 120,
    });
  }

  // 透传少量客户端请求头（部分接口依赖 Accept / User-Agent）
  const upstreamHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: request.headers.get('X-Netprobe-Accept') || 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };

  const started = Date.now();
  try {
    const resp = await fetch(u.toString(), {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return json({ error: '目标响应过大' }, 502, headers);
    }

    // 以文本返回；前端按需 JSON.parse
    const body = new TextDecoder('utf-8').decode(buf);

    return json(
      {
        status: resp.status,
        ok: resp.ok,
        contentType: resp.headers.get('content-type') || '',
        elapsed: Date.now() - started,
        body: body,
      },
      200,
      headers
    );
  } catch (e) {
    const isTimeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return json(
      { error: isTimeout ? '目标响应超时' : '无法连接到目标' },
      502,
      headers
    );
  }
}
