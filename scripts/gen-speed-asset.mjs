/**
 * 生成下载测速用的大文件 spd-asset.bin（默认 10 MB 随机字节）。
 *
 * 该文件体积较大，不适合入库，因此用脚本按需生成。
 * speed-app.js 的下载测速会以同源方式反复请求 /spd-asset.bin。
 *
 * 用法：
 *     node scripts/gen-speed-asset.mjs        # 生成 10 MB
 *     node scripts/gen-speed-asset.mjs 20     # 生成 20 MB
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const mb = Number(process.argv[2] || 10);
if (!Number.isFinite(mb) || mb <= 0 || mb > 100) {
  console.error('参数必须是 0-100 之间的数字（单位 MB）');
  process.exit(1);
}

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'spd-asset.bin');
const size = Math.round(mb * 1024 * 1024);

writeFileSync(target, randomBytes(size));
console.log(`✅ 已生成 ${target}`);
console.log(`   大小：${(statSync(target).size / 1048576).toFixed(2)} MB`);
