import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { type BlockId, type ReviewSession, type ReviewView } from '@/domains/review';
import { downloadText } from '@/integrations/files';
import { EvidenceCode } from './code-block';
import { MissingContext } from './missing-context';
const PAGE_SIZE = 12;
export function EvidenceInbox({
  view,
  session,
  selectedId,
  onOpen,
  onPrepare,
  onImport,
  onBack,
}: {
  view: ReviewView;
  session: ReviewSession;
  selectedId: BlockId | null;
  onOpen: (id: BlockId) => void;
  onPrepare: () => void;
  onImport: () => void;
  onBack: () => void;
}) {
  const [path, setPath] = useState('');
  const [page, setPage] = useState(0);
  const files = view.kind === 'review' ? view.unmappedFiles : view.evidenceFiles;
  const target = selectedId ? view.blocks.find((block) => block.id === selectedId)?.path : null;
  const file = files.find((file) => file.path === (target ?? path)) ?? files[0];
  const selectedIndex = file?.blocks.findIndex((block) => block.id === selectedId) ?? -1;
  const currentPage = selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE_SIZE) : page;
  const visible = file?.blocks.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE) ?? [];
  return (
    <section className="secondary-view evidence-inbox">
      <h2>{view.kind === 'review' ? 'Unmapped evidence' : 'Evidence imported'}</h2>
      {view.kind === 'evidence' ? (
        <p>Import an agent-authored review pack to review behavior. Raw code has no review plan.</p>
      ) : null}
      <div className="evidence-intake-actions">
        <Button onClick={onPrepare}>Agent review</Button>
        <Button variant="outline" onClick={onImport}>
          Import authored review
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            downloadText(
              'tracequest-evidence.json',
              JSON.stringify(session.pack, null, 2),
              'application/json',
            )
          }
        >
          Export evidence
        </Button>
        {view.kind === 'review' ? (
          <Button variant="ghost" onClick={onBack}>
            Back to flow
          </Button>
        ) : null}
      </div>
      <MissingContext gaps={view.contextMissing} />
      {file ? (
        <>
          <label className="evidence-file-label" htmlFor="evidence-file">
            Source file
          </label>
          <select
            id="evidence-file"
            value={file.path}
            onChange={(event) => {
              onBack();
              setPath(event.target.value);
              setPage(0);
            }}
          >
            {files.map((file) => (
              <option key={file.path} value={file.path}>
                {file.path} ({file.blocks.length} blocks)
              </option>
            ))}
          </select>
          <div className="evidence-page-controls">
            <span>
              {files.length} files · {file.blocks.length} blocks in this file
            </span>
            <div>
              <Button
                variant="ghost"
                disabled={currentPage === 0}
                onClick={() => {
                  setPath(file.path);
                  onBack();
                  setPage(currentPage - 1);
                }}
              >
                Previous blocks
              </Button>
              <Button
                variant="ghost"
                disabled={(currentPage + 1) * PAGE_SIZE >= file.blocks.length}
                onClick={() => {
                  setPath(file.path);
                  onBack();
                  setPage(currentPage + 1);
                }}
              >
                Next blocks
              </Button>
            </div>
          </div>
          <div className="code-evidence-list">
            {visible.map((block) => (
              <div key={block.id}>
                {block.unmappedReason ? (
                  <p className="unmapped-reason">{block.unmappedReason}</p>
                ) : null}
                <EvidenceCode block={block} session={session} onOpen={onOpen} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>No unmapped evidence.</p>
      )}
    </section>
  );
}
