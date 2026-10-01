// Cloudflare Pages Function — 上传测速端点（同源，接收并确认 POST 字节）
// 路由：POST /speedtest-up  →  完整接收请求体后返回 200
//
// 设计要点：
// - 同源，浏览器无须额外 TCP/TLS 握手
// - 服务端必须真实读完整个请求体（await request.arrayBuffer），客户端上行才算完成
// - 不存储、不处理内容，仅消费字节，保证测速准确

export async function onRequest(context) {
  const { request } = context;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  // 强制完整接收请求体（不处理内容，仅消费），确保客户端真实上行被服务器接收
  const buf = await request.arrayBuffer();

  return new Response(JSON.stringify({ ok: true, received: buf.byteLength }), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Speedtest': 'up',
    },
  });
}
