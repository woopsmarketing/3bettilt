/**
 * The three kinds of cell on the 13x13 chart — pairs, suited, offsuit — counted from
 * `strategy-core`'s `HAND_CLASSES` rather than typed as "13 / 78 / 78".
 *
 * Two guides state the same facts (`/tools/range` under "13×13 표 읽기" and
 * `/tools/starting-hand` under "조합 수"), so the rows are built once here and the test
 * (`matrixKinds.test.ts`) proves the totals add back up to `HAND_CLASS_COUNT` and
 * `COMBO_COUNT`. If either package ever changed, both pages would change with it.
 */
import {
  COMBO_COUNT,
  HAND_CLASS_COUNT,
  HAND_CLASSES,
  type HandClassKind,
} from '@gto-self/strategy-core';

export interface MatrixKindRow {
  readonly kind: HandClassKind;
  /** Where the kind lives on the chart, in the reader's words. */
  readonly label: string;
  readonly position: string;
  /** How many of the 169 cells are this kind. */
  readonly classCount: number;
  /** Combos in ONE cell of this kind (6 / 4 / 12). Read from a member, never typed. */
  readonly combosPerClass: number;
  /** `classCount * combosPerClass`. */
  readonly comboTotal: number;
  /** One example key for the row. */
  readonly example: string;
}

const KIND_LABEL: Readonly<Record<HandClassKind, string>> = {
  PAIR: '페어 (같은 숫자 두 장)',
  SUITED: '수티드 (같은 무늬)',
  OFFSUIT: '오프수트 (다른 무늬)',
};

const KIND_POSITION: Readonly<Record<HandClassKind, string>> = {
  PAIR: '대각선',
  SUITED: '대각선 위쪽',
  OFFSUIT: '대각선 아래쪽',
};

const KIND_ORDER: readonly HandClassKind[] = ['PAIR', 'SUITED', 'OFFSUIT'];

function rowFor(kind: HandClassKind): MatrixKindRow {
  const members = HAND_CLASSES.filter((handClass) => handClass.kind === kind);
  const first = members[0];
  if (first === undefined) throw new Error(`no hand class of kind ${kind}`);
  const combosPerClass = first.comboCount;
  for (const member of members) {
    if (member.comboCount !== combosPerClass) {
      throw new Error(`hand classes of kind ${kind} disagree on their combo count`);
    }
  }
  return {
    kind,
    label: KIND_LABEL[kind],
    position: KIND_POSITION[kind],
    classCount: members.length,
    combosPerClass,
    comboTotal: members.length * combosPerClass,
    example: first.key,
  };
}

/** The three rows, pairs first — the order a reader meets them walking down from the corner. */
export const MATRIX_KIND_ROWS: readonly MatrixKindRow[] = KIND_ORDER.map(rowFor);

/** The totals the rows add up to, restated from the packages so a caller can print both. */
export const MATRIX_KIND_TOTALS = {
  classCount: HAND_CLASS_COUNT,
  comboTotal: COMBO_COUNT,
} as const;
