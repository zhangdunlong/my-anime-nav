/**
 * 生成后台管理密码的 salt 与 SHA-256 哈希，并打印写入 KV 所需的命令。
 *
 * 后台密码不存明文：KV 中保存的是 sha256(密码 + salt) 的十六进制值，
 * 校验逻辑见 functions/api/data.js。首次部署或忘记密码时用本脚本重置。
 *
 * 用法：
 *     node scripts/set-admin-password.mjs <你的新密码>
 */
import { createHash, randomBytes } from 'node:crypto';

const pwd = process.argv[2];
if (!pwd) {
  console.error('用法：node scripts/set-admin-password.mjs <你的新密码>');
  process.exit(1);
}
if (pwd.length < 4 || pwd.length > 128) {
  console.error('密码长度需在 4-128 位之间（与后端校验保持一致）');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = createHash('sha256').update(pwd + salt).digest('hex');
const ns = '<YOUR_KV_NAMESPACE_ID>';

console.log('\n将下面两条命令里的 ' + ns + ' 换成你的 KV 命名空间 ID，然后执行：\n');
console.log(`npx wrangler kv key put --namespace-id=${ns} admin_salt "${salt}" --remote`);
console.log(`npx wrangler kv key put --namespace-id=${ns} admin_password "${hash}" --remote`);
console.log('\n完成后刷新页面，用新密码登录后台即可。\n');
