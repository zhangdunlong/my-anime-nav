/**
 * Cloudflare Pages Function — 站点数据云端同步 API
 * 
 * GET  /api/data                                          读取数据（公开）
 * POST /api/data { action: "login", password }            登录 → { success, token }
 * POST /api/data { token, data, catOrder }                同步数据
 * POST /api/data { token, action: "changePassword", currentPassword, newPassword }
 * POST /api/data { token, action: "logout" }              登出
 *
 * 安全特性：
 * - SHA-256 + salt 密码哈希（Web Crypto API，不使用自定义哈希）
 * - Token 认证（24h TTL，存储在 KV，单次登录单 token）
 * - CSRF 防护（POST 请求强制校验 Origin/Referer）
 * - 速率限制（基于 IP + 时间窗口）
 * - 请求体大小限制（1MB）
 * - 严格 CORS（白名单）
 * - 数据结构校验
 * - 常量时间比较（防时序攻击）
 * - 错误信息脱敏
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
  maxRequests: 30,
  loginMaxRequests: 10, // 登录接口更严格：每分钟最多 10 次
};

const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB
const TOKEN_TTL = 86400; // 24 小时

// ===== 工具函数 =====

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')
    || 'unknown';
}

function getOrigin(request) {
  return request.headers.get('Origin') || '';
}

function corsHeaders(request, env) {
  const origin = getOrigin(request);
  const allowOrigin = isAllowedOrigin(origin, request, env) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/** 常量时间字符串比较（防时序攻击） */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** SHA-256 哈希（使用 Web Crypto API） */
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** 生成加密安全的随机 token */
function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** CSRF 防护：POST 请求必须有合法的 Origin 或 Referer */
function isCSRFSafe(request, env) {
  const origin = getOrigin(request);
  if (origin) return isAllowedOrigin(origin, request, env);
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return isAllowedOrigin(new URL(referer).origin, request, env);
    } catch (e) {
      return false;
    }
  }
  // 无 Origin 和 Referer 的 POST 请求 → 拒绝（防 CSRF）
  return false;
}

/** 校验数据结构 */
function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const keys = Object.keys(data);
  if (keys.length > 200) return false;
  for (const cat of keys) {
    if (typeof cat !== 'string' || cat.length > 50) return false;
    if (!Array.isArray(data[cat])) return false;
    if (data[cat].length > 500) return false;
    for (const site of data[cat]) {
      if (!site || typeof site !== 'object') return false;
      if (typeof site.name !== 'string' || site.name.length > 200) return false;
      if (typeof site.url !== 'string' || site.url.length > 2000) return false;
      if (!/^https?:\/\//i.test(site.url) && !/^data:text\/html/i.test(site.url) && !/^(chrome|edge|file|ftp):\/\//i.test(site.url)) return false;
      if (site.desc && (typeof site.desc !== 'string' || site.desc.length > 500)) return false;
      if (site.img && (typeof site.img !== 'string' || site.img.length > 100000)) return false;
    }
  }
  return true;
}

function validateCatOrder(order, validKeys) {
  if (!Array.isArray(order)) return false;
  if (order.length > 200) return false;
  return order.every(c => typeof c === 'string' && validKeys.includes(c));
}

/** JSON 响应快捷函数 */
function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// ===== 主处理函数 =====

