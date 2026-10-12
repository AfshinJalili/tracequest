import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusIcon } from './status-icon';
import { type Position, type AuthoredReviewView } from '@/domains/review';
export function StepNavigator({
  view,
  onSelect,
}: {
  view: AuthoredReviewView;
  onSelect: (position: Position) => void;
}) {
  return (
    <div className="step-navigator">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="step-picker" aria-label="Choose flow step">
            <StatusIcon status={view.step.status} />
            <span>{view.step.title}</span>
            <span className="step-fraction">
              {view.step.number} / {view.flow.stepCount}
            </span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="step-picker-menu">
          {view.flow.steps.map((step) => (
            <DropdownMenuItem
              key={step.id}
              onSelect={() => onSelect(step.position)}
              className="step-menu-item"
            >
              <StatusIcon status={step.status} />
              <span>{step.title}</span>
              {step.selected ? <span className="current-step-label">Current</span> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="step-navigator-progress">{view.flow.inspected} reviewed</span>
    </div>
  );
}
