import { Button } from '@/components/ui/button';
import { StatusIcon } from './status-icon';
import { type BlockId, type ReviewView } from '@/domains/review';
export function CoverageView({
  view,
  onSelect,
}: {
  view: ReviewView;
  onSelect: (id: BlockId) => void;
}) {
  return (
    <section className="secondary-view">
      <h2>Coverage</h2>
      <p>
        {view.coverage.inspected} of {view.coverage.total} blocks reviewed. {view.coverage.flags}{' '}
        flagged. {view.coverage.unmapped} unmapped. {view.coverage.missing} patches unavailable.
      </p>
      <div className="coverage-list">
        {view.blocks.map((block) => (
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
      </div>
    </section>
  );
}
