import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
export function FlagDialog({
  open,
  onOpenChange,
  title,
  note,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  note: string;
  onSave: (text: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag step</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            const text = new FormData(event.currentTarget).get('note');
            if (typeof text === 'string') {
              onSave(text);
              onOpenChange(false);
            }
          }}
        >
          <label htmlFor="flag-note">Concern</label>
          <Textarea id="flag-note" name="note" defaultValue={note} rows={5} required />
          <Button type="submit">Save flag</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
