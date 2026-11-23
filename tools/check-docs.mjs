#!/usr/bin/env node
/**
 * Documentation consistency check (D-104). Node built-ins only, so it runs
 * without `npm install`: `npm run docs:check` or `node tools/check-docs.mjs`.
 *
 * Fails when:
 *  1. a Markdown file in the repository root or docs/ is not classified in
 *     docs/README.md;
 *  2. a document listed as Historical lacks the "Document status: HISTORICAL"
 *     banner near its top;
 *  3. a link or repository path in the shared-context files points at
 *     something that does not exist;
 *  4. docs/decisions.md has a duplicate decision ID;
 *  5. docs/README.md's "Decision log current through" ID is behind (or
 *     ahead of) the newest decision in the log.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = 'docs/README.md';
const DECISIONS = 'docs/decisions.md';
const BANNER = 'Document status: HISTORICAL';
/** Files whose every link and path must resolve: the shared context. */
const SHARED = ['AGENTS.md', 'CLAUDE.md', INDEX, 'docs/system-map.md', 'docs/open-questions.md'];
const ROOT_PREFIXES = ['src/', 'docs/', 'tests/', 'tools/', 'server/', 'public/', '.github/'];

const errors = [];
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const toPosix = (p) => p.split('\\').join('/');

function markdownFiles() {
  const out = readdirSync(ROOT).filter((f) => f.endsWith('.md') && statSync(join(ROOT, f)).isFile());
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (name.endsWith('.md')) out.push(rel);
    }
  };
  walk('docs');
  return out.sort();
}

/** True if a path (which may end in a glob segment like `Wordcraft*.ts` or `*`) exists. */
function pathExists(rel) {
  const clean = rel.replace(/\/$/, '');
  if (!clean.includes('*')) return existsSync(join(ROOT, clean));
  const dir = dirname(clean);
  const pattern = clean.slice(dir.length + 1);
  if (!existsSync(join(ROOT, dir))) return false;
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return readdirSync(join(ROOT, dir)).some((n) => re.test(n));
}

// 1 & 2. Classification and banners.
const index = read(INDEX);
const listed = new Set([...index.matchAll(/`([^`\s]+\.md)`/g)].map((m) => m[1]));
for (const file of markdownFiles()) {
  if (!listed.has(file)) errors.push(`${file}: not classified in ${INDEX} (add it to a table there)`);
}
const historical = index.split(/^### /m).find((s) => s.startsWith('Historical')) ?? '';
for (const m of historical.matchAll(/^\|\s*`([^`]+\.md)`/gm)) {
  const file = m[1];
  if (!existsSync(join(ROOT, file))) {
    errors.push(`${INDEX}: lists missing historical file ${file}`);
    continue;
  }
  if (!read(file).slice(0, 800).includes(BANNER)) errors.push(`${file}: listed as Historical but has no "${BANNER}" banner at the top`);
}

// 3. Links and paths in the shared-context files.
for (const file of SHARED) {
  if (!existsSync(join(ROOT, file))) {
    errors.push(`${file}: shared-context file is missing`);
    continue;
  }
  const text = read(file);
  const here = dirname(file);
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const rel = toPosix(relative(ROOT, resolve(ROOT, here, target)));
    if (!pathExists(rel)) errors.push(`${file}: broken link (${m[1]})`);
  }
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const token = m[1];
    if (!/^[\w.*\/-]+$/.test(token) || !token.includes('/')) continue;
    let rel;
    if (ROOT_PREFIXES.some((p) => token.startsWith(p))) rel = token;
    else if (/\.(md|ts|json)$/.test(token)) rel = toPosix(join(here, token));
    else continue;
    if (!pathExists(rel)) errors.push(`${file}: path \`${token}\` does not exist`);
  }
}

// 4 & 5. Decision IDs.
const ids = [...read(DECISIONS).matchAll(/^### (D-\d{3})\b/gm)].map((m) => m[1]);
const seen = new Set();
for (const id of ids) {
  if (seen.has(id)) errors.push(`${DECISIONS}: duplicate decision ID ${id} (renumber the newer one and leave a note)`);
  seen.add(id);
}
const highest = ids.map((id) => Number(id.slice(2))).reduce((a, b) => Math.max(a, b), 0);
const marker = index.match(/Decision log current through: D-(\d{3})/);
if (!marker) errors.push(`${INDEX}: missing the line "Decision log current through: D-NNN"`);
else if (Number(marker[1]) !== highest) {
  errors.push(`${INDEX}: says the log is current through D-${marker[1]}, but the newest decision is D-${String(highest).padStart(3, '0')}. Review the current-state snapshot, then update that line.`);
}

if (errors.length) {
  console.error(`docs:check found ${errors.length} problem(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  console.error('\nSee AGENTS.md §6 for how the shared documentation is kept current.');
  process.exit(1);
}
console.log(`docs:check passed: ${markdownFiles().length} documents classified, ${ids.length} decisions (newest D-${String(highest).padStart(3, '0')}).`);
