import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { StatusIcon } from './status-icon';
import { type BlockId, type ReviewView } from '@/domains/review';
export function CoverageView({
  view,
  onSelect,
}: {
  view: ReviewView;
  onSelect: (id: BlockId) => void;
}) {
  const [query, setQuery] = useState('');
  const blocks = view.blocks.filter((block) =>
    [block.path, block.title].join(' ').toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="secondary-view">
      <h2>Coverage</h2>
      <p>
        {view.coverage.inspected} of {view.coverage.total} blocks reviewed. {view.coverage.flags}{' '}
        flagged. {view.coverage.unmapped} unmapped. {view.coverage.missing} patches unavailable.
      </p>
      <Input
        type="search"
        aria-label="Filter evidence"
        placeholder="Filter files or symbols…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="evidence-search"
      />
      <div className="coverage-list">
        {blocks.map((block) => (
          <Button
            key={block.id}
            variant="ghost"
            className="coverage-item"
            onClick={() => onSelect(block.id)}
          >
            <StatusIcon status={block.status} />
            <span>
              <strong>{block.path}</strong>
              <small>
                Lines {block.start}–{block.end}
              </small>
            </span>
            <small>
              {block.missing
                ? 'Source unavailable'
                : block.status === 'done'
                  ? 'Reviewed'
                  : block.status === 'flag'
                    ? 'Flagged'
                    : !block.mapped
                      ? 'Unmapped'
                      : 'Pending'}
            </small>
          </Button>
        ))}
        {!blocks.length ? <p>No matching evidence.</p> : null}
      </div>
    </section>
  );
}
