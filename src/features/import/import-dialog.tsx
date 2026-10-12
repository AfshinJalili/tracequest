import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { importPublicPr } from '@/integrations/github';
import { importReviewFile } from '@/integrations/files';
import { importDiff, startReview, type ReviewSession } from '@/domains/review';
export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  onDemo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (session: ReviewSession) => void;
  onDemo: () => void;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) request.current?.abort();
    return () => request.current?.abort();
  }, [open]);
  async function perform(operation: () => Promise<ReviewSession>) {
    setPending(true);
    setError('');
    try {
      const session = await operation();
      if (request.current?.signal.aborted) return;
      onImport(session);
      onOpenChange(false);
      toast.success('Review imported.');
    } catch (error) {
      if (!request.current?.signal.aborted)
        setError(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import review</DialogTitle>
          <DialogDescription>Load a public GitHub PR or import a local diff.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="github">
          <TabsList className="import-tabs">
            <TabsTrigger value="github">GitHub</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
            <TabsTrigger value="paste">Paste diff</TabsTrigger>
          </TabsList>
          <TabsContent value="github">
            <form
              className="dialog-form"
              onSubmit={(event) => {
                event.preventDefault();
                const value = new FormData(event.currentTarget).get('url');
                if (typeof value !== 'string') return;
                request.current = new AbortController();
                void perform(async () =>
                  startReview(await importPublicPr(value, request.current?.signal)),
                );
              }}
            >
              <label htmlFor="pr-url">Public PR URL</label>
              <Input
                id="pr-url"
                name="url"
                type="url"
                placeholder="https://github.com/owner/repo/pull/123"
                required
              />
              <Button type="submit" disabled={pending}>
                {pending ? 'Loading…' : 'Load PR'}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="file">
            <label className="file-upload" htmlFor="review-file">
              <Upload />
              <span>Choose a diff or review file</span>
              <small>.diff, .patch, .json · up to 3 MB</small>
              <Input
                id="review-file"
                type="file"
                accept=".diff,.patch,.json,.txt"
                disabled={pending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    request.current = new AbortController();
                    void perform(() => importReviewFile(file));
                  }
                }}
              />
            </label>
          </TabsContent>
          <TabsContent value="paste">
            <form
              className="dialog-form"
              onSubmit={(event) => {
                event.preventDefault();
                const raw = new FormData(event.currentTarget).get('diff');
                if (typeof raw !== 'string') return;
                request.current = new AbortController();
                void perform(async () => startReview(importDiff(raw)));
              }}
            >
              <label htmlFor="diff-text">Unified diff</label>
              <Textarea
                id="diff-text"
                name="diff"
                placeholder="git diff base...HEAD"
                rows={7}
                required
              />
              <Button type="submit" disabled={pending}>
                Import diff
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <Button
          variant="link"
          className="demo-link"
          onClick={() => {
            onDemo();
            onOpenChange(false);
          }}
        >
          Load Vendure demo
        </Button>
      </DialogContent>
    </Dialog>
  );
}
