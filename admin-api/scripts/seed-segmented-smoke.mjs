#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function readEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function postJson(baseUrl, endpoint, token, body) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // Ignore parse errors and report raw body.
  }

  return {
    httpStatus: response.status,
    elapsedMs: Date.now() - startedAt,
    json,
    raw,
  };
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const raw = await response.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // Ignore parse errors and report raw body.
  }

  if (!response.ok || !json?.data?.accessToken) {
    const reason = json?.message ?? raw;
    throw new Error(`Login failed (${response.status}): ${String(reason).slice(0, 280)}`);
  }
  return json.data.accessToken;
}

async function main() {
  const apiBaseUrl = process.env.SEED_SMOKE_API_BASE_URL ?? 'http://localhost:3000/api';
  const root = process.cwd();
  const envFile = path.join(root, '.env');
  const fileEnv = readEnv(envFile);

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? fileEnv.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@local.dev';
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? fileEnv.SEED_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin2026!';

  const steps = [
    ['run-access', '/admin-tools/seed/run', { targets: ['access'] }],
    ['run-attributes', '/admin-tools/seed/run', { targets: ['sizes', 'colors'] }],
    ['run-currencies', '/admin-tools/seed/run', { targets: ['currencies'] }],
    ['run-categories', '/admin-tools/seed/run', { targets: ['categories'] }],
    ['run-tags', '/admin-tools/seed/run', { targets: ['tags'] }],
    ['run-products', '/admin-tools/seed/run', { targets: ['products'] }],
    ['run-sales', '/admin-tools/seed/run', { targets: ['coupons', 'orders'] }],
    ['run-logistics', '/admin-tools/seed/run', { targets: ['carriers', 'shipments'] }],
    ['run-notifications', '/admin-tools/seed/run', { targets: ['notifications'] }],
    ['clean-notifications', '/admin-tools/seed/clean', { mode: 'seed', force: false, targets: ['notifications'] }],
    ['clean-logistics', '/admin-tools/seed/clean', { mode: 'seed', force: false, targets: ['shipments', 'carriers'] }],
    ['clean-sales', '/admin-tools/seed/clean', { mode: 'seed', force: false, targets: ['orders', 'coupons'] }],
  ];

  const token = await login(apiBaseUrl, superAdminEmail, superAdminPassword);
  let failures = 0;

  for (const [name, endpoint, payload] of steps) {
    const result = await postJson(apiBaseUrl, endpoint, token, payload);
    const appStatus = result.json?.statusCode;
    const mode = result.json?.data?.mode ?? '-';
    const targets = Array.isArray(result.json?.data?.targetsExecuted)
      ? result.json.data.targetsExecuted.join(',')
      : '-';

    const ok = result.httpStatus >= 200 && result.httpStatus < 300 && Number(appStatus) === result.httpStatus;
    if (!ok) failures += 1;

    console.log(
      `${ok ? 'OK' : 'FAIL'} | ${name} | http=${result.httpStatus} | ${result.elapsedMs}ms | mode=${mode} | targets=${targets}`,
    );

    if (!ok) {
      const detail = result.json?.message ?? result.raw;
      console.log(`  ERROR: ${String(detail).slice(0, 300)}`);
    }
  }

  console.log(`SUMMARY total=${steps.length} failed=${failures}`);
  process.exit(failures === 0 ? 0 : 2);
}

main().catch((error) => {
  console.error(`FAIL | seed-smoke | ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
