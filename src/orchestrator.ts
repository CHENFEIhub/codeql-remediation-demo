import { GitHubClient } from "./github";
import { DevinClient } from "./devin";
import { NotificationService } from "./notifications";
import { buildRemediationPrompt } from "./prompt";
import {
  GitHubIssue,
  RemediationJob,
  JobStatus,
  DashboardMetrics,
  AppConfig,
} from "./types";

export class Orchestrator {
  private github: GitHubClient;
  private devin: DevinClient;
  private notifications: NotificationService;
  private config: AppConfig;
  private jobs: Map<string, RemediationJob> = new Map();
  private activeSessionCount = 0;

  constructor(config: AppConfig) {
    this.config = config;
    this.github = new GitHubClient(config.githubToken);
    this.devin = new DevinClient(config.devinApiKey, config.devinOrgId);
    this.notifications = new NotificationService(config.slackWebhookUrl);
  }

  private jobKey(repo: string, issueNumber: number): string {
    return `${repo}#${issueNumber}`;
  }

  private parseRepo(repo: string): { owner: string; name: string } {
    const [owner, name] = repo.split("/");
    return { owner, name };
  }

  private parseSeverityFromIssue(issue: GitHubIssue): string {
    const body = (issue.body || "").toLowerCase();
    const title = issue.title.toLowerCase();
    const combined = `${title} ${body}`;

    if (combined.includes("critical")) return "critical";
    if (combined.includes("high")) return "high";
    if (combined.includes("medium")) return "medium";
    if (combined.includes("low")) return "low";
    return "medium";
  }

  private parseRuleIdFromIssue(issue: GitHubIssue): string {
    const body = issue.body || "";
    // Look for patterns like "Rule: py/sql-injection" or "js/xss"
    const ruleMatch = body.match(
      /(?:rule[:\s]+)?([a-z]+\/[a-z0-9-]+)/i
    );
    if (ruleMatch) return ruleMatch[1];

    // Look for CWE references
    const cweMatch = body.match(/CWE-(\d+)/i);
    if (cweMatch) return `cwe-${cweMatch[1]}`;

    return "unknown";
  }

