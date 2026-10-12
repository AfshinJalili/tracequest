import { ArrowUp, Copy, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { REVIEW_SYSTEM, stepContext, type ReviewSession, type ReviewStep } from '@/domains/review';
import { askModel, type ModelSettings } from '@/integrations/model';
import { type PromptRequest } from './prompt-dialog';
export function AiComposer({
  session,
  step,
  settings,
  onSettings,
  onPrompt,
  questionInput,
}: {
  session: ReviewSession;
  step: ReviewStep;
  settings: ModelSettings | null;
  onSettings: () => void;
  onPrompt: (request: PromptRequest) => void;
  questionInput: RefObject<HTMLTextAreaElement | null>;
}) {
  const [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setQuestion('');
    setAnswer('');
    setError('');
    setPending(false);
    return () => controller.current?.abort();
  }, [session.pack.id, step.id]);
  async function submit() {
    if (!question.trim() || pending) return;
    if (!settings) {
      onPrompt({
        kind: 'question',
        text: REVIEW_SYSTEM + '\n\n' + stepContext(session, step, question),
      });
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setError('');
    try {
      const result = await askModel(settings, session, step, question, request.signal);
      if (!request.signal.aborted) setAnswer(result);
    } catch (error) {
      if (!request.signal.aborted)
        setError(error instanceof Error ? error.message : 'Model request failed.');
    } finally {
      if (!request.signal.aborted) setPending(false);
    }
  }
  return (
    <section className="ai-section">
      <div className="ai-section-heading">
        <span>Ask about this step</span>
        <Button variant="ghost" size="icon-sm" aria-label="AI settings" onClick={onSettings}>
          <Settings2 />
        </Button>
      </div>
      <Button
        variant="ghost"
        className="question-suggestion"
        onClick={() => setQuestion(step.question)}
      >
        {step.question}
      </Button>
      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Textarea
          ref={questionInput}
          autoFocus
          aria-label="Question about this step"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this step…"
          rows={3}
        />
        <div className="composer-toolbar">
          <span>{settings ? settings.model : 'No model connected'}</span>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Copy context for ChatGPT"
              onClick={() =>
                onPrompt({
                  kind: 'question',
                  text:
                    REVIEW_SYSTEM + '\n\n' + stepContext(session, step, question || step.question),
                })
              }
            >
              <Copy />
            </Button>
            <Button
              type="submit"
              size="icon-sm"
              disabled={pending || !question.trim()}
              aria-label="Ask AI"
            >
              {pending ? '…' : <ArrowUp />}
            </Button>
          </div>
        </div>
      </form>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {answer ? (
        <div className="ai-answer" aria-live="polite">
          {answer}
        </div>
      ) : null}
    </section>
  );
}