export async function onRequest(context) {
  const { request, env } = context;
  const headers = corsHeaders(request, env);

  // OPTIONS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // 只允许 GET 和 POST
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ error: '不支持的请求方法' }, 405, headers);
  }

  try {
    // ===== GET — 读取数据（公开） =====
    if (request.method === 'GET') {
      const sites = await env.NAV_DATA.get('sites', 'json');
      const catOrderRaw = await env.NAV_DATA.get('catOrder');
      let catOrder = null;
      try { catOrder = catOrderRaw ? JSON.parse(catOrderRaw) : null; } catch (e) { /* ignore */ }

      return jsonResponse({
        sites: sites || null,
        catOrder: catOrder || null,
      }, 200, headers);
    }

    // ===== POST — 写入/认证 =====

    // --- CSRF 防护：所有 POST 请求必须有合法 Origin ---
    if (!isCSRFSafe(request, env)) {
      return jsonResponse({ error: '跨站请求被拒绝' }, 403, headers);
    }

    // --- 请求体大小限制 ---
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
      return jsonResponse({ error: '请求体过大' }, 413, headers);
    }

    // --- 解析请求体 ---
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: '请求体格式错误' }, 400, headers);
    }

    // --- 速率限制 ---
    const clientIP = getClientIP(request);
    const isLoginRequest = body.action === 'login';
    const rateKey = `ratelimit:${isLoginRequest ? 'login' : 'write'}:${clientIP}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;
    const maxReq = isLoginRequest ? RATE_LIMIT.loginMaxRequests : RATE_LIMIT.maxRequests;

    const rateDataRaw = await env.NAV_DATA.get(rateKey);
    let rateData = { count: 0, windowStart: now };
    if (rateDataRaw) {
      try {
        rateData = JSON.parse(rateDataRaw);
        if (rateData.windowStart < windowStart) {
          rateData = { count: 0, windowStart: now };
        }
      } catch (e) {
        rateData = { count: 0, windowStart: now };
      }
    }

    rateData.count += 1;
    if (rateData.count > maxReq) {
      return jsonResponse({ error: '请求过于频繁，请稍后再试' }, 429, {
        ...headers,
        'Retry-After': '60',
      });
    }

    // 异步更新速率计数器
    env.NAV_DATA.put(rateKey, JSON.stringify(rateData), { expirationTtl: 120 });

    // ===== action: login — 登录 =====
    if (body.action === 'login') {
      const password = body.password;
      if (!password || typeof password !== 'string' || password.length > 128) {
        return jsonResponse({ error: '密码格式错误' }, 400, headers);
      }

      const storedHash = await env.NAV_DATA.get('admin_password');
      const salt = await env.NAV_DATA.get('admin_salt');

      if (!storedHash || !salt || storedHash.indexOf('$h$') === 0) {
        // 旧版 DJB2 哈希或未初始化 → 需要通过 CLI 重新设置
        return jsonResponse({ error: '系统需要初始化，请联系管理员' }, 500, headers);
      }

      const inputHash = await sha256(password + salt);

      if (!safeCompare(inputHash, storedHash)) {
        return jsonResponse({ error: '密码错误' }, 403, headers);
      }

      // 生成 token 并存储
      const token = generateToken();
      await env.NAV_DATA.put('session_' + token, JSON.stringify({
        ip: clientIP,
        ts: now,
      }), { expirationTtl: TOKEN_TTL });

      return jsonResponse({ success: true, token: token }, 200, headers);
    }

    // ===== 以下操作都需要 token 认证 =====
    const token = body.token;
    if (!token || typeof token !== 'string' || token.length > 128) {
      return jsonResponse({ error: '未登录或会话已过期' }, 401, headers);
    }

    // 验证 token
    const session = await env.NAV_DATA.get('session_' + token);
    if (!session) {
      return jsonResponse({ error: '未登录或会话已过期' }, 401, headers);
    }

    // ===== action: logout — 登出 =====
    if (body.action === 'logout') {
      await env.NAV_DATA.delete('session_' + token);
      return jsonResponse({ success: true }, 200, headers);
    }

    // ===== action: changePassword — 修改密码 =====
    if (body.action === 'changePassword') {
      const currentPassword = body.currentPassword;
      const newPassword = body.newPassword;

      if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length > 128) {
        return jsonResponse({ error: '当前密码格式错误' }, 400, headers);
      }
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4 || newPassword.length > 128) {
        return jsonResponse({ error: '新密码格式不合法（4-128 位）' }, 400, headers);
      }

      const storedHash = await env.NAV_DATA.get('admin_password');
      const salt = await env.NAV_DATA.get('admin_salt');

      if (!storedHash || !salt) {
        return jsonResponse({ error: '系统未初始化' }, 500, headers);
      }

      // 验证当前密码
      const currentHash = await sha256(currentPassword + salt);
      if (!safeCompare(currentHash, storedHash)) {
        return jsonResponse({ error: '当前密码错误' }, 403, headers);
      }

      // 生成新 salt 并存储新哈希
      const newSaltArr = new Uint8Array(16);
      crypto.getRandomValues(newSaltArr);
      let newSalt = '';
      for (let i = 0; i < newSaltArr.length; i++) {
        newSalt += newSaltArr[i].toString(16).padStart(2, '0');
      }
      const newHash = await sha256(newPassword + newSalt);

      await env.NAV_DATA.put('admin_password', newHash);
      await env.NAV_DATA.put('admin_salt', newSalt);

      // 销毁所有旧 session（强制重新登录）
      // 注意：KV 不支持前缀删除，旧 token 会在 TTL 到期后自动失效

      return jsonResponse({ success: true }, 200, headers);
    }

    // ===== 默认：同步数据 =====
    const { data, catOrder } = body;

    if (data !== undefined) {
      if (!validateData(data)) {
        return jsonResponse({ error: '数据格式校验失败' }, 400, headers);
      }
      await env.NAV_DATA.put('sites', JSON.stringify(data));
    }

    if (catOrder !== undefined) {
      const currentData = data || await env.NAV_DATA.get('sites', 'json') || {};
      const validKeys = Object.keys(currentData);
      if (!validateCatOrder(catOrder, validKeys)) {
        return jsonResponse({ error: '分类顺序格式错误' }, 400, headers);
      }
      await env.NAV_DATA.put('catOrder', JSON.stringify(catOrder));
    }

    return jsonResponse({ success: true }, 200, headers);
  } catch (e) {
    console.error('API Error:', e.message);
    return jsonResponse({ error: '服务器内部错误' }, 500, headers);
  }
}
