import { GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusIcon } from './status-icon';
import { cn } from '@/lib/utils';
import { type Position, type ReviewView } from '@/domains/review';
export function FlowList({
  view,
  onSelect,
}: {
  view: ReviewView;
  onSelect: (position: Position) => void;
}) {
  return (
    <nav className="flow-list" aria-label="Review flows">
      {view.flows.map((flow) => (
        <div key={flow.id} className="flow-group">
          <Button
            variant="ghost"
            className={cn('flow-item', flow.selected && 'selected')}
            onClick={() => onSelect(flow.startPosition)}
          >
            <GitBranch />
            <span>{flow.title}</span>
            <small>
              {flow.inspected}/{flow.stepCount}
            </small>
          </Button>
          {flow.selected ? (
            <ol className="flow-step-list">
              {flow.steps.map((step) => (
                <li key={step.id}>
                  <Button
                    variant="ghost"
                    className={cn('flow-step-item', step.selected && 'selected')}
                    aria-current={step.selected ? 'step' : undefined}
                    onClick={() => onSelect(step.position)}
                  >
                    <StatusIcon status={step.status} />
                    <span>{step.title}</span>
                  </Button>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
