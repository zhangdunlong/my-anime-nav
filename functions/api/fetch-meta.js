/**
 * Cloudflare Pages Function — 抓取网页元数据
 * GET /api/fetch-meta?url=https://example.com
 *
 * 安全特性：
 * - SSRF 防护（禁止访问私有/内网 IP）
 * - 速率限制（每 IP 每分钟最多 20 次）
 * - 请求超时（5 秒）
 * - 错误信息脱敏（不泄露内部细节）
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

const RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 20,
};

function getOrigin(request) {
  return request.headers.get('Origin') || '';
}

/** CSRF 防护：检查 Origin/Referer */
function isCSRFSafe(request, env) {
  const origin = request.headers.get('Origin');
  if (origin) return isAllowedOrigin(origin, request, env);
  const referer = request.headers.get('Referer');
  if (referer) {
    try { return isAllowedOrigin(new URL(referer).origin, request, env); } catch (e) { return false; }
  }
  // GET 请求无 Origin/Referer 时允许（可能是直接访问）
  if (request.method === 'GET') return true;
  return false;
}

function corsHeaders(request, env) {
  const origin = getOrigin(request);
  const allowOrigin = origin
    ? (isAllowedOrigin(origin, request, env) ? origin : 'null')
    : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * SSRF 防护：检查 URL 是否指向私有/内网地址
 * 阻止对 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 等的访问
 */
function isPrivateUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const hostname = u.hostname;

    // 阻止 localhost 和 IP 字面量
    if (hostname === 'localhost' || hostname === '::1') return true;

    // 阻止 .local / .internal 域名
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;

    // 阻止 IPv6 [::] 和 [::ffff:*] (IPv6-mapped IPv4)
    if (hostname === '[::]' || hostname === '::') return true;
    if (hostname.startsWith('::ffff:') || hostname.startsWith('[::ffff:')) return true;

    // 阻止 IPv4 私有地址（支持标准、十进制、八进制、十六进制格式）
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (a === 10) return true;                    // 10.0.0.0/8
      if (a === 127) return true;                   // 127.0.0.0/8 (loopback)
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true;      // 192.168.0.0/16
      if (a === 169 && b === 254) return true;      // 169.254.0.0/16 (link-local)
      if (a === 0) return true;                     // 0.0.0.0/8
    }

    // 阻止十进制 IP（如 2130706433 = 127.0.0.1）
    if (/^\d+$/.test(hostname)) {
      const num = parseInt(hostname, 10);
      if (num >= 0 && num <= 0xFFFFFFFF) {
        const a = (num >>> 24) & 0xFF;
        const b = (num >>> 16) & 0xFF;
        if (a === 10 || a === 127 || a === 0) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 169 && b === 254) return true;
      }
    }

    // 阻止八进制 IP（如 0177.0.0.1）
    if (/^0[0-7]+\./.test(hostname)) return true;

    // 阻止十六进制 IP（如 0x7f.0x0.0x0.0x1）
    if (/^0x[0-9a-f]+/i.test(hostname)) return true;

    // 阻止 IPv6 私有地址 (fc00::/7, ::1, fe80::/10)
    if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80')) return true;

    return false;
  } catch (e) {
    return true; // URL 解析失败，保守拒绝
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headers });
  }

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  // CSRF 防护
  if (!isCSRFSafe(request, env)) {
    return new Response(JSON.stringify({ error: '跨站请求被拒绝' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return new Response(JSON.stringify({ error: '无效的 URL' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  // SSRF 防护：阻止对内网地址的请求
  if (isPrivateUrl(targetUrl)) {
    return new Response(JSON.stringify({ error: '不允许访问该地址' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  // 速率限制
  if (env && env.NAV_DATA) {
    const clientIP = request.headers.get('CF-Connecting-IP')
      || request.headers.get('X-Forwarded-For')
      || 'unknown';
    const rateKey = `ratelimit:meta:${clientIP}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;

    let rateData = { count: 0, windowStart: now };
    const rateRaw = await env.NAV_DATA.get(rateKey);
    if (rateRaw) {
      try {
        rateData = JSON.parse(rateRaw);
        if (rateData.windowStart < windowStart) {
          rateData = { count: 0, windowStart: now };
        }
      } catch (e) {
        rateData = { count: 0, windowStart: now };
      }
    }

    rateData.count += 1;
    if (rateData.count > RATE_LIMIT.maxRequests) {
      return new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试' }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    await env.NAV_DATA.put(rateKey, JSON.stringify(rateData), {
      expirationTtl: 120,
    });
  }

  try {
    const resp = await fetch(targetUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavBot/1.0)' },
      redirect: 'follow',
    });

    // 限制读取的内容大小（防止超大页面耗尽内存）
    const html = await resp.text().then(text => text.substring(0, 100000));

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const desc = descMatch ? descMatch[1].trim() : '';

    return new Response(JSON.stringify({ title, description: desc, url: targetUrl }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // 脱敏：不泄露内部错误细节
    return new Response(JSON.stringify({ error: '抓取失败，请检查目标网址是否可访问' }), {
      status: 502,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}
