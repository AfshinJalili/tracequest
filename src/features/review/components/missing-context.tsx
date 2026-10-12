export function MissingContext({ gaps }: { gaps: string[] }) {
  if (!gaps.length) return null;
  return (
    <details className="missing-context">
      <summary>Missing context</summary>
      <ul>
        {gaps.map((gap, index) => (
          <li key={index}>{gap}</li>
        ))}
      </ul>
    </details>
  );
}
