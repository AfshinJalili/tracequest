import { Button } from '@/components/ui/button';
import { type Position, type ReviewView } from '@/domains/review';
export function NotesView({
  view,
  onSelect,
}: {
  view: ReviewView;
  onSelect: (position: Position) => void;
}) {
  return (
    <section className="secondary-view">
      <h2>Notes</h2>
      {view.notes.length ? (
        view.notes.map((note) => (
          <article key={note.stepId} className="review-note">
            <small>
              {note.flowTitle}
              {note.flagged ? ' · Flagged' : ''}
            </small>
            <Button variant="link" onClick={() => onSelect(note.position)}>
              {note.title}
            </Button>
            <p>{note.text}</p>
          </article>
        ))
      ) : (
        <p>No notes yet.</p>
      )}
    </section>
  );
}
