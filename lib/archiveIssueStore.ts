type StoredArchiveIssue = { id: number; [key: string]: unknown };

const archiveById = new Map<number, StoredArchiveIssue>();

export function rememberArchiveIssues(issues: StoredArchiveIssue[]) {
  for (const issue of issues) archiveById.set(issue.id, issue);
}

export function getArchiveIssueById(id: number): StoredArchiveIssue | undefined {
  return archiveById.get(id);
}
