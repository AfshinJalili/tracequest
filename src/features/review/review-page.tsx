import {
  ChevronDown,
  Download,
  GitBranch,
  Import,
  LoaderCircle,
  MessageSquare,
  PanelLeftClose,
  Settings2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { mappingPrompt, reviewReport, type Position } from '@/domains/review';
import { downloadText } from '@/integrations/files';
import { mapWithModel, type ModelSettings } from '@/integrations/model';
import { ModelSettingsDialog } from '@/features/ai/model-settings-dialog';
import { PromptDialog, type PromptRequest } from '@/features/ai/prompt-dialog';
import { ImportDialog } from '@/features/import/import-dialog';
import { ReviewSidebar, type ReviewScreen } from './components/review-sidebar';
import { FlowList } from './components/flow-list';
import { StepView } from './components/step-view';
import { CoverageView } from './components/coverage-view';
import { NotesView } from './components/notes-view';
import { FlagDialog } from './components/flag-dialog';
import { ModelsDialog } from './components/models-dialog';
import { useReview } from './use-review';
import { cn } from '@/lib/utils';
export function ReviewPage() {
  const review = useReview(),
    { view, session } = review;
  const [screen, setScreen] = useState<ReviewScreen>('review'),
    [focus, setFocus] = useState(false),
    [showAi, setShowAi] = useState(false),
    [sheet, setSheet] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [flagOpen, setFlagOpen] = useState(false),
    [modelsOpen, setModelsOpen] = useState(false),
    [settings, setSettings] = useState<ModelSettings | null>(null),
    [prompt, setPrompt] = useState<PromptRequest | null>(null),
    [mapping, setMapping] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const currentPack = useRef(session?.pack.id);
  currentPack.current = session?.pack.id;
  useEffect(() => () => request.current?.abort(), []);
  const select = (position: Position) => {
    review.select(position);
    setScreen('review');
    setSheet(false);
  };
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input,textarea,select,[role="dialog"]'))
      )
        return;
      if (importOpen || settingsOpen || flagOpen || modelsOpen || prompt || sheet) return;
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFocus((value) => !value);
      }
      if (event.key.toLowerCase() === 'j' && view?.next) {
        event.preventDefault();
        review.select(view.next);
      }
      if (event.key.toLowerCase() === 'k' && view?.previous) {
        event.preventDefault();
        review.select(view.previous);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [view, review.select, importOpen, settingsOpen, flagOpen, modelsOpen, prompt, sheet]);
  async function generate() {
    if (!session) return;
    if (!settings) {
      setPrompt({ kind: 'mapping', text: mappingPrompt(session.pack), pack: session.pack });
      return;
    }
    const original = session.pack.id,
      controller = new AbortController();
    request.current = controller;
    try {
      const pack = await mapWithModel(
        settings,
        session.pack,
        (current, total) => setMapping(`Generating ${current}/${total}`),
        controller.signal,
      );
      if (currentPack.current === original) {
        review.applyMap(pack);
        toast.success('Flows updated.');
      }
    } catch (error) {
      if (!controller.signal.aborted)
        toast.error(error instanceof Error ? error.message : 'Flow generation failed.');
    } finally {
      setMapping(null);
    }
  }
  if (review.load.kind === 'loading')
    return (
      <div className="app-loading">
        <LoaderCircle className="animate-spin" />
        <span>Loading review…</span>
      </div>
    );
  if (!view || !session)
    return (
      <main className="app-error">
        <h1>Could not load review</h1>
        <p>{review.load.kind === 'error' ? review.load.message : 'No review loaded.'}</p>
        <Button onClick={review.loadDemo}>Load demo</Button>
      </main>
    );
  return (
    <div className={cn('review-app', focus && 'focus-mode')}>
      <aside className="desktop-sidebar">
        <ReviewSidebar
          view={view}
          screen={screen}
          onScreen={setScreen}
          onSelect={select}
          onSettings={() => setSettingsOpen(true)}
        />
      </aside>
      <div className="review-workspace">
        <header className="workspace-topbar">
          <div className="desktop-topbar-repo">
            <strong>{view.repo}</strong>
            <span>{view.sourceLabel}</span>
          </div>
          <a href="#/" className="mobile-app-brand">
            <GitBranch />
            TraceQuest
          </a>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              className="focus-action"
              onClick={() => setFocus((value) => !value)}
              aria-pressed={focus}
            >
              <PanelLeftClose />
              {focus ? 'Exit focus' : 'Focus'}
            </Button>
            <Button
              variant="outline"
              className="ask-action"
              onClick={() => setShowAi((value) => !value)}
              aria-pressed={showAi}
            >
              <MessageSquare />
              Ask AI
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Review actions">
                  <Settings2 />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                  <Import />
                  Import PR
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => downloadText('tracequest-review.md', reviewReport(session))}
                >
                  <Download />
                  Export notes
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    downloadText(
                      'tracequest-review.json',
                      JSON.stringify(session, null, 2),
                      'application/json',
                    )
                  }
                >
                  <Download />
                  Export review file
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <Settings2 />
                  AI settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="review-main">
          <section className="pr-overview">
            <div>
              <h1>{view.pack.pr.title}</h1>
              <div className="pr-stats">
                <span>{view.changeStats.files} files</span>
                <span className="added">+{view.changeStats.additions}</span>
                <span className="deleted">−{view.changeStats.deletions}</span>
                <Badge variant="outline">{view.mappingLabel}</Badge>
              </div>
            </div>
            <div className="overview-actions">
              <Button variant="ghost" onClick={() => setModelsOpen(true)}>
                Models
              </Button>
              <Button variant="ghost" disabled={mapping !== null} onClick={() => void generate()}>
                {mapping ?? 'Generate flows'}
              </Button>
            </div>
          </section>
          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetTrigger asChild>
              <Button variant="outline" className="mobile-flow-picker">
                <GitBranch />
                <span>{view.flow.title}</span>
                <ChevronDown />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="flow-sheet">
              <SheetHeader>
                <SheetTitle>Flows</SheetTitle>
                <SheetDescription>
                  {view.steps.inspected} of {view.steps.total} steps reviewed.
                </SheetDescription>
              </SheetHeader>
              <FlowList view={view} onSelect={select} />
              <div className="mobile-secondary-nav">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setScreen('coverage');
                    setSheet(false);
                  }}
                >
                  Coverage
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setScreen('notes');
                    setSheet(false);
                  }}
                >
                  Notes
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          {screen === 'review' ? (
            <StepView
              review={review}
              settings={settings}
              onSettings={() => setSettingsOpen(true)}
              onPrompt={setPrompt}
              onFlag={() => setFlagOpen(true)}
              showAi={showAi}
            />
          ) : screen === 'coverage' ? (
            <CoverageView
              view={view}
              onSelect={(id) => {
                review.jump(id);
                setScreen('review');
              }}
            />
          ) : (
            <NotesView view={view} onSelect={select} />
          )}
        </main>
      </div>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(value) => {
          review.replace(value);
          setScreen('review');
        }}
        onDemo={review.loadDemo}
      />
      <ModelSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={setSettings}
      />
      <PromptDialog request={prompt} onClose={() => setPrompt(null)} onApply={review.applyMap} />
      <FlagDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        title={view.step.title}
        note={view.note}
        onSave={(text) => {
          review.note(text);
          review.inspect('flag');
        }}
      />
      <ModelsDialog open={modelsOpen} onOpenChange={setModelsOpen} view={view} />
    </div>
  );
}
