import { execFileSync } from 'node:child_process';

export function repositoryGit(repo) {
  return (...parameters) =>
    execFileSync('git', ['-C', repo, ...parameters], { encoding: 'utf8', maxBuffer: 50_000_000 });
}

export function readReviewSnapshot(pack, repo) {
  const git = repositoryGit(repo);
  const head = git('rev-parse', 'HEAD').trim();
  const base = git('rev-parse', pack.pr.base.sha).trim();
  const changedPaths = git('diff', '--name-only', '-z', base, head).split('\0').filter(Boolean);
  const readSource = (sha, filename) => {
    if (!git('ls-tree', '-z', sha, '--', filename)) return null;
    return git('show', `${sha}:${filename}`);
  };
  const files = Object.fromEntries(
    pack.files
      .filter((file) => file.patch)
      .map((file) => [
        file.filename,
        {
          base: readSource(base, file.previous_filename ?? file.filename),
          head: readSource(head, file.filename),
        },
      ]),
  );
  const context = Object.fromEntries(
    Object.keys(pack.sources).map((filename) => [filename, readSource(head, filename)]),
  );
  return { head, base, changedPaths, files, context };
}
