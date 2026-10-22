#!/usr/bin/env node
// Fail if likely secrets are committed. Runs in CI / pre-commit.
// No child_process: the tree is walked directly (see below), so this script
// needs nothing from PATH.

// A scanner that misses the format your credentials are actually IN is worse
// than none: it reports clean and everyone believes it. The first four are
// vendor-specific; the last three are the shapes an OAuth client secret and a
// Basic-auth pair really take.
const PATTERNS = [
  /figd_[A-Za-z0-9]{20,}/,          // Figma token
  /sk-[A-Za-z0-9]{20,}/,            // secret keys
  /AKIA[0-9A-Z]{16}/,               // AWS key id
  /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./, // JWT-ish
  /\bBasic\s+[A-Za-z0-9+/]{24,}={0,2}/,          // Basic <base64 user:pass>
  /client[_-]?secret["'\s:=]+[\w-]{16,}/i,        // OAuth client secret
];

// DELIBERATELY NOT HERE: a generic "32+ high-entropy chars" rule. It was tried
// and it fires on ordinary generated code — a Figma layer name becomes a key
// like 'grp:section5ProvideTheEntitySCrsClassificati', which is long, mixed
// case, and not a secret. A scanner that fails a freshly generated app gets
// switched off within a week, and then it catches nothing at all. Broad
// entropy scanning with a tuned allowlist is what gitleaks and trufflehog are
// for; run one of those alongside this.

// Values that LOOK like credentials and are published on purpose. An anon /
// publishable key is a JWT by format and public by design (Supabase, Stripe,
// PostHog); flagging it would fail every app that uses one.
const ALLOW = [
  // no \b before the alternation: in SUPABASE_ANON_KEY the char before ANON
  // is '_', a word character, so a boundary never matches there.
  /(ANON|PUBLIC|PUBLISHABLE)[_A-Z]*(KEY|TOKEN)/i,
  /^\s*"?integrity"?\s*:/,
  /data:image\/[a-z+]+;base64,/,
];

/**
 * The tree, walked directly.
 *
 * This used to shell out to `git ls-files` and exit 0 when that failed — and a
 * freshly generated app is NOT a git repo (the native shell is created with
 * --skip-git-init), so the very first `npm run check:secrets` reported success
 * having scanned ZERO files. A secrets scanner that passes by default is worse
 * than none: it is believed. Walking the filesystem also drops the dependency
 * on PATH resolving to a trustworthy git (Sonar S4036).
 */
const { readFileSync, readdirSync, statSync } = await import('node:fs');
const { join } = await import('node:path');
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'ios', 'android', 'build', 'dist', 'coverage',
  '.expo', 'Pods', '.gradle', '.symplrv3', '.scannerwork',
]);
const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') {
      if (entry.isDirectory()) continue;
    }
    const full = dir === '.' ? entry.name : join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
};
const files = walk('.');
if (files.length === 0) {
  console.error('💥 check-secrets: nothing to scan — refusing to report a pass.');
  process.exit(1);
}
let bad = 0;
for (const f of files) {
  if (/\.(png|jpg|jpeg|gif|webp|lock)$|node_modules\//.test(f)) continue;
  let text = '';
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ALLOW.some((a) => a.test(line))) continue;
    if (PATTERNS.some((p) => p.test(line))) {
      // line number, not just the file: on a 2,000-line generated screen
      // "possible secret in X" is not something anyone can act on.
      console.error(`⚠ possible secret at ${f}:${i + 1}`);
      bad++;
      break;
    }
  }
}
if (bad) { console.error(`\n${bad} file(s) may contain secrets — remove them and rotate the keys.`); process.exit(1); }
console.log('✓ no secrets detected');
