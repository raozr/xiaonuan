#!/usr/bin/env tsx
/**
 * Reset database: drop old tables, push new schema, recreate Qdrant collections.
 * Usage: npx tsx packages/prisma/scripts/reset-database.ts
 */

import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load env from project root
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const prismaPkgDir = path.resolve(scriptDir, '..');
const rootDir = path.resolve(prismaPkgDir, '../..');
config({ path: path.join(rootDir, '.env') });

const prisma = new PrismaClient();
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const OLD_COLLECTION = 'family_memories';
const NEW_COLLECTION = 'pairing_memories';

async function main() {
  console.log('[reset] Starting database reset...\n');

  await dropOldTables();
  await pushNewSchema();
  await migrateQdrant();

  console.log('\n[reset] Done ✅');
}

// ─── Step 1: Drop old tables in reverse FK dependency order ──────────────────
async function dropOldTables() {
  console.log('[reset] Step 1: Dropping old tables...');

  // Order matters: children first (referenced by session_messages, etc.),
  // then parents. CASCADE handles most of it, but some tables need explicit cleanup.
  const oldTables = [
    'session_messages',
    'checkpoints',
    'sessions',
    'family_feeds',
    'daily_summaries',
    'habit_logs',
    'voice_clones',
    'child_profiles',
    'elder_profiles',
    'families',
    '_prisma_migrations',
  ];

  for (const table of oldTables) {
    const exists = await prisma.$queryRawUnsafe<[boolean]>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`
    );
    if (exists[0]) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`  [drop] ${table}`);
      } catch {
        console.log(`  [skip] ${table} (already gone)`);
      }
    }
  }

  console.log('  OK\n');
}

// ─── Step 2: Push new schema ─────────────────────────────────────────────────
async function pushNewSchema() {
  console.log('[reset] Step 2: Pushing new schema...');

  const schemaPath = path.join(prismaPkgDir, 'prisma', 'schema.prisma');
  const prismaBin = path.join(prismaPkgDir, 'node_modules', '.bin', 'prisma');
  execSync(`"${prismaBin}" db push --schema=${schemaPath} --force-reset --accept-data-loss`, {
    stdio: 'inherit',
    cwd: rootDir,
  });

  console.log('  OK\n');
}

// ─── Step 3: Migrate Qdrant collections ──────────────────────────────────────
async function migrateQdrant() {
  console.log('[reset] Step 3: Migrating Qdrant collections...');

  // Delete old collection
  const { exists: oldExists } = await qdrantFetch<{ exists: boolean }>(
    `/collections/${OLD_COLLECTION}/exists`
  );
  if (oldExists) {
    const res = await qdrantDelete(`/collections/${OLD_COLLECTION}`);
    console.log(`  [drop] ${OLD_COLLECTION} (${res.ok ? 'deleted' : 'failed'})`);
  } else {
    console.log(`  [skip] ${OLD_COLLECTION} (not found)`);
  }

  // Create new collection
  const { exists: newExists } = await qdrantFetch<{ exists: boolean }>(
    `/collections/${NEW_COLLECTION}/exists`
  );
  if (!newExists) {
    await qdrantPut(`/collections/${NEW_COLLECTION}`, {
      vectors: { size: 1024, distance: 'Cosine' },
      on_disk_payload: true,
    });
    console.log(`  [create] ${NEW_COLLECTION} (size=1024, distance=Cosine)`);

    // Create payload index for pairingId
    await qdrantPut(`/collections/${NEW_COLLECTION}/index`, {
      field_name: 'pairingId',
      field_schema: 'keyword',
    });
    console.log(`  [index] pairingId (keyword)`);
  } else {
    console.log(`  [skip] ${NEW_COLLECTION} (already exists)`);
  }

  console.log('  OK\n');
}

// ─── Qdrant HTTP helpers ─────────────────────────────────────────────────────
async function qdrantFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${QDRANT_URL}${path}`);
  return (await res.json()).result;
}

async function qdrantDelete(path: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${QDRANT_URL}${path}`, { method: 'DELETE' });
  return { ok: res.ok };
}

async function qdrantPut(path: string, body: object): Promise<void> {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Qdrant PUT ${path} failed: ${res.statusText}`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
main()
  .catch((err) => {
    console.error('[reset] ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
