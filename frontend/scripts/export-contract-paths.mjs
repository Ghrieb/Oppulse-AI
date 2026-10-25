import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Exports the HTTP contract.
 *
 * The MSW handlers are the executable specification of the API, so the path
 * list is read out of them rather than written by hand: a handler cannot
 * change without the contract changing with it. Each route then carries its
 * coverage — the frontend files that call it, or a deferred marker saying
 * why nothing calls it yet — so this one file answers what is served, who
 * uses it, and what is knowingly unused.
 *
 * The output is `contracts/paths.json`, and the backend's CI check compares
 * it with the routes the service actually serves.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const handlersDir = join(root, 'frontend/src/mocks/handlers');
const srcDir = join(root, 'frontend/src');
const deferredPath = join(root, 'contracts/deferred.json');
const outputPath = join(root, 'contracts/paths.json');

const HANDLER_PATTERN = /http\.(get|post|put|patch|delete)\(\s*apiUrl\(\s*'([^']+)'/g;
const CALL_SITES = /apiClient\s*\.\s*(get|post|put|patch|delete|upload)\s*\(/g;
const CALL_PATTERN =
  /apiClient\s*\.\s*(get|post|put|patch|delete|upload)\s*\(\s*(['"`])((?:(?!\2)[\s\S])*)\2/g;

const NOTE =
  "The HTTP contract, read out of the frontend's MSW handlers: the routes the backend " +
  "must serve, and each route's coverage in the frontend — the files that call it, " +
  'or a deferred marker with the reason nothing calls it yet.';

function collectPaths() {
  const routes = [];

  for (const file of readdirSync(handlersDir)) {
    if (!file.endsWith('.ts')) continue;

    const source = readFileSync(join(handlersDir, file), 'utf-8');
    HANDLER_PATTERN.lastIndex = 0;

    let match = HANDLER_PATTERN.exec(source);
    while (match !== null) {
      routes.push({ method: match[1].toUpperCase(), path: match[2], file });
      match = HANDLER_PATTERN.exec(source);
    }
  }

  // The API prefix is added by the service, not by the handler.
  return routes
    .map((route) => ({ method: route.method, path: `/api/v1${route.path}` }))
    .sort((a, b) =>
      a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
    );
}

function sourceFiles(directory, prefix = '') {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      // The mocks answer the calls; they are not callers of them.
      if (entry.name === 'mocks') continue;
      files.push(...sourceFiles(join(directory, entry.name), name));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(name);
    }
  }

  return files;
}

function collectCallers() {
  const callers = [];

  for (const file of sourceFiles(srcDir)) {
    const source = readFileSync(join(srcDir, file), 'utf-8');
    const sites = (source.match(CALL_SITES) ?? []).length;
    let parsed = 0;

    CALL_PATTERN.lastIndex = 0;
    let match = CALL_PATTERN.exec(source);

    while (match !== null) {
      callers.push({
        method: match[1] === 'upload' ? 'POST' : match[1].toUpperCase(),
        path: match[3],
        file,
      });
      parsed += 1;
      match = CALL_PATTERN.exec(source);
    }

    if (parsed !== sites) {
      throw new Error(
        `${file}: ${sites - parsed} apiClient call(s) without a literal path — ` +
          'the contract cannot see them.',
      );
    }
  }

  return callers;
}

// A hook says `${missionId}`, a handler says `:id`, FastAPI says `{id}`:
// one key for all three spellings, so coverage matches on shape, not names.
function coverageKey(method, path) {
  const prefixed = path.startsWith('/api/v1') ? path : `/api/v1${path}`;
  const normalised = prefixed
    .replace(/\$\{[^}]*\}/g, '*')
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '*')
    .replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, '*');
  return `${method.toUpperCase()} ${normalised}`;
}

function loadDeferred() {
  const deferred = JSON.parse(readFileSync(deferredPath, 'utf-8'));
  const reasons = new Map();

  for (const route of deferred.routes) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    if (reasons.has(key)) {
      throw new Error(`contracts/deferred.json lists ${key} twice.`);
    }
    reasons.set(key, route.reason);
  }

  return reasons;
}

function buildContract() {
  const routes = collectPaths();
  const callers = collectCallers();
  const deferred = loadDeferred();

  const routeKeys = new Set(routes.map((route) => `${route.method} ${route.path}`));
  for (const key of deferred.keys()) {
    if (!routeKeys.has(key)) {
      throw new Error(`contracts/deferred.json lists ${key}, which is not a contract route.`);
    }
  }

  const calls = new Map();
  for (const caller of callers) {
    const key = coverageKey(caller.method, caller.path);
    const files = calls.get(key) ?? new Set();
    files.add(caller.file);
    calls.set(key, files);
  }

  const covered = routes.map((route) => {
    const key = `${route.method} ${route.path}`;
    const files = calls.get(coverageKey(route.method, route.path));
    const reason = deferred.get(key);

    if (files && reason) {
      throw new Error(
        `${key}: listed in contracts/deferred.json while ${[...files].join(', ')} call it — ` +
          'delete the stale marker.',
      );
    }
    if (files) {
      return { ...route, coverage: { kind: 'hook', callers: [...files].sort() } };
    }
    if (reason) {
      return { ...route, coverage: { kind: 'deferred', reason } };
    }
    throw new Error(
      `${key}: no frontend caller and no deferred marker — call it, or add it to ` +
        'contracts/deferred.json with the reason.',
    );
  });

  return { version: 1, note: NOTE, routes: covered };
}

const contract = buildContract();

writeFileSync(outputPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf-8');

console.log(`Wrote ${contract.routes.length} routes to contracts/paths.json`);
