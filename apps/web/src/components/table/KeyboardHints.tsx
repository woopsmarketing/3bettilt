'use client';

/**
 * The keyboard legend, shown in the entry tray whenever the tray is not busy holding the
 * card palette or the award panel.
 *
 * It exists so the hints are *visible but unobtrusive*: they occupy space that is reserved
 * for card entry anyway, and they are replaced by the thing they describe the moment that
 * thing is on screen. Nothing here is state — the authoritative enable/disable for every
 * key is `ActionDock`'s own `data-legal`, and this legend never claims a key is available.
 *
 * The hotkey letters stay Latin: they are physical key positions (`lib/table/keys.ts`
 * resolves them regardless of the active input method), not words.
 */
const KEYS: readonly (readonly [string, string])[] = [
  ['F', '폴드'],
  ['C', '체크 / 콜'],
  ['R', '레이즈'],
  ['A', '올인'],
  ['Z', '되돌리기'],
  ['N', '다음 핸드'],
];

export function KeyboardHints() {
  return (
    <section
      data-testid="keyboard-hints"
      aria-label="키보드 단축키"
      className="flex min-w-0 flex-col justify-center gap-1 text-[0.65rem] text-ink-500"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="uppercase tracking-widest text-ink-700">키보드</span>
        {KEYS.map(([key, label]) => (
          <span key={key} className="flex items-center gap-1">
            <kbd className="tabular rounded border border-surface-600 bg-surface-800 px-1 text-ink-300">
              {key}
            </kbd>
            <span>{label}</span>
          </span>
        ))}
      </div>
      <p className="text-ink-700">
        카드 입력은 랭크 → 수트 순서입니다 (예: K 다음 s). Backspace 한 글자 취소, Esc 닫기.
      </p>
      <p className="text-ink-700">
        좌석을 클릭하면 오른쪽에 플레이어 정보가 열리고, Esc 를 누르면 닫힙니다.
      </p>
    </section>
  );
}
