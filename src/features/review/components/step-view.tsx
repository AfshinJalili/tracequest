import { ArrowLeft, ArrowRight, Flag, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { type ReviewController } from '../use-review';
import { type ModelSettings } from '@/integrations/model';
import { type PromptRequest } from '@/features/ai/prompt-dialog';
import { AiComposer } from '@/features/ai/ai-composer';
import { StepNavigator } from './step-navigator';
import { ContextCode, EvidenceCode } from './code-block';
export function StepView({
  review,
  settings,
  onSettings,
  onPrompt,
  onFlag,
  showAi,
}: {
  review: ReviewController;
  settings: ModelSettings | null;
  onSettings: () => void;
  onPrompt: (request: PromptRequest) => void;
  onFlag: () => void;
  showAi: boolean;
}) {
  const { view, session } = review;
  const [noteOpen, setNoteOpen] = useState(false);
  if (!view || !session) return null;
  return (
    <section className="step-view">
      <div className="flow-heading">
        <h2>{view.flow.title}</h2>
        <span>
          {view.flow.inspected} / {view.flow.stepCount} reviewed
        </span>
      </div>
      <StepNavigator view={view} onSelect={review.select} />
      <div className="step-heading">
        <div>
          <span className="step-position">
            Step {view.step.number} of {view.flow.stepCount}
          </span>
          <h3>{view.step.title}</h3>
        </div>
        <span className="step-state">
          {view.step.status === 'done'
            ? 'Reviewed'
            : view.step.status === 'flag'
              ? 'Flagged'
              : view.step.kind}
        </span>
      </div>
      <p className="desktop-step-summary">{view.step.summary}</p>
      <div className="model-tokens">
        {view.entities.map((entity) => (
          <span key={entity}>{entity}</span>
        ))}
      </div>
      <Tabs key={view.step.id} defaultValue="code" className="step-detail-tabs">
        <TabsList className="step-tabs">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="ask">Ask AI</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <p className="step-summary">{view.step.summary}</p>
          <div className="input-output">
            <div>
              <h4>Input</h4>
              <p>{view.step.input}</p>
            </div>
            <div>
              <h4>Output</h4>
              <p>{view.step.output}</p>
            </div>
          </div>
          <div className="review-question">
            <h4>Review question</h4>
            <p>{view.step.question}</p>
          </div>
        </TabsContent>
        <TabsContent value="code">
          <div className="code-evidence-list">
            {view.evidence.map((block) => (
              <EvidenceCode key={block.id} block={block} session={session} onOpen={review.open} />
            ))}
          </div>
          <ContextCode session={session} step={view.step} />
        </TabsContent>
        <TabsContent value="ask">
          <AiComposer
            session={session}
            step={view.step}
            settings={settings}
            onSettings={onSettings}
            onPrompt={onPrompt}
          />
        </TabsContent>
      </Tabs>
      {showAi ? (
        <div className="desktop-ai">
          <AiComposer
            session={session}
            step={view.step}
            settings={settings}
            onSettings={onSettings}
            onPrompt={onPrompt}
          />
        </div>
      ) : null}
      <Collapsible
        open={noteOpen || Boolean(view.note)}
        onOpenChange={setNoteOpen}
        className="step-note"
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost">
            <StickyNote />
            {view.note ? 'Edit note' : 'Add note'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Textarea
            value={view.note}
            onChange={(event) => review.note(event.target.value)}
            placeholder="Note about this step…"
            aria-label="Step note"
            rows={3}
          />
        </CollapsibleContent>
      </Collapsible>
      <div className="step-action-bar">
        <Button
          variant="outline"
          disabled={!view.previous}
          onClick={() => {
            if (view.previous) review.select(view.previous);
          }}
        >
          <ArrowLeft />
          <span>Previous</span>
        </Button>
        <div>
          <Button variant="outline" disabled={!view.canInspect} onClick={onFlag}>
            <Flag />
            Flag
          </Button>
          <Button
            disabled={!view.canInspect}
            onClick={() => review.inspect('done')}
            title={view.canInspect ? 'Mark inspected' : 'Open every code block first'}
          >
            {view.next ? 'Review & next' : 'Finish review'}
            <ArrowRight />
          </Button>
        </div>
      </div>
      {!view.canInspect ? (
        <p className="inspection-hint">Open each code block to enable review.</p>
      ) : null}
    </section>
  );
}
