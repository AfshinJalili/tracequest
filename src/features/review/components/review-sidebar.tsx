import { GitBranch, HardDrive, Settings2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FlowList } from './flow-list';
import { type Position, type ReviewView } from '@/domains/review';
export type ReviewScreen = 'review' | 'coverage' | 'notes';
export function ReviewSidebar({
  view,
  screen,
  onScreen,
  onSelect,
  onSettings,
  sidebarToggle,
}: {
  view: ReviewView;
  screen: ReviewScreen;
  onScreen: (screen: ReviewScreen) => void;
  onSelect: (position: Position) => void;
  onSettings: () => void;
  sidebarToggle: ReactNode;
}) {
  return (
    <div className="review-sidebar-content">
      <div className="sidebar-header">
        <a className="app-brand" href="#/">
          <GitBranch />
          TraceQuest
        </a>
        {sidebarToggle}
      </div>
      <div className="repository-context">
        <span>{view.repo}</span>
        <small>{view.sourceLabel}</small>
      </div>
      <nav className="review-navigation" aria-label="Review views">
        <Button
          variant={screen === 'review' ? 'secondary' : 'ghost'}
          onClick={() => onScreen('review')}
        >
          Review
        </Button>
        <Button
          variant={screen === 'coverage' ? 'secondary' : 'ghost'}
          onClick={() => onScreen('coverage')}
        >
          Coverage
        </Button>
        <Button
          variant={screen === 'notes' ? 'secondary' : 'ghost'}
          onClick={() => onScreen('notes')}
        >
          Notes
        </Button>
      </nav>
      <span className="flows-label">Flows</span>
      <FlowList view={view} onSelect={onSelect} />
      <div className="sidebar-bottom">
        <div className="sidebar-progress">
          <span>
            {view.steps.inspected} / {view.steps.total} steps
          </span>
          <span>{view.steps.percent}%</span>
        </div>
        <Progress value={view.steps.percent} aria-label="Review step progress" />
        <div className="local-review-label">
          <HardDrive />
          Local review
        </div>
        <Button variant="ghost" className="sidebar-settings" onClick={onSettings}>
          <Settings2 />
          AI settings
        </Button>
      </div>
    </div>
  );
}
