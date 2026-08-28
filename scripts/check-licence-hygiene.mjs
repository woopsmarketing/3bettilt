#!/usr/bin/env node
/**
 * Standing licence-hygiene check (ADR-0015).
 *
 * We may READ permissively licensed projects for ideas. We may never copy code from
 * the AGPL/GPL/unlicensed projects on the blocklist, because AGPL section 13 triggers
 * source disclosure for network-accessible software even without distributing
 * binaries — incompatible with a possible closed-source product.
 *
 * This is a cheap, blunt tripwire, not a licence audit. It catches the realistic
 * failure: someone pastes a file in and the header comes along with it.
 *
 * Run: pnpm lint:licences
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|rs|py|toml|sql)$/;

/** Copyleft licence headers travel with copy-pasted source. */
const COPYLEFT_PATTERNS = [
  { re: /GNU\s+Affero/i, label: 'GNU Affero (AGPL) licence header' },
  { re: /GNU\s+General\s+Public/i, label: 'GNU General Public (GPL) licence header' },
  { re: /\bAGPL-?3/i, label: 'AGPL-3 identifier' },
  { re: /SPDX-License-Identifier:\s*(A?GPL|LGPL)/i, label: 'copyleft SPDX identifier' },
];

/** Projects ADR-0015 forbids copying from. Their appearance in SOURCE suggests vendoring. */
const BLOCKLIST = ['postflop-solver', 'TexasSolver', 'shark-2.0'];

/** Docs legitimately discuss these licences and repositories; that is the point of them. */
const EXEMPT = [/^docs\//, /^scripts\/check-licence-hygiene\.mjs$/, /^prompt2?$/];

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const problems = [];

// A read-only clone of an external project must never become tracked (ADR-0015).
for (const file of tracked) {
  if (/(^|\/)references\//.test(file)) {
    problems.push(`${file}: files under references/ must stay untracked (ADR-0015)`);
  }
}

for (const file of tracked) {
  if (!SOURCE_EXTENSIONS.test(file)) continue;
  if (EXEMPT.some((re) => re.test(file))) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable; not our concern
  }

  for (const { re, label } of COPYLEFT_PATTERNS) {
    if (re.test(text)) problems.push(`${file}: contains ${label}`);
  }
  for (const name of BLOCKLIST) {
    if (text.includes(name)) {
      problems.push(`${file}: references blocklisted project "${name}" (ADR-0015)`);
    }
  }
}

if (problems.length > 0) {
  console.error('Licence hygiene check FAILED:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nSee docs/DECISIONS.md ADR-0015 and docs/OPEN_SOURCE_EVALUATION.md section 7.');
  process.exit(1);
}

console.log(`Licence hygiene OK (${tracked.length} tracked files scanned).`);
