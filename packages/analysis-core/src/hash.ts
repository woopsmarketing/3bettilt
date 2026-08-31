/**
 * The deterministic identity of an analysis input set.
 *
 * ADR-0062c: a snapshot is written only when the input hash or the algorithm version
 * differs from the player's latest snapshot. That makes this function part of the
 * idempotency guarantee, so it has three hard requirements:
 *
 * 1. **Order-independent.** The caller's query order must not change the hash, so the ids
 *    are sorted before hashing.
 * 2. **Dependency-free and stable forever.** No `crypto`, no library: the algorithm is
 *    written out below, so the same ids produce the same string on any runtime, any
 *    version, any platform, in six months.
 * 3. **No clock, no RNG.** Same input, same output.
 *
 * ## Algorithm and its trade-off
 *
 * FNV-1a, 64-bit, over `count + '\n' + sortedIds.join('\n')`, rendered as 16 lowercase
 * hex characters. FNV-1a is a NON-CRYPTOGRAPHIC hash: it is trivially collidable by an
 * attacker who chooses the inputs. That is acceptable and deliberate here — the inputs are
 * locally generated hand ids from the user's own database, there is no adversary, and the
 * only consequence of a collision would be a run reporting `NO_CHANGES` when a new hand
 * had in fact arrived. At 64 bits the chance of an accidental collision across even a
 * million distinct input sets is about 3 x 10^-8. If this is ever exposed to
 * attacker-chosen ids, replace it with SHA-256 and bump `ANALYSIS_ALGORITHM_VERSION`.
 *
 * The count is prefixed so that a set of ids can never hash equal to a differently-sized
 * set that happens to concatenate the same way, and `\n` separates ids so that
 * `['ab','c']` and `['a','bc']` differ.
 */

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** Internal. FNV-1a over the UTF-8 code units of `text`, as a 64-bit BigInt. */
function fnv1a64(text: string): bigint {
  const bytes = new TextEncoder().encode(text);
  let hash = FNV_OFFSET_BASIS_64;
  for (const byte of bytes) {
    hash = (hash ^ BigInt(byte)) & MASK_64;
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash;
}

/**
 * Total. The order-independent identity of a set of hand ids: 16 lowercase hex digits.
 *
 * Duplicates are NOT removed — a duplicated id is a caller bug that
 * `computePlayerModel` rejects outright, and silently collapsing it here would hide it.
 * An empty set hashes to the hash of `"0\n"`, which is a real, stable value: "this player
 * has no eligible hands" is a legitimate input identity and must be distinguishable from
 * every non-empty one.
 */
export function inputIdentityHash(handIds: readonly string[]): string {
  const sorted = [...handIds].sort();
  const payload = `${sorted.length}\n${sorted.join('\n')}`;
  return fnv1a64(payload).toString(16).padStart(16, '0');
}
