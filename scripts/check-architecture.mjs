import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = path.resolve('src'),
  failures = [];
function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
}
for (const file of walk(root).filter((file) => /\.tsx?$/.test(file))) {
  const relative = path.relative(root, file).replaceAll('\\', '/'),
    source = fs.readFileSync(file, 'utf8'),
    ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true),
    domain = relative.startsWith('domains/'),
    adapter = relative.startsWith('integrations/') || relative.startsWith('persistence/');
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const target = statement.moduleSpecifier.text;
    if (!domain && /^@\/domains\/[^/]+\//.test(target))
      failures.push(`${relative}: domain internals must be imported through its public contract`);
    if (domain && !target.startsWith('.') && target !== 'zod')
      failures.push(`${relative}: domain may import only its owner and schema validator`);
    if (adapter && /\/(features|components|app)\//.test(target))
      failures.push(`${relative}: adapter cannot depend on presentation or routing`);
  }
  function visit(node) {
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (
        domain &&
        ['window', 'document', 'localStorage', 'fetch', 'Date', 'useState', 'useEffect'].includes(
          name,
        )
      )
        failures.push(`${relative}: domain uses platform or React API ${name}`);
      if (
        !adapter &&
        !relative.startsWith('components/ui/') &&
        ['localStorage', 'fetch'].includes(name)
      )
        failures.push(`${relative}: platform access belongs in persistence or integrations`);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      failures.push(`${relative}: runtime imports are not allowed`);
    if (ts.isAsExpression(node) && !relative.startsWith('components/ui/'))
      failures.push(`${relative}: unchecked type assertion`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
if (failures.length) {
  process.stderr.write([...new Set(failures)].join('\n') + '\n');
  process.exit(1);
}
process.stdout.write('Architecture boundaries passed.\n');
