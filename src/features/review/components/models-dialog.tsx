import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { type ReviewView } from '@/domains/review';
export function ModelsDialog({
  view,
  open,
  onOpenChange,
}: {
  view: ReviewView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const entries = view.models;
  const source = entries.find((entry) => entry.path === selected);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setSelected(null);
        onOpenChange(value);
      }}
    >
      <DialogContent className="models-dialog">
        <DialogHeader>
          <DialogTitle>{source ? source.name : 'Models'}</DialogTitle>
          <DialogDescription>
            {source ? 'Pinned source definition.' : 'Data contracts available in this review.'}
          </DialogDescription>
        </DialogHeader>
        {source ? (
          <>
            <Button variant="link" onClick={() => setSelected(null)}>
              All models
            </Button>
            <div className="model-source">
              {source.rows.map((row, index) => (
                <div key={index}>
                  <span>{row.number}</span>
                  <code>{row.text}</code>
                </div>
              ))}
            </div>
            {source.url ? (
              <a href={source.url ?? undefined} target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            ) : null}
          </>
        ) : entries.length ? (
          <div className="model-list">
            {entries.map((entry) => (
              <Button variant="ghost" key={entry.path} onClick={() => setSelected(entry.path)}>
                {entry.name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="form-help">
            No complete model definitions are included. Use the step's source context to inspect
            unchanged contracts.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