  async remediateIssue(repo: string, issueNumber: number): Promise<RemediationJob> {
    const key = this.jobKey(repo, issueNumber);

    // Deduplication: skip if already processing
    const existing = this.jobs.get(key);
    if (existing && existing.status !== "failed") {
      console.log(
        `[orchestrator] Issue ${key} already being processed (status: ${existing.status}). Skipping.`
      );
      return existing;
    }

    const { owner, name } = this.parseRepo(repo);

    // Fetch issue details
    console.log(`[orchestrator] Fetching issue #${issueNumber} from ${repo}`);
    const issue = await this.github.getIssue(owner, name, issueNumber);

    // Create job record
    const job: RemediationJob = {
      id: key,
      issueNumber,
      issueTitle: issue.title,
      issueUrl: issue.html_url,
      repo,
      severity: this.parseSeverityFromIssue(issue),
      ruleId: this.parseRuleIdFromIssue(issue),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(key, job);

    // Wait for concurrency slot
    while (this.activeSessionCount >= this.config.maxConcurrentSessions) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Update status and notify
    this.updateJobStatus(job, "in_progress");

    try {
      // Add label to issue
      await this.github.addLabels(owner, name, issueNumber, [
        "remediation-in-progress",
      ]);

      // Build prompt
      const prompt = buildRemediationPrompt(issue, repo);

      // Create Devin session
      console.log(
        `[orchestrator] Creating Devin session for issue #${issueNumber}`
      );
      this.activeSessionCount++;

      const sessionOptions: {
        prompt: string;
        tags: string[];
        repos: string[];
        maxAcuLimit: number;
        playookId?: string;
      } = {
        prompt,
        tags: [
          "codeql-remediation",
          `severity:${job.severity}`,
          `issue:${issueNumber}`,
        ],
        repos: [repo],
        maxAcuLimit: 10,
      };

      if (this.config.playookId) {
        sessionOptions.playookId = this.config.playookId;
      }

      const session = await this.devin.createSession(sessionOptions);
      job.devinSessionId = session.session_id;
      job.devinSessionUrl = session.url;
      job.updatedAt = new Date();

      // Comment on issue
      await this.github.postComment(
        owner,
        name,
        issueNumber,
        `🤖 **Devin Remediation Started**\n\n` +
          `A Devin session has been created to fix this vulnerability.\n\n` +
          `- **Session:** [View Devin session](${session.url})\n` +
          `- **Status:** In progress\n\n` +
          `Devin will analyze the code, apply a fix, and create a PR. ` +
          `This comment will be updated when the fix is ready.`
      );

      // Notify Slack
      await this.notifications.notifySessionCreated(job);

      // Poll for completion (async — don't block other jobs)
      this.pollAndFinalize(job, owner, name).catch((err) => {
        console.error(
          `[orchestrator] Error polling session for issue #${issueNumber}:`,
          err
        );
      });

      return job;
    } catch (err) {
      this.activeSessionCount = Math.max(0, this.activeSessionCount - 1);
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.updateJobStatus(job, "failed");
      job.error = errorMessage;

      await this.github.postComment(
        owner,
        name,
        issueNumber,
        `❌ **Remediation Failed**\n\n` +
          `Error: ${errorMessage}\n\n` +
          `Manual review is required for this vulnerability.`
      );

      await this.notifications.notifySessionFailed(job);
      throw err;
    }
  }

  private async pollAndFinalize(
    job: RemediationJob,
    owner: string,
    name: string
  ): Promise<void> {
    try {
      const settledSession = await this.devin.pollUntilSettled(
        job.devinSessionId!,
        30 * 60 * 1000, // 30 min timeout
        (session) => {
          console.log(
            `[orchestrator] Session ${session.session_id} status: ${session.status} (${session.status_detail || ""})`
          );
        }
      );

      this.activeSessionCount = Math.max(0, this.activeSessionCount - 1);

      if (
        settledSession.status === "stopped" ||
        settledSession.status_detail === "finished"
      ) {
        // Session completed — assume PR was created
        this.updateJobStatus(job, "pr_created");
        job.completedAt = new Date();

        // Update labels
        await this.github.removeLabel(
          owner,
          name,
          job.issueNumber,
          "remediation-in-progress"
        );
        await this.github.addLabels(owner, name, job.issueNumber, [
          "fix-pr-created",
        ]);

        // Comment on issue
        await this.github.postComment(
          owner,
          name,
          job.issueNumber,
          `✅ **Remediation Complete**\n\n` +
            `Devin has finished working on this issue.\n\n` +
            `- **Session:** [View Devin session](${job.devinSessionUrl})\n` +
            `- **Status:** Fix submitted\n\n` +
            `Please check the repository for a new PR with the fix. ` +
            `The PR will need code review before merging.`
        );

        await this.notifications.notifyPrCreated(job);
      } else {
        // Session failed or errored
        this.updateJobStatus(job, "failed");
        job.error = `Session ended with status: ${settledSession.status} (${settledSession.status_detail || "unknown"})`;
        job.completedAt = new Date();

        await this.github.removeLabel(
          owner,
          name,
          job.issueNumber,
          "remediation-in-progress"
        );
        await this.github.addLabels(owner, name, job.issueNumber, [
          "remediation-failed",
        ]);

        await this.github.postComment(
          owner,
          name,
          job.issueNumber,
          `❌ **Remediation Failed**\n\n` +
            `Devin was unable to fix this vulnerability automatically.\n\n` +
            `- **Session:** [View Devin session](${job.devinSessionUrl})\n` +
            `- **Error:** ${job.error}\n\n` +
            `Manual review is required.`
        );

        await this.notifications.notifySessionFailed(job);
      }
    } catch (err) {
      this.activeSessionCount = Math.max(0, this.activeSessionCount - 1);
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.updateJobStatus(job, "failed");
      job.error = errorMessage;
      job.completedAt = new Date();

      console.error(
        `[orchestrator] Session polling error for issue #${job.issueNumber}:`,
        errorMessage
      );

      await this.notifications.notifySessionFailed(job);
    }
  }

  async remediateAllOpenIssues(repo: string): Promise<RemediationJob[]> {
    const { owner, name } = this.parseRepo(repo);

    console.log(
      `[orchestrator] Fetching all open vulnerability issues from ${repo}`
    );
    const issues = await this.github.listIssues(owner, name, "vulnerability", "open");

    if (issues.length === 0) {
      console.log("[orchestrator] No open vulnerability issues found.");
      return [];
    }

    console.log(
      `[orchestrator] Found ${issues.length} vulnerability issues to remediate`
    );

    // Count severities for notification
    const severities: Record<string, number> = {};
    for (const issue of issues) {
      const severity = this.parseSeverityFromIssue(issue);
      severities[severity] = (severities[severity] || 0) + 1;
    }

    await this.notifications.notifyBatchStarted(repo, issues.length, severities);

    // Process each issue
    const jobs: RemediationJob[] = [];
    for (const issue of issues) {
      try {
        const job = await this.remediateIssue(repo, issue.number);
        jobs.push(job);
        // Small delay between session creations to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(
          `[orchestrator] Failed to start remediation for issue #${issue.number}:`,
          err
        );
      }
    }

    return jobs;
  }

  private updateJobStatus(job: RemediationJob, status: JobStatus): void {
    job.status = status;
    job.updatedAt = new Date();
    console.log(
      `[orchestrator] Job ${job.id} status: ${status}`
    );
  }

  getMetrics(): DashboardMetrics {
    const allJobs = Array.from(this.jobs.values());

    const pending = allJobs.filter((j) => j.status === "pending").length;
    const inProgress = allJobs.filter((j) => j.status === "in_progress").length;
    const prCreated = allJobs.filter((j) => j.status === "pr_created").length;
    const completed = allJobs.filter((j) => j.status === "completed").length;
    const failed = allJobs.filter((j) => j.status === "failed").length;
    const succeeded = prCreated + completed;
    const total = allJobs.length;

    // Calculate average time to fix
    const completedJobs = allJobs.filter((j) => j.completedAt);
    let avgTimeToFixMinutes: number | null = null;
    if (completedJobs.length > 0) {
      const totalMs = completedJobs.reduce((sum, j) => {
        return sum + (j.completedAt!.getTime() - j.createdAt.getTime());
      }, 0);
      avgTimeToFixMinutes =
        Math.round((totalMs / completedJobs.length / 60000) * 10) / 10;
    }

    // Severity breakdown
    const severityBreakdown: Record<string, number> = {};
    for (const job of allJobs) {
      severityBreakdown[job.severity] =
        (severityBreakdown[job.severity] || 0) + 1;
    }

    return {
      summary: {
        total,
        pending,
        inProgress,
        prCreated,
        completed,
        failed,
        successRate:
          total > 0 ? `${((succeeded / total) * 100).toFixed(0)}%` : "N/A",
        avgTimeToFixMinutes,
      },
      severityBreakdown,
      jobs: allJobs.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      ),
      lastUpdated: new Date().toISOString(),
    };
  }

  getJob(repo: string, issueNumber: number): RemediationJob | undefined {
    return this.jobs.get(this.jobKey(repo, issueNumber));
  }

  getAllJobs(): RemediationJob[] {
    return Array.from(this.jobs.values());
  }
}
