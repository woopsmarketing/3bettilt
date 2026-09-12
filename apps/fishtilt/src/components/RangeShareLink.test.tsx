import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RangeShareLink } from './RangeShareLink.js';

const HREF = 'https://3bettilt.com/tools/range?hero=BTN&spot=RFI&stack=100';

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

/**
 * happy-dom does not implement `document.execCommand` at all (not even as a no-op), so
 * `vi.spyOn` has nothing to wrap. Stub it as a fresh own property instead — this is exactly
 * the "legacy API a real browser has but the test DOM does not" gap `RangeShareLink`'s
 * fallback path is written to survive, so the test environment's gap is the point, not a
 * problem to work around differently.
 */
function stubExecCommand(result: boolean) {
  const execCommand = vi.fn().mockReturnValue(result);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: execCommand,
  });
  return execCommand;
}

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  Reflect.deleteProperty(document, 'execCommand');
  vi.restoreAllMocks();
});

describe('RangeShareLink', () => {
  it('copies via the Clipboard API and confirms in words when it succeeds', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(<RangeShareLink href={HREF} />);
    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(writeText).toHaveBeenCalledWith(HREF);
    expect(await screen.findByText('링크를 복사했습니다.')).toBeInTheDocument();
  });

  it('falls back to execCommand when the Clipboard API throws', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubClipboard(writeText);
    const execCommand = stubExecCommand(true);

    render(<RangeShareLink href={HREF} />);
    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByText('링크를 복사했습니다.')).toBeInTheDocument();
  });

  it('falls back to execCommand when the Clipboard API is absent entirely', async () => {
    const user = userEvent.setup();
    stubClipboard(undefined);
    const execCommand = stubExecCommand(true);

    render(<RangeShareLink href={HREF} />);
    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByText('링크를 복사했습니다.')).toBeInTheDocument();
  });

  it('degrades honestly to a selectable text field when every copy path fails', async () => {
    const user = userEvent.setup();
    stubClipboard(undefined);
    stubExecCommand(false);

    render(<RangeShareLink href={HREF} />);
    await user.click(screen.getByRole('button', { name: '링크 복사' }));

    expect(
      await screen.findByText('자동 복사에 실패했습니다. 아래 링크를 직접 선택해서 복사해주세요.'),
    ).toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: 'Range Explorer 링크' });
    expect(field).toHaveValue(HREF);
    expect(field).toHaveAttribute('readonly');
    // Never claims success it did not get.
    expect(screen.queryByText('링크를 복사했습니다.')).not.toBeInTheDocument();
  });

  it('never mentions GTO', () => {
    stubClipboard(undefined);
    render(<RangeShareLink href={HREF} />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
