// Cloudflare Pages Function — 下载测速端点（同源，非流式返回字节块）
// 路由：/speedtest-down?bytes=N  →  返回 N 字节 application/octet-stream
//
// 重要约束（实测）：
// - 当前 Pages Functions 运行时**不支持流式 Response body**（ReadableStream / TransformStream 均抛 1101）
// - 非流式响应体上限约 25MB，超过会被截断成空 body（HTTP 200 + size 0）
// ⇒ 故采用「非流式分块」：端点单次最多返回 25MB，由客户端循环请求多块并累加字节来测速
// - 内容用固定字节填充（buf.fill），零 CPU 开销，测速数据内容无关紧要
// - bytes 超过上限时硬截断到 25MB，避免返回空 body 误导客户端

const MAX_BYTES = 25 * 1024 * 1024; // 25MB 硬上限（低于非流式截断阈值，留余量）

export async function onRequest(context) {
  const { request } = context;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(request.url);
  let bytes = parseInt(url.searchParams.get('bytes') || '8388608', 10);
  if (!Number.isFinite(bytes) || bytes <= 0) bytes = 8388608;
  if (bytes > MAX_BYTES) bytes = MAX_BYTES; // 超出截断，不发空 body
  bytes = Math.floor(bytes);

  // 非流式：分配 buffer 并填充固定字节（memset，零 CPU 随机开销）
  const buf = new Uint8Array(bytes);
  buf.fill(0x41);

  return new Response(buf, {
    headers: {
      ...cors,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bytes),
      'Cache-Control': 'no-store',
      'X-Speedtest': 'down',
    },
  });
}
