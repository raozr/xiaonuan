import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function parseEnv(content) {
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^["']|["']$/g, '');
  }
  return env;
}

async function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return parseEnv(await readFile(path, 'utf8'));
}

function checkTcp(name, host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok, message) => {
      socket.destroy();
      resolve({ name, ok, message });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true, `${host}:${port}`));
    socket.once('timeout', () => done(false, `${host}:${port} timeout`));
    socket.once('error', (err) => done(false, `${host}:${port} ${err.code ?? err.message}`));
  });
}

async function checkHttp(name, url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { name, ok: res.ok, message: `${res.status} ${url}` };
  } catch (err) {
    return { name, ok: false, message: `${url} ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    clearTimeout(timer);
  }
}

function print(result) {
  const mark = result.ok ? 'OK ' : 'ERR';
  console.log(`[${mark}] ${result.name}: ${result.message}`);
}

const rootEnv = await loadEnvFile(join(root, '.env'));
const appEnv = await loadEnvFile(join(root, 'apps/xiaonuan-app/.env.development.local'));
const gatewayPort = Number(rootEnv.PORT || 3000);
const voicePort = Number(rootEnv.VOICE_SERVICE_PORT || 8000);
const apiUrl = appEnv.EXPO_PUBLIC_API_URL || '(not set; app will derive Expo host in dev)';

console.log('XiaoNuan local doctor\n');
console.log(`[INFO] EXPO_PUBLIC_API_URL: ${apiUrl}`);

const results = [
  { name: '.env', ok: existsSync(join(root, '.env')), message: existsSync(join(root, '.env')) ? 'present' : 'missing' },
  await checkTcp('PostgreSQL', '127.0.0.1', 5432),
  await checkTcp('Redis', '127.0.0.1', 6379),
  await checkHttp('Qdrant', rootEnv.QDRANT_URL || 'http://127.0.0.1:6333'),
  await checkHttp('Gateway health', `http://127.0.0.1:${gatewayPort}/health`),
  await checkHttp('Voice service health', `http://127.0.0.1:${voicePort}/health`),
];

for (const result of results) print(result);

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.log('\nSome checks failed. Start local infrastructure with: docker compose up -d postgres qdrant redis');
  process.exitCode = 1;
}

