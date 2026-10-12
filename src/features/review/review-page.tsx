import {
  ChevronDown,
  Download,
  GitBranch,
  Import,
  LoaderCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { agentReviewPrompt, reviewReport, type Position, type StepId } from '@/domains/review';
import { downloadText } from '@/integrations/files';
import { type ModelSettings } from '@/integrations/model';
import { ModelSettingsDialog } from '@/features/ai/model-settings-dialog';
import { PromptDialog, type PromptRequest } from '@/features/ai/prompt-dialog';
import { ImportDialog } from '@/features/import/import-dialog';
import { SettingsDialog } from '@/features/settings/settings-dialog';
import { usePreferences } from '@/features/settings/use-preferences';
import { ReviewSidebar, type ReviewScreen } from './components/review-sidebar';
import { FlowList } from './components/flow-list';
import { EvidenceInbox } from './components/evidence-inbox';
import { StepView, type StepDetailTab } from './components/step-view';
import { CoverageView } from './components/coverage-view';
import { NotesView } from './components/notes-view';
import { FlagDialog } from './components/flag-dialog';
import { ModelsDialog } from './components/models-dialog';
import { useReview } from './use-review';
import { cn } from '@/lib/utils';
export function ReviewPage() {
  const review = useReview(),
    { view, session } = review;
  const { preferences, setKeyboardShortcuts } = usePreferences();
  const [screen, setScreen] = useState<ReviewScreen>('review'),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [detail, setDetail] = useState<{ step: StepId; tab: StepDetailTab } | null>(null),
    [sheet, setSheet] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [preferencesOpen, setPreferencesOpen] = useState(false),
    [flagOpen, setFlagOpen] = useState(false),
    [modelsOpen, setModelsOpen] = useState(false),
    [settings, setSettings] = useState<ModelSettings | null>(null),
    [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const sidebarButton = useRef<HTMLButtonElement>(null);
  const restoreSidebarFocus = useRef(false);
  const toggleSidebar = useCallback(() => {
    restoreSidebarFocus.current = true;
    setSidebarOpen((value) => !value);
  }, []);
  useEffect(() => {
    if (restoreSidebarFocus.current) {
      sidebarButton.current?.focus();
      restoreSidebarFocus.current = false;
    }
  }, [sidebarOpen]);
  const select = (position: Position) => {
    review.select(position);
    setScreen('review');
    setSheet(false);
  };
  useEffect(() => {
    if (!preferences.keyboardShortcuts) return;
    function key(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event
          .composedPath()
          .some(
            (target) =>
              target instanceof Element &&
              target.closest(
                'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"],[role="menu"]',
              ),
          )
      )
        return;
      if (
        importOpen ||
        settingsOpen ||
        preferencesOpen ||
        flagOpen ||
        modelsOpen ||
        prompt ||
        sheet
      )
        return;
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleSidebar();
      }
      if (event.key.toLowerCase() === 'j' && view?.kind === 'review' && view.next) {
        event.preventDefault();
        review.select(view.next);
      }
      if (event.key.toLowerCase() === 'k' && view?.kind === 'review' && view.previous) {
        event.preventDefault();
        review.select(view.previous);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [
    view,
    review.select,
    importOpen,
    settingsOpen,
    preferencesOpen,
    preferences.keyboardShortcuts,
    flagOpen,
    modelsOpen,
    prompt,
    sheet,
    toggleSidebar,
  ]);
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
  const sidebarLabel = sidebarOpen ? 'Close sidebar' : 'Open sidebar';
  const detailTab = view.kind === 'review' && detail?.step === view.step.id ? detail.tab : 'code';
  const selectDetail = (tab: StepDetailTab) => {
    if (view.kind === 'review') setDetail({ step: view.step.id, tab });
  };
  const sidebarToggle = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={sidebarButton}
          variant="ghost"
          size="icon-sm"
          className="sidebar-toggle"
          aria-label={sidebarLabel}
          aria-expanded={sidebarOpen}
          aria-controls="review-sidebar"
          onClick={toggleSidebar}
        >
          {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{sidebarLabel}</TooltipContent>
    </Tooltip>
  );
  return (
    <div className={cn('review-app', !sidebarOpen && 'sidebar-collapsed')}>
      <aside id="review-sidebar" className="desktop-sidebar" hidden={!sidebarOpen}>
        <ReviewSidebar
          view={view}
          screen={screen}
          onScreen={setScreen}
          onSelect={select}
          onSettings={() => setPreferencesOpen(true)}
          sidebarToggle={sidebarOpen ? sidebarToggle : null}
        />
      </aside>
      <div className="review-workspace">
        <header className="workspace-topbar">
          <div className="desktop-topbar-start">
            {!sidebarOpen ? sidebarToggle : null}
            <div className="desktop-topbar-repo">
              <strong>{view.repo}</strong>
              <span>{view.sourceLabel}</span>
            </div>
          </div>
          <a href="#/" className="mobile-app-brand">
            <GitBranch />
            TraceQuest
          </a>
          <div className="topbar-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="ask-action"
                  onClick={() => {
                    setScreen('review');
                    selectDetail('ask');
                    questionInput.current?.focus();
                  }}
                  disabled={view.kind !== 'review'}
                  aria-pressed={
                    view.kind === 'review' && screen === 'review' && detailTab === 'ask'
                  }
                >
                  <MessageSquare />
                  Ask AI
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ask about this step’s code</TooltipContent>
            </Tooltip>
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
                <DropdownMenuItem onSelect={() => setPreferencesOpen(true)}>
                  <Settings2 />
                  Settings
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
              <Button
                variant="ghost"
                onClick={() =>
                  setPrompt({
                    kind: 'mapping',
                    text: agentReviewPrompt(session.pack),
                  })
                }
              >
                Agent review
              </Button>
            </div>
          </section>
          {view.kind === 'review' ? (
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
          ) : null}
          {screen === 'review' && (view.kind === 'evidence' || review.evidenceSelection) ? (
            <EvidenceInbox
              view={view}
              session={session}
              selectedId={review.evidenceSelection}
              onOpen={review.open}
              onBack={review.clearEvidenceSelection}
              onImport={() => setImportOpen(true)}
              onPrepare={() =>
                setPrompt({
                  kind: 'mapping',
                  text: agentReviewPrompt(session.pack),
                })
              }
            />
          ) : screen === 'review' ? (
            <StepView
              review={review}
              settings={settings}
              onSettings={() => setSettingsOpen(true)}
              onPrompt={setPrompt}
              onFlag={() => setFlagOpen(true)}
              detailTab={detailTab}
              onDetailTabChange={selectDetail}
              questionInput={questionInput}
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
      <SettingsDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        preferences={preferences}
        onKeyboardShortcuts={setKeyboardShortcuts}
        onModelSettings={() => {
          setPreferencesOpen(false);
          setSettingsOpen(true);
        }}
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
        title={view.kind === 'review' ? view.step.title : ''}
        note={view.kind === 'review' ? view.note : ''}
        onSave={(text) => {
          review.note(text);
          review.inspect('flag');
        }}
      />
      <ModelsDialog open={modelsOpen} onOpenChange={setModelsOpen} view={view} />
    </div>
  );
}
