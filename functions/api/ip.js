// Cloudflare Pages Function - 返回客户端真实 IP
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

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
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

export async function onRequest(context) {
  const { request, env } = context;
  const headers = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const ip = request.headers.get('CF-Connecting-IP') ||
              request.headers.get('X-Real-IP') ||
              request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
              'unknown';

  const cf = request.cf || {};

  return new Response(JSON.stringify({
    ip: ip,
    colo: cf.colo || '',
    country: cf.country || '',
    city: cf.city || '',
    region: cf.region || '',
    timezone: cf.timezone || '',
    asn: cf.asn || '',
    asOrganization: cf.asOrganization || '',
    httpProtocol: cf.httpProtocol || ''
  }), {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
