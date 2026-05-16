export interface CodeQLAlert {
  number: number;
  state: "open" | "dismissed" | "fixed";
  rule: {
    id: string;
    severity: string;
    security_severity_level: "critical" | "high" | "medium" | "low";
    description: string;
    full_description?: string;
  };
  tool: {
    name: string;
  };
  most_recent_instance: {
    ref: string;
    location: {
      path: string;
      start_line: number;
      end_line: number;
    };
    message: {
      text: string;
    };
  };
  html_url: string;
  created_at: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: string;
  labels: Array<{ name: string }>;
  user: { login: string };
  created_at: string;
}

export interface GitHubWebhookPayload {
  action: string;
  issue: GitHubIssue;
  repository: {
    full_name: string;
    html_url: string;
  };
}

export type JobStatus =
  | "pending"
  | "in_progress"
  | "pr_created"
  | "completed"
  | "failed";

export interface RemediationJob {
  id: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  repo: string;
  severity: string;
  ruleId: string;
  status: JobStatus;
  devinSessionId?: string;
  devinSessionUrl?: string;
  prUrl?: string;
  prNumber?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface DevinSessionResponse {
  session_id: string;
  url: string;
  status?: string;
  status_detail?: string;
}

export interface DashboardMetrics {
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    prCreated: number;
    completed: number;
    failed: number;
    successRate: string;
    avgTimeToFixMinutes: number | null;
  };
  severityBreakdown: Record<string, number>;
  jobs: RemediationJob[];
  lastUpdated: string;
}

export interface AppConfig {
  port: number;
  githubToken: string;
  githubWebhookSecret: string;
  devinApiKey: string;
  devinOrgId: string;
  slackWebhookUrl: string;
  targetRepo: string;
  maxConcurrentSessions: number;
  playookId: string;
}
