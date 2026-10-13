import { Blob as NativeBlob } from 'node:buffer';
import { URL as NativeURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptDialog } from '@/features/ai/prompt-dialog';

const nativeFetch = globalThis.fetch;

describe('review context popup', () => {
  it('copies and downloads the entire long context and closes with Escape', async () => {
    const text = 'Review the backend flow.\n' + 'const value = "雪";\n'.repeat(2000);
    const user = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText');
    vi.stubGlobal('Blob', NativeBlob);
    vi.stubGlobal('URL', NativeURL);
    const captures: { filename: string; body: Promise<string> }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captures.push({
        filename: this.download,
        body: nativeFetch(this.href).then((response) => response.text()),
      });
    });
    const close = vi.fn();
    const mounted = render(
      <PromptDialog request={{ kind: 'question', text }} onClose={close} onApply={() => {}} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Copy context' });
    expect(within(dialog).getByRole('textbox', { name: 'Review context' })).toHaveValue(text);
    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));
    expect(clipboard).toHaveBeenCalledWith(text);
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));
    const download = captures[0];
    if (!download) throw new Error('Prompt download missing');
    expect(download.filename).toBe('tracequest-prompt.txt');
    expect(await download.body).toBe(text);
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
    mounted.rerender(<PromptDialog request={null} onClose={close} onApply={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    mounted.rerender(
      <PromptDialog request={{ kind: 'question', text }} onClose={close} onApply={() => {}} />,
    );
    expect(screen.getByRole('textbox', { name: 'Review context' })).toHaveValue(text);
  });
});
