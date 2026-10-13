import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  inspectStep,
  positionForBlock,
  remapReview,
  reviewView,
  saveNote,
  selectStep,
  startReview,
  type BlockId,
  type Position,
  type ReviewPack,
  type ReviewSession,
} from '@/domains/review';
import { loadDemoPack } from '@/integrations/demo';
import { loadReview, persistReview } from '@/persistence/review-storage';

type ReviewLoad =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: ReviewSession };
export function useReview() {
  const [load, setLoad] = useState<ReviewLoad>(() => {
    const stored = loadReview();
    return stored.kind === 'ready'
      ? { kind: 'ready', session: stored.session }
      : stored.kind === 'invalid'
        ? { kind: 'error', message: stored.message }
        : { kind: 'loading' };
  });
  const [evidenceSelection, setEvidenceSelection] = useState<BlockId | null>(null);
  const [opened, setOpened] = useState<Set<BlockId>>(new Set());
  const loadDemo = useCallback(() => {
    setEvidenceSelection(null);
    setLoad({ kind: 'loading' });
  }, []);
  useEffect(() => {
    if (load.kind !== 'loading') return;
    const controller = new AbortController();
    void (async () => {
      try {
        const pack = await loadDemoPack(controller.signal);
        if (controller.signal.aborted) return;
        setOpened(new Set());
        setLoad({ kind: 'ready', session: startReview(pack) });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoad({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not load demo.',
        });
      }
    })();
    return () => controller.abort();
  }, [load.kind]);
  useEffect(() => {
    if (load.kind === 'ready') {
      try {
        persistReview(load.session);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? 'Could not save locally: ' + error.message
            : 'Local storage failed. Export the review to save it.',
        );
      }
    }
  }, [load]);
  const update = useCallback(
    (change: (session: ReviewSession) => ReviewSession) =>
      setLoad((previous) =>
        previous.kind === 'ready' ? { kind: 'ready', session: change(previous.session) } : previous,
      ),
    [],
  );
  const select = useCallback(
    (position: Position) => {
      setOpened(new Set());
      setEvidenceSelection(null);
      update((session) => selectStep(session, position));
    },
    [update],
  );
  const open = useCallback(
    (id: BlockId) => setOpened((previous) => new Set([...previous, id])),
    [],
  );
  const replace = useCallback((session: ReviewSession) => {
    setOpened(new Set());
    setEvidenceSelection(null);
    setLoad({ kind: 'ready', session });
  }, []);
  const view = useMemo(
    () => (load.kind === 'ready' ? reviewView(load.session, opened) : null),
    [load, opened],
  );
  const inspect = useCallback(
    (status: 'done' | 'flag') => {
      if (load.kind !== 'ready' || !view || view.kind !== 'review') return;
      update((session) => inspectStep(session, view.step, opened, status));
      if (status === 'done' && view.next) select(view.next);
      toast.success(status === 'flag' ? 'Flag saved.' : 'Step reviewed.');
    },
    [load, view, opened, select, update],
  );
  const note = useCallback(
    (text: string) => {
      if (view?.kind === 'review') update((session) => saveNote(session, view.step, text));
    },
    [view, update],
  );
  const applyMap = useCallback(
    (pack: ReviewPack) => {
      // Validate while the import dialog can still report the error to the user.
      if (load.kind === 'ready') replace(remapReview(load.session, pack));
    },
    [load, replace],
  );
  const jump = useCallback(
    (id: BlockId) => {
      if (load.kind !== 'ready') return;
      const position = positionForBlock(load.session, id);
      setEvidenceSelection(id);
      if (position) {
        select(position);
        open(id);
      }
      return position ? 'review' : 'evidence';
    },
    [load, select, open],
  );
  return {
    load,
    view,
    session: load.kind === 'ready' ? load.session : null,
    opened,
    evidenceSelection,
    clearEvidenceSelection: () => setEvidenceSelection(null),
    select,
    open,
    inspect,
    note,
    replace,
    applyMap,
    jump,
    loadDemo,
  };
}
export type ReviewController = ReturnType<typeof useReview>;
