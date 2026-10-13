import { ArrowLeft, ArrowRight, Flag, StickyNote } from 'lucide-react';
import { useState, type RefObject } from 'react';
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
import { MissingContext } from './missing-context';
export type StepDetailTab = 'summary' | 'code' | 'ask';
export function StepView({
  review,
  settings,
  onSettings,
  onPrompt,
  onFlag,
  detailTab,
  onDetailTabChange,
  questionInput,
}: {
  review: ReviewController;
  settings: ModelSettings | null;
  onSettings: () => void;
  onPrompt: (request: PromptRequest) => void;
  onFlag: () => void;
  detailTab: StepDetailTab;
  onDetailTabChange: (tab: StepDetailTab) => void;
  questionInput: RefObject<HTMLTextAreaElement | null>;
}) {
  const { view, session } = review;
  const [noteOpen, setNoteOpen] = useState(false);
  if (!view || !session || view.kind !== 'review') return null;
  return (
    <section className="step-view">
      <div className="flow-heading">
        <h2>{view.flow.title}</h2>
        <span>
          {view.flow.inspected} / {view.flow.stepCount} reviewed
        </span>
      </div>
      {view.flow.actor ? (
        <dl className="flow-context">
          <div>
            <dt>Actor</dt>
            <dd>{view.flow.actor}</dd>
          </div>
          <div>
            <dt>Trigger</dt>
            <dd>{view.flow.trigger}</dd>
          </div>
          <div>
            <dt>Authorization</dt>
            <dd>{view.flow.authorization}</dd>
          </div>
        </dl>
      ) : null}
      <MissingContext gaps={view.contextMissing} />
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
      {detailTab !== 'summary' ? <p className="desktop-step-summary">{view.step.summary}</p> : null}
      <div className="model-tokens">
        {view.entities.map((entity) => (
          <span key={entity}>{entity}</span>
        ))}
      </div>
      <Tabs
        key={session.pack.id + ':' + (session.pack.pr.head?.sha ?? '') + ':' + view.step.id}
        value={detailTab}
        onValueChange={(tab) => {
          if (tab === 'summary' || tab === 'code' || tab === 'ask') onDetailTabChange(tab);
        }}
        className="step-detail-tabs"
      >
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
        <TabsContent value="ask" forceMount hidden={detailTab !== 'ask'}>
          <AiComposer
            session={session}
            step={view.step}
            settings={settings}
            onSettings={onSettings}
            onPrompt={onPrompt}
            questionInput={questionInput}
            active={detailTab === 'ask'}
          />
        </TabsContent>
      </Tabs>
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
