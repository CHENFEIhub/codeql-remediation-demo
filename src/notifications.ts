import { RemediationJob } from "./types";

export class NotificationService {
  private slackWebhookUrl: string;

  constructor(slackWebhookUrl: string) {
    this.slackWebhookUrl = slackWebhookUrl;
  }

  private get slackEnabled(): boolean {
    return this.slackWebhookUrl.length > 0;
  }

  async sendSlack(text: string): Promise<void> {
    if (!this.slackEnabled) {
      console.log(`[slack:disabled] ${text}`);
      return;
    }

    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error(`[slack] Failed to send: ${response.status}`);
      }
    } catch (err) {
      console.error(`[slack] Error sending notification:`, err);
    }
  }

  async notifyBatchStarted(
    repo: string,
    issueCount: number,
    severities: Record<string, number>
  ): Promise<void> {
    const severityStr = Object.entries(severities)
      .map(([level, count]) => `${count} ${level}`)
      .join(", ");

    await this.sendSlack(
      `🔍 *CodeQL Remediation Started*\n` +
        `Repository: \`${repo}\`\n` +
        `Issues to remediate: ${issueCount} (${severityStr})\n` +
        `Devin is spinning up sessions to fix these automatically.`
    );
  }

  async notifySessionCreated(job: RemediationJob): Promise<void> {
    await this.sendSlack(
      `🤖 *Devin working on fix*\n` +
        `Issue: <${job.issueUrl}|#${job.issueNumber} — ${job.issueTitle}>\n` +
        `Severity: ${job.severity}\n` +
        `Session: <${job.devinSessionUrl}|View Devin session>`
    );
  }

  async notifyPrCreated(job: RemediationJob): Promise<void> {
    await this.sendSlack(
      `✅ *Fix PR Created*\n` +
        `Issue: <${job.issueUrl}|#${job.issueNumber} — ${job.issueTitle}>\n` +
        `PR: <${job.prUrl}|View Pull Request>\n` +
        `Severity: ${job.severity}\n` +
        `Ready for code review.`
    );
  }

  async notifySessionFailed(job: RemediationJob): Promise<void> {
    await this.sendSlack(
      `❌ *Remediation Failed*\n` +
        `Issue: <${job.issueUrl}|#${job.issueNumber} — ${job.issueTitle}>\n` +
        `Error: ${job.error || "Unknown error"}\n` +
        `Manual review required.`
    );
  }

  async notifyBatchComplete(
    repo: string,
    total: number,
    succeeded: number,
    failed: number,
    dashboardUrl: string
  ): Promise<void> {
    const successRate =
      total > 0 ? ((succeeded / total) * 100).toFixed(0) : "0";
    await this.sendSlack(
      `📊 *Remediation Batch Complete*\n` +
        `Repository: \`${repo}\`\n` +
        `Results: ${succeeded}/${total} fixed (${successRate}% success rate)\n` +
        (failed > 0 ? `⚠️ ${failed} failed — manual review needed\n` : "") +
        `<${dashboardUrl}|View Dashboard>`
    );
  }
}
