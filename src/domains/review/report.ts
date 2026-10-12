import { reviewView } from './view';
import { type ReviewSession } from './schema';
export function reviewReport(session: ReviewSession): string {
  const view = reviewView(session, new Set());
  let text = `# Review: ${view.pack.pr.title}\n\n${view.pack.pr.html_url ?? 'Local diff'}\n\n${view.coverage.inspected}/${view.coverage.total} evidence blocks inspected. ${view.coverage.flags} flagged. ${view.coverage.missing} patches unavailable.\nMapping: ${view.pack.mapping}. This is a review record, not an approval.\n`;
  for (const flow of view.flows) {
    text += `\n## ${flow.title}\n`;
    for (const step of flow.steps) {
      text += `\n- [${step.status === 'pending' ? ' ' : 'x'}] ${step.title}\n`;
      const note = session.state.notes[step.id];
      if (note) text += `  Note: ${note}\n`;
    }
  }
  text += '\n## Flagged / unreviewed evidence\n';
  for (const block of view.blocks)
    if (block.status !== 'done')
      text += `\n- ${block.status === 'flag' ? 'FLAG' : 'TODO'} ${block.path}:${block.start}-${block.end}\n`;
  return text;
}
