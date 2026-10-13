import { File as NativeFile, Blob as NativeBlob } from 'node:buffer';
import { URL as NativeURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReviewPage } from '@/features/review/review-page';
import demo from '../public/demo.json';
import { buildPack, decodeSession, sourceFingerprint, startReview } from '@/domains/review';
import { importReviewFile } from '@/integrations/files';
import { loadReview, persistReview } from '@/persistence/review-storage';
import { loadPreferences } from '@/persistence/preferences-storage';
import { authoredDemo, largeBackendFiles, partlyMappedReview } from './review-fixture';
import { ContextCode } from '@/features/review/components/code-block';
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
  it('browses and filters unmapped evidence without leaving the evidence screen', async () => {
    const pack = partlyMappedReview();
    persistReview(startReview(pack));
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Validate requests', level: 2 });
    await user.click(
      within(screen.getByRole('complementary')).getByRole('button', { name: 'Coverage' }),
    );
    const entry = screen.getAllByRole('button', { name: /large-service\.ts/ })[0];
    if (!entry) throw new Error('Unmapped fixture missing');
    await user.click(entry);
    await screen.findByRole('heading', { name: 'Unmapped evidence' });
    await user.click(screen.getByRole('button', { name: 'Next blocks' }));
    expect(screen.getByRole('heading', { name: 'Unmapped evidence' })).toBeInTheDocument();
    expect(screen.getByText(/Blocks 13–24/)).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Source file' }),
      'other-service.ts',
    );
    expect(screen.getByRole('heading', { name: 'Unmapped evidence' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Open code / })).toHaveLength(1);
    await user.type(screen.getByRole('searchbox', { name: 'Filter source files' }), 'large');
    expect(screen.getByRole('combobox', { name: 'Source file' })).toHaveValue('large-service.ts');
    await user.click(screen.getByRole('button', { name: 'Back to flow' }));
    expect(
      screen.getByRole('heading', { name: 'Validate requests', level: 2 }),
    ).toBeInTheDocument();
  });
  it('keeps the checkpoint unchanged when shortcuts are pressed in Coverage', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    const sidebar = within(screen.getByRole('complementary'));
    await user.click(sidebar.getByRole('button', { name: 'Coverage' }));
    sidebar.getByRole('button', { name: 'Close sidebar' }).focus();
    await user.keyboard('j');
    await user.click(sidebar.getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('heading', { name: 'Active order creation' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Enter the active-order lookup' }),
    ).toBeInTheDocument();
  });
  it('keeps the question and AI answer when switching between code and AI', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    await user.click(screen.getByRole('button', { name: 'AI settings' }));
    const settings = screen.getByRole('dialog', { name: 'AI settings' });
    fireEvent.change(within(settings).getByLabelText('API base URL'), {
      target: { value: 'https://api.example.invalid/v1' },
    });
    fireEvent.change(within(settings).getByLabelText('Model ID'), {
      target: { value: 'test-model' },
    });
    fireEvent.change(within(settings).getByLabelText('API key'), { target: { value: 'test-key' } });
    await user.click(within(settings).getByRole('button', { name: 'Connect' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ choices: [{ message: { content: 'Verify the lock boundary.' } }] }),
            { status: 200 },
          ),
      ),
    );
    await user.type(screen.getByLabelText('Question about this step'), 'Why this lock?');
    const form = screen.getByLabelText('Question about this step').closest('form');
    if (!form) throw new Error('Question form missing');
    await user.click(within(form).getByRole('button', { name: 'Ask AI' }));
    await screen.findByText('Verify the lock boundary.');
    await user.click(screen.getByRole('tab', { name: 'Code' }));
    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(screen.getByLabelText('Question about this step')).toHaveValue('Why this lock?');
    expect(screen.getByText('Verify the lock boundary.')).toBeVisible();
    let release: (response: Response) => void = () => {
      throw new Error('Request not started');
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const resumedForm = screen.getByLabelText('Question about this step').closest('form');
    if (!resumedForm) throw new Error('Question form missing');
    await user.click(within(resumedForm).getByRole('button', { name: 'Ask AI' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await act(async () => {
      release(
        new Response(JSON.stringify({ choices: [{ message: { content: 'Cancelled response' } }] })),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByText('Cancelled response')).toBeNull();
    expect(within(resumedForm).getByRole('button', { name: 'Ask AI' })).toBeEnabled();
  });
  it('ignores a cancelled GitHub import after a new diff has been imported', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    let release: (response: Response) => void = () => {
      throw new Error('Request not started');
    };
    const fetch = vi.fn((url: RequestInfo | URL) =>
      String(url).includes('/files')
        ? Promise.resolve(new Response(JSON.stringify(demo.files)))
        : new Promise<Response>((resolve) => {
            release = resolve;
          }),
    );
    vi.stubGlobal('fetch', fetch);
    await user.click(screen.getByRole('button', { name: 'Review actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import PR' }));
    fireEvent.change(screen.getByLabelText('Public PR URL'), {
      target: { value: 'https://github.com/vendurehq/vendure/pull/5259' },
    });
    await user.click(screen.getByRole('button', { name: 'Load PR' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Review actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import PR' }));
    const importer = screen.getByRole('dialog', { name: 'Import review' });
    await user.click(within(importer).getByRole('tab', { name: 'Paste diff' }));
    fireEvent.change(screen.getByLabelText('Unified diff'), {
      target: { value: 'diff --git a/new.ts b/new.ts\n@@ -0,0 +1 @@\n+newCode();' },
    });
    await user.click(screen.getByRole('button', { name: 'Import diff' }));
    await screen.findByRole('heading', { name: 'Evidence imported' });
    await act(async () => {
      release(new Response(JSON.stringify({ ...demo.pr, changed_files: demo.files.length })));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Local backend change');
  });
  it('offers import recovery when saved review data is corrupt', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('corrupt JSON');
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Could not load review' });
    await user.click(screen.getByRole('button', { name: 'Import review' }));
    expect(screen.getByRole('dialog', { name: 'Import review' })).toBeInTheDocument();
  });
  it('exposes mobile view navigation for raw evidence', async () => {
    persistReview(startReview(buildPack({ title: 'Raw evidence' }, largeBackendFiles())));
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Evidence imported' });
    const navigation = within(screen.getByRole('navigation', { name: 'Mobile review views' }));
    await user.click(navigation.getByRole('button', { name: 'Coverage' }));
    expect(screen.getByRole('heading', { name: 'Coverage' })).toBeInTheDocument();
    await user.click(navigation.getByRole('button', { name: 'Evidence' }));
    expect(screen.getByRole('heading', { name: 'Evidence imported' })).toBeInTheDocument();
  });
  it('does not replace refreshed source context with a cancelled response', async () => {
    const pack = authoredDemo(),
      original = pack.flows[0]?.steps[0];
    if (!original?.context) throw new Error('Context fixture missing');
    const session = startReview({ ...pack, sources: {} }),
      step = { ...original, context: { ...original.context, start: 1, end: 1 } };
    let release: (response: Response) => void = () => {
      throw new Error('Request not started');
    };
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(new Response('latestContext'));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    render(<ContextCode session={session} step={step} />);
    const toggle = screen.getByRole('button', { name: /^Unchanged context/ });
    await user.click(toggle);
    await user.click(toggle);
    await user.click(toggle);
    await screen.findByText('latestContext');
    await act(async () => {
      release(new Response('staleContext'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText('latestContext')).toBeVisible();
    expect(screen.queryByText('staleContext')).toBeNull();
  });
  it('imports 73 raw files as manageable evidence without a review plan', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    await user.click(screen.getByRole('button', { name: 'Review actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import PR' }));
    const importer = screen.getByRole('dialog', { name: 'Import review' });
    await user.click(within(importer).getByRole('tab', { name: 'Paste diff' }));
    const diff = largeBackendFiles()
      .map(
        (file) =>
          `diff --git a/${file.filename} b/${file.filename}\n--- /dev/null\n+++ b/${file.filename}\n${file.patch}`,
      )
      .join('\n');
    fireEvent.change(screen.getByLabelText('Unified diff'), { target: { value: diff } });
    await user.click(within(importer).getByRole('button', { name: 'Import diff' }));
    await screen.findByRole('heading', { name: 'Evidence imported' });
    expect(screen.queryByRole('button', { name: 'Review & next' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Source file' }).children).toHaveLength(73);
    expect(screen.getAllByRole('button', { name: /^Open code / }).length).toBeLessThanOrEqual(12);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Source file' }),
      'module-72.spec.ts',
    );
    expect(screen.getByRole('combobox', { name: 'Source file' })).toHaveValue('module-72.spec.ts');
    await user.click(screen.getAllByRole('button', { name: 'Agent review' })[0]!);
    const brief = screen.getByRole('dialog', { name: 'Agent review' });
    const context = within(brief).getByRole('textbox', { name: 'Review context' });
    if (!(context instanceof HTMLTextAreaElement)) throw new Error('Agent brief missing');
    expect(context.value.includes('unchanged callers')).toBe(true);
    expect(within(brief).getByLabelText('Authored review JSON')).toBeVisible();
  });
  it('reports a mismatched authored import in the dialog and applies a valid plan', async () => {
    const user = userEvent.setup(),
      pack = authoredDemo();
    persistReview(startReview(buildPack(pack.pr, pack.files)));
    const mounted = mount();
    await screen.findByRole('heading', { name: 'Evidence imported' });
    await user.click(screen.getAllByRole('button', { name: 'Agent review' })[0]!);
    const brief = screen.getByRole('dialog', { name: 'Agent review' });
    const mismatched = { ...pack, pr: { ...pack.pr, head: { sha: 'f'.repeat(40) } } };
    const json = {
      ...mismatched,
      authorship: { ...pack.authorship, sourceFingerprint: sourceFingerprint(mismatched) },
    };
    fireEvent.change(within(brief).getByLabelText('Authored review JSON'), {
      target: { value: JSON.stringify(json) },
    });
    await user.click(within(brief).getByRole('button', { name: 'Import review' }));
    expect(within(brief).getByRole('alert')).toHaveTextContent('must match the current evidence');
    fireEvent.change(within(brief).getByLabelText('Authored review JSON'), {
      target: { value: JSON.stringify(pack) },
    });
    await user.click(within(brief).getByRole('button', { name: 'Import review' }));
    await screen.findByRole('heading', { name: 'Active order creation' });
    expect(screen.getByText('Shop or admin request')).toBeVisible();
    expect(screen.getByText('Missing context')).toBeVisible();
    await user.click(screen.getByText('Missing context'));
    expect(
      screen.getByText(
        'Project configuration and full test execution were not included in this fixture',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    fireEvent.change(screen.getByLabelText('Step note'), {
      target: { value: 'Verify resolver ownership' },
    });
    mounted.unmount();
    mount();
    await screen.findByRole('heading', { name: 'Active order creation' });
    expect(screen.getByLabelText('Step note')).toHaveValue('Verify resolver ownership');
    expect(screen.getByText('Shop or admin request')).toBeVisible();
  });
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
  }, 15_000);
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
    await user.click(
      within(screen.getByRole('complementary')).getByRole('button', { name: 'Coverage' }),
    );
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
      expect(saved.session.state.position?.step).toBe('fresh-owner');
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
