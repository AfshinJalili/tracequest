import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onClearSelection,
}: {
  view: ReviewView;
  session: ReviewSession;
  selectedId: BlockId | null;
  onOpen: (id: BlockId) => void;
  onPrepare: () => void;
  onImport: () => void;
  onBack: () => void;
  onClearSelection: () => void;
}) {
  const [path, setPath] = useState('');
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const available = view.kind === 'review' ? view.unmappedFiles : view.evidenceFiles;
  const files = available.filter((file) =>
    file.path.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const target = selectedId ? view.blocks.find((block) => block.id === selectedId)?.path : null;
  const file = files.find((file) => file.path === (target ?? path)) ?? files[0];
  const selectedIndex = file?.blocks.findIndex((block) => block.id === selectedId) ?? -1;
  const currentPage = Math.min(
    selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE_SIZE) : page,
    Math.max(0, Math.ceil((file?.blocks.length ?? 0) / PAGE_SIZE) - 1),
  );
  const visible = file?.blocks.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE) ?? [];
  return (
    <section className="secondary-view evidence-inbox">
      <h2>{view.kind === 'review' ? 'Unmapped evidence' : 'Evidence imported'}</h2>
      {view.kind === 'evidence' ? <p>Import an authored review pack to start reviewing.</p> : null}
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
      <Input
        type="search"
        aria-label="Filter source files"
        placeholder="Filter files…"
        value={query}
        onChange={(event) => {
          onClearSelection();
          setQuery(event.target.value);
          setPath('');
          setPage(0);
        }}
        className="evidence-search"
      />
      {file ? (
        <>
          <label className="evidence-file-label" htmlFor="evidence-file">
            Source file
          </label>
          <select
            id="evidence-file"
            value={file.path}
            onChange={(event) => {
              onClearSelection();
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
              Blocks {currentPage * PAGE_SIZE + 1}–
              {Math.min((currentPage + 1) * PAGE_SIZE, file.blocks.length)} of {file.blocks.length}
            </span>
            {file.blocks.length > PAGE_SIZE ? (
              <div>
                <Button
                  variant="ghost"
                  disabled={currentPage === 0}
                  onClick={() => {
                    setPath(file.path);
                    onClearSelection();
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
                    onClearSelection();
                    setPage(currentPage + 1);
                  }}
                >
                  Next blocks
                </Button>
              </div>
            ) : null}
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
        <p>{query ? 'No matching files.' : 'No unmapped evidence.'}</p>
      )}
    </section>
  );
}
