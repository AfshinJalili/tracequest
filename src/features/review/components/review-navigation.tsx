import { Button } from '@/components/ui/button';

export type ReviewScreen = 'review' | 'coverage' | 'notes';
export function ReviewNavigation({
  primaryLabel,
  screen,
  onScreen,
}: {
  primaryLabel: string;
  screen: ReviewScreen;
  onScreen: (screen: ReviewScreen) => void;
}) {
  return (
    <nav className="review-navigation" aria-label="Review views">
      <Button
        variant={screen === 'review' ? 'secondary' : 'ghost'}
        onClick={() => onScreen('review')}
      >
        {primaryLabel}
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
  );
}
