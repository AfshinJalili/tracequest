import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReviewPage } from '@/features/review/review-page';
import demo from '../public/demo.json';
import { loadReview } from '@/persistence/review-storage';
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
});
