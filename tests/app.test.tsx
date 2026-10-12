import { File as NativeFile, Blob as NativeBlob } from 'node:buffer';
import { URL as NativeURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReviewPage } from '@/features/review/review-page';
import demo from '../public/demo.json';
import { decodeSession } from '@/domains/review';
import { importReviewFile } from '@/integrations/files';
import { loadReview } from '@/persistence/review-storage';
import { loadPreferences } from '@/persistence/preferences-storage';
const nativeFetch = globalThis.fetch;
function mount() {
  return render(
    <TooltipProvider>
      <ReviewPage />
    </TooltipProvider>,
  );
}
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(demo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
});
describe('review application', () => {
  it('disables every shortcut immediately and remembers the preference after remount', async () => {
    const user = userEvent.setup();
    const mounted = mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = screen.getByRole('dialog', { name: 'Settings' });
    const shortcuts = within(settings).getByRole('switch', { name: 'Keyboard shortcuts' });
    expect(shortcuts).toBeChecked();
    await user.click(shortcuts);
    expect(shortcuts).not.toBeChecked();
    expect(loadPreferences()).toEqual({ kind: 'ready', preferences: { keyboardShortcuts: false } });
    await user.click(within(settings).getByRole('button', { name: 'Close' }));
    screen.getByRole('button', { name: 'Close sidebar' }).focus();
    await user.keyboard('fjk');
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active order creation' })).toBeInTheDocument();

    mounted.unmount();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('switch', { name: 'Keyboard shortcuts' })).not.toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Keyboard shortcuts' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    screen.getByRole('button', { name: 'Close sidebar' }).focus();
    await user.keyboard('j');
    expect(screen.getByRole('heading', { name: 'Lock the owner, in order' })).toBeInTheDocument();
  });
  it('ignores annotation editors, shadow inputs, composition, and consumed key events', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    render(
      <div>
        <div contentEditable aria-label="Annotation editor" role="textbox">
          <span data-testid="annotation-text" />
        </div>
        <div data-testid="shadow-editor" />
      </div>,
    );
    for (const key of ['f', 'j', 'k'])
      fireEvent.keyDown(screen.getByTestId('annotation-text'), { key });

    const shadow = screen.getByTestId('shadow-editor').attachShadow({ mode: 'open' });
    const input = document.createElement('textarea');
    shadow.append(input);
    for (const key of ['f', 'j', 'k'])
      fireEvent.keyDown(input, { key, bubbles: true, composed: true });
    const sidebarButton = screen.getByRole('button', { name: 'Close sidebar' });
    fireEvent.keyDown(sidebarButton, { key: 'j', isComposing: true });
    const consumed = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
    consumed.preventDefault();
    fireEvent(sidebarButton, consumed);

    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active order creation' })).toBeInTheDocument();
    fireEvent.keyDown(sidebarButton, { key: 'j' });
    expect(screen.getByRole('heading', { name: 'Lock the owner, in order' })).toBeInTheDocument();
  });
  it('opens and focuses one AI composer and supplies the selected code when no model is connected', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    const ask = screen.getByRole('button', { name: 'Ask AI' });
    await user.click(ask);
    expect(screen.getByRole('tab', { name: 'Ask AI' })).toHaveAttribute('aria-selected', 'true');
    const question = screen.getByRole('textbox', { name: 'Question about this step' });
    expect(question).toHaveFocus();
    expect(screen.getAllByRole('textbox', { name: 'Question about this step' })).toHaveLength(1);
    await user.type(question, 'Why lock the owner?');
    await user.click(ask);
    expect(question).toHaveFocus();
    expect(question).toHaveValue('Why lock the owner?');
    const composer = question.closest('form');
    if (!composer) throw new Error('Question form is missing.');
    await user.click(within(composer).getByRole('button', { name: 'Ask AI' }));
    const context = screen.getByRole('dialog', { name: 'Copy context' });
    const copied = within(context).getByRole('textbox', { name: 'Review context' });
    if (!(copied instanceof HTMLTextAreaElement)) throw new Error('Review context is missing.');
    expect(copied.value).toContain('Why lock the owner?');
    expect(copied.value).toContain('active-order.service.ts');
    await user.click(within(context).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Coverage' }));
    await user.click(ask);
    expect(screen.getByRole('heading', { name: 'Active order creation' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Question about this step' })).toHaveFocus();
  });
  it('closes and reopens the sidebar with icon controls while keeping the review available', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    const sidebar = screen.getByRole('complementary');
    const close = within(sidebar).getByRole('button', { name: 'Close sidebar' });
    expect(close).toHaveAttribute('aria-expanded', 'true');
    expect(close).toHaveTextContent('');
    expect(screen.queryByRole('button', { name: /^(Exit focus|Focus)$/ })).toBeNull();

    await user.click(close);
    const open = screen.getByRole('button', { name: 'Open sidebar' });
    expect(sidebar).not.toBeVisible();
    expect(open).toHaveAttribute('aria-expanded', 'false');
    expect(open).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Active order creation' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Review & next' })).toBeDisabled();

    await user.click(open);
    expect(sidebar).toBeVisible();
    expect(within(sidebar).getByRole('button', { name: 'Close sidebar' })).toHaveFocus();
    await user.keyboard('f');
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toHaveFocus();
    await user.keyboard('f');
    expect(within(sidebar).getByRole('button', { name: 'Close sidebar' })).toHaveFocus();
  });
  it('loads the actual demo and gates inspection on every code block', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    const action = screen.getByRole('button', { name: 'Review & next' });
    expect(action).toBeDisabled();
    const blocks = screen.getAllByRole('button', { name: /^Open code / });
    expect(blocks).toHaveLength(3);
    for (const block of blocks) await user.click(block);
    expect(action).toBeEnabled();
    await user.click(action);
    await screen.findByRole('heading', { name: 'Lock the owner, in order' });
    const saved = loadReview();
    expect(saved.kind).toBe('ready');
    if (saved.kind === 'ready') {
      expect(saved.session.state.stepStatus['fresh-entry']).toBe('done');
      expect(saved.session.state.position.step).toBe('fresh-owner');
    }
  });
  it('preserves a flagged concern and restores its checkpoint after remount', async () => {
    const user = userEvent.setup(),
      mounted = mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    for (const block of screen.getAllByRole('button', { name: /^Open code / }))
      await user.click(block);
    await user.click(screen.getByRole('button', { name: 'Flag' }));
    await user.type(screen.getByLabelText('Concern'), 'Check the transaction boundary');
    await user.click(screen.getByRole('button', { name: 'Save flag' }));
    await waitFor(() => {
      const saved = loadReview();
      expect(saved.kind).toBe('ready');
      if (saved.kind === 'ready')
        expect(saved.session.state.notes['fresh-entry']).toBe('Check the transaction boundary');
    });
    mounted.unmount();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    expect(screen.getByLabelText('Step note')).toHaveValue('Check the transaction boundary');
    expect(screen.getByText('Flagged', { selector: '.step-state' })).toBeInTheDocument();
  });
  it('uses named step choices rather than an unlabeled numeric strip', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    await user.click(screen.getByRole('button', { name: 'Choose flow step' }));
    await user.click(await screen.findByRole('menuitem', { name: /Refresh the stale snapshot/ }));
    expect(screen.getByRole('heading', { name: 'Refresh the stale snapshot' })).toBeInTheDocument();
    expect(document.querySelector('.tq-route')).toBeNull();
    expect(document.querySelector('.mission-card')).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /Trail scout|cartographer|WHOLE PICTURE|breadcrumbs|XP/,
    );
  });
  it('downloads both actual menu outputs and restores an exported review through the file picker', async () => {
    vi.stubGlobal('Blob', NativeBlob);
    vi.stubGlobal('File', NativeFile);
    vi.stubGlobal('URL', NativeURL);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(demo), { status: 200 })),
    );
    const captures: { filename: string; body: Promise<string> }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.parentElement).toBe(document.body);
      const body = nativeFetch(this.href).then((response) => {
        expect(response.ok).toBe(true);
        return response.text();
      });
      captures.push({ filename: this.download, body });
    });
    const user = userEvent.setup();
    const mounted = mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    for (const block of screen.getAllByRole('button', { name: /^Open code / }))
      await user.click(block);
    await user.click(screen.getByRole('button', { name: 'Flag' }));
    await user.type(
      screen.getByLabelText('Concern'),
      'Verify the owner lock runs inside @Transaction',
    );
    await user.click(screen.getByRole('button', { name: 'Save flag' }));
    await user.click(screen.getByRole('button', { name: 'Review actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export notes' }));
    const notes = captures[0];
    if (!notes) throw new Error('Notes download was not started');
    expect(notes.filename).toBe('tracequest-review.md');
    const markdown = await notes.body;
    expect(markdown).toContain('Verify the owner lock runs inside @Transaction');
    expect(markdown).toContain('FLAG');
    expect(markdown).toContain('3/14 evidence blocks');

    await user.click(screen.getByRole('button', { name: 'Review actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export review file' }));
    const review = captures[1];
    if (!review) throw new Error('Review download was not started');
    expect(review.filename).toBe('tracequest-review.json');
    const json = await review.body;
    const raw = decodeSession(JSON.parse(json));
    expect(raw.pack.blocks).toHaveLength(14);
    expect(raw.pack.flows).toHaveLength(4);
    expect(raw.state.notes['fresh-entry']).toContain('@Transaction');
    expect(raw.state.stepStatus['fresh-entry']).toBe('flag');
    const file = new File([json], review.filename, { type: 'application/json' });
    const restored = await importReviewFile(file);
    expect(restored.pack).toEqual(raw.pack);
    expect(restored.state).toEqual(raw.state);

    mounted.unmount();
    localStorage.clear();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    await user.click(screen.getByRole('button', { name: 'Review actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import PR' }));
    const importer = screen.getByRole('dialog', { name: 'Import review' });
    await user.click(within(importer).getByRole('tab', { name: 'File' }));
    const picker = document.getElementById('review-file');
    if (!picker) throw new Error('File picker missing');
    await user.upload(picker, file);
    await waitFor(() =>
      expect(screen.getByLabelText('Step note')).toHaveValue(
        'Verify the owner lock runs inside @Transaction',
      ),
    );
    expect(screen.getByText('Flagged', { selector: '.step-state' })).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(2);
  }, 15_000);
});
