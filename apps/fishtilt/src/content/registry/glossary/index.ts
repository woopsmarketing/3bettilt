/**
 * Glossary registry barrel — recombines the nine per-category batch files (WP-S3-11 split
 * of the former J1/J2 authoring batches) into `GLOSSARY_RECORDS`. See
 * `registry/learn/index.ts` for why batches exist at all.
 *
 * `GLOSSARY_BATCHES` is the same data keyed by batch id, so `batches.test.ts` can gate each
 * file on its own and name the batch a failure belongs to. Membership in a CATEGORY is not
 * decided by the file a record sits in — `categories.ts` is the source of truth for that —
 * the files merely group records so one content agent can own a batch without touching
 * another agent's file.
 */
import type { GlossaryRecord } from '../../types.js';
import { GLOSSARY_G1_RECORDS } from './g1.js';
import { GLOSSARY_G2_RECORDS } from './g2.js';
import { GLOSSARY_G3_RECORDS } from './g3.js';
import { GLOSSARY_G4_RECORDS } from './g4.js';
import { GLOSSARY_G5_RECORDS } from './g5.js';
import { GLOSSARY_G6_RECORDS } from './g6.js';
import { GLOSSARY_G7_RECORDS } from './g7.js';
import { GLOSSARY_G8_RECORDS } from './g8.js';
import { GLOSSARY_G9_RECORDS } from './g9.js';

export const GLOSSARY_BATCHES: Readonly<Record<string, readonly GlossaryRecord[]>> = {
  g1: GLOSSARY_G1_RECORDS,
  g2: GLOSSARY_G2_RECORDS,
  g3: GLOSSARY_G3_RECORDS,
  g4: GLOSSARY_G4_RECORDS,
  g5: GLOSSARY_G5_RECORDS,
  g6: GLOSSARY_G6_RECORDS,
  g7: GLOSSARY_G7_RECORDS,
  g8: GLOSSARY_G8_RECORDS,
  g9: GLOSSARY_G9_RECORDS,
};

export const GLOSSARY_RECORDS: readonly GlossaryRecord[] = Object.values(GLOSSARY_BATCHES).flat();
