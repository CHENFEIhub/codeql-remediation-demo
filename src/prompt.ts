import { GitHubIssue } from "./types";

export function buildRemediationPrompt(
  issue: GitHubIssue,
  repo: string
): string {
  const issueBody = issue.body || "No additional details provided.";

  return `You are remediating a security vulnerability found by CodeQL in the repository ${repo}.

## GitHub Issue #${issue.number}: ${issue.title}

${issueBody}

## Issue URL
${issue.html_url}

## Instructions

1. **Understand the Vulnerability**: Read the issue carefully. Understand the CWE, the affected file(s), and the root cause.

2. **Navigate to the Code**: Find the affected file(s) and line(s) mentioned in the issue. Read the surrounding code to understand the context and data flow.

3. **Apply the Correct Fix**: Use the recommended remediation approach described in the issue. Apply the minimal change that resolves the vulnerability without altering existing behavior for non-vulnerable code paths. Follow existing code conventions and patterns.

4. **Add or Update Tests**: If tests exist for the affected code, update them to cover the fixed path. If no tests exist, add a focused test that verifies the vulnerability is resolved (e.g., that a malicious input is properly handled).

5. **Verify**: Run the linter and any relevant tests to ensure your fix doesn't break anything.

6. **Create a Pull Request**:
   - Branch name: \`security/codeql-issue-${issue.number}\`
   - PR title: \`fix(security): ${issue.title}\`
   - Add labels: \`security\`, \`codeql-auto-fix\`
   - PR body must include:
     - A link to the GitHub issue: ${issue.html_url}
     - A brief explanation of the vulnerability
     - What the fix does and why it's correct
     - Any relevant CWE references from the issue

## Important Constraints
- Make the MINIMAL fix necessary. Do NOT refactor unrelated code.
- Follow existing code style and patterns in the repository.
- Do NOT introduce new dependencies unless absolutely necessary for the fix.
- The PR must be reviewable — one focused fix per PR.
`;
}
