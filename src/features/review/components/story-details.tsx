import { type ReviewView } from '@/domains/review';

type Flow = ReviewView['flows'][number];
type Example = NonNullable<Flow['story']>['examples'][number];
type Rationale = NonNullable<Flow['steps'][number]['rationale']>;

function References({ references }: { references: Example['references'] }) {
  return (
    <ul className="story-references">
      {references.map((reference) => (
        <li key={reference.label}>
          {reference.url ? (
            <a href={reference.url} target="_blank" rel="noopener noreferrer">
              {reference.label}
            </a>
          ) : (
            <code>{reference.label}</code>
          )}
        </li>
      ))}
    </ul>
  );
}

export function StoryExamples({ examples }: { examples: Example[] }) {
  return (
    <div className="story-examples">
      {examples.map((example, index) => (
        <details className="story-detail" key={index}>
          <summary>
            {example.title}
            <span>{example.basisLabel}</span>
          </summary>
          <p>{example.preconditions}</p>
          <dl className="story-values">
            <div>
              <dt>Input</dt>
              <dd>
                <pre>{example.input}</pre>
              </dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>
                <pre>{example.output}</pre>
              </dd>
            </div>
          </dl>
          <p>
            <span className="story-label">State change</span>
            {example.stateChange}
          </p>
          {example.basis === 'executed' ? (
            <div className="example-run">
              <p>{example.run.environment}</p>
              <pre>{example.run.command}</pre>
            </div>
          ) : null}
          <References references={example.references} />
        </details>
      ))}
    </div>
  );
}

export function FlowStory({ flow }: { flow: Flow }) {
  if (!flow.story) return null;
  return (
    <details className="story-detail flow-story">
      <summary>Flow overview</summary>
      <p>{flow.summary}</p>
      <dl className="story-values">
        <div>
          <dt>Input</dt>
          <dd>{flow.story.input}</dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>{flow.story.output}</dd>
        </div>
      </dl>
      <StoryExamples examples={flow.story.examples} />
    </details>
  );
}

export function StepRationale({ rationale }: { rationale: Rationale }) {
  return (
    <details className="story-detail step-rationale">
      <summary>
        Why this step<span>{rationale.basisLabel}</span>
      </summary>
      <p>{rationale.text}</p>
      <References references={rationale.references} />
    </details>
  );
}
