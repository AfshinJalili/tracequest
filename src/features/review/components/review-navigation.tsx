import { Button } from '@/components/ui/button';

export type ReviewScreen = 'review' | 'coverage' | 'notes' | 'evidence';
export function ReviewNavigation({
  primaryLabel,
  screen,
  onScreen,
  label = 'Review views',
}: {
  primaryLabel: string;
  screen: ReviewScreen;
  onScreen: (screen: ReviewScreen) => void;
  label?: string;
}) {
  const destinations = [
    { screen: 'review', label: primaryLabel },
    { screen: 'coverage', label: 'Coverage' },
    { screen: 'notes', label: 'Notes' },
  ] satisfies { screen: ReviewScreen; label: string }[];
  return (
    <nav className="review-navigation" aria-label={label}>
      {destinations.map((destination) => {
        const selected =
          screen === destination.screen ||
          (screen === 'evidence' && destination.screen === 'review');
        return (
          <Button
            key={destination.screen}
            variant={selected ? 'secondary' : 'ghost'}
            aria-current={selected ? 'page' : undefined}
            onClick={() => onScreen(destination.screen)}
          >
            {destination.label}
          </Button>
        );
      })}
    </nav>
  );
}
