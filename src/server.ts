import express from "express";
import { loadConfig } from "./config";
import { Orchestrator } from "./orchestrator";
import { renderDashboard } from "./dashboard";
import { GitHubClient } from "./github";

const config = loadConfig();
const orchestrator = new Orchestrator(config);
const app = express();

// Parse JSON and capture raw body for webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody: Buffer }).rawBody = buf;
    },
  })
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Dashboard (HTML)
app.get("/dashboard", (_req, res) => {
  const metrics = orchestrator.getMetrics();
  res.type("html").send(renderDashboard(metrics));
});

// API: Get metrics (JSON)
app.get("/api/status", (_req, res) => {
  res.json(orchestrator.getMetrics());
});

// API: List all jobs
app.get("/api/jobs", (_req, res) => {
  res.json(orchestrator.getAllJobs());
});

// API: Get specific job
app.get("/api/jobs/:repo/:issueNumber", (req, res) => {
  const repo = req.params.repo;
  const issueNumber = parseInt(req.params.issueNumber, 10);
  const job = orchestrator.getJob(repo, issueNumber);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

// Webhook: GitHub issue events
app.post("/webhook", (req, res) => {
  const event = req.headers["x-github-event"];
  const signature = req.headers["x-hub-signature-256"] as string;

  // Verify signature if secret is configured
  if (config.githubWebhookSecret && signature) {
    const rawBody = (req as express.Request & { rawBody: Buffer }).rawBody;
    const ghClient = new GitHubClient(config.githubToken);
    if (
      !ghClient.verifyWebhookSignature(
        rawBody.toString(),
        signature,
        config.githubWebhookSecret
      )
    ) {
      console.error("[webhook] Invalid signature");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  if (event !== "issues") {
    res.json({ message: `Ignored event: ${event}` });
    return;
  }

  const payload = req.body;
  const action = payload.action;
  const issue = payload.issue;
  const repo = payload.repository?.full_name;

  // Only trigger on issue opened or labeled with "vulnerability"
  const hasVulnLabel = issue?.labels?.some(
    (l: { name: string }) => l.name === "vulnerability"
  );

  if (
    (action === "opened" || action === "labeled") &&
    hasVulnLabel
  ) {
    console.log(
      `[webhook] Received vulnerability issue #${issue.number} from ${repo}`
    );

    // Respond immediately, process async
    res.json({
      message: "Remediation triggered",
      issue: issue.number,
      repo,
    });

    orchestrator.remediateIssue(repo, issue.number).catch((err) => {
      console.error(
        `[webhook] Failed to remediate issue #${issue.number}:`,
        err
      );
    });
    return;
  }

  res.json({ message: "No action needed", action, hasVulnLabel });
});

// Manual trigger: remediate a specific issue
app.post("/trigger", (req, res) => {
  const { repo, issue_number } = req.body;
  const targetRepo = repo || config.targetRepo;

  if (!targetRepo) {
    res.status(400).json({
      error: "Missing 'repo' in request body or TARGET_REPO env var",
    });
    return;
  }

  if (!issue_number) {
    res.status(400).json({ error: "Missing 'issue_number' in request body" });
    return;
  }

  console.log(
    `[trigger] Manual remediation for issue #${issue_number} in ${targetRepo}`
  );

  // Respond immediately
  res.json({
    message: "Remediation triggered",
    repo: targetRepo,
    issue_number,
  });

  orchestrator.remediateIssue(targetRepo, issue_number).catch((err) => {
    console.error(
      `[trigger] Failed to remediate issue #${issue_number}:`,
      err
    );
  });
});

// Batch trigger: remediate all open vulnerability issues
app.post("/scan", (req, res) => {
  const { repo } = req.body;
  const targetRepo = repo || config.targetRepo;

  if (!targetRepo) {
    res.status(400).json({
      error: "Missing 'repo' in request body or TARGET_REPO env var",
    });
    return;
  }

  console.log(`[scan] Batch remediation for all open issues in ${targetRepo}`);

  // Respond immediately
  res.json({
    message: "Batch remediation triggered",
    repo: targetRepo,
  });

  orchestrator.remediateAllOpenIssues(targetRepo).catch((err) => {
    console.error(`[scan] Failed batch remediation:`, err);
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   CodeQL Auto-Remediation Server                        ║
║   Powered by Devin AI                                   ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║   Dashboard:  http://localhost:${config.port}/dashboard${" ".repeat(Math.max(0, 15 - config.port.toString().length))}║
║   API:        http://localhost:${config.port}/api/status${" ".repeat(Math.max(0, 14 - config.port.toString().length))}║
║   Health:     http://localhost:${config.port}/health${" ".repeat(Math.max(0, 18 - config.port.toString().length))}║
║                                                          ║
║   Target repo: ${(config.targetRepo || "not set").padEnd(40)}║
║   Max sessions: ${config.maxConcurrentSessions.toString().padEnd(39)}║
║   Slack: ${config.slackWebhookUrl ? "configured" : "not configured"}${" ".repeat(Math.max(0, config.slackWebhookUrl ? 37 : 31))}║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

export default app;
