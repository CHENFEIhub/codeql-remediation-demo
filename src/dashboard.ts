import { DashboardMetrics, RemediationJob } from "./types";

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    pending: "#6b7280",
    in_progress: "#3b82f6",
    pr_created: "#10b981",
    completed: "#059669",
    failed: "#ef4444",
  };
  const color = colors[status] || "#6b7280";
  const label = status.replace(/_/g, " ");
  return `<span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase">${label}</span>`;
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#d97706",
    low: "#65a30d",
  };
  const color = colors[severity] || "#6b7280";
  return `<span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase">${severity}</span>`;
}

function formatDuration(job: RemediationJob): string {
  const end = job.completedAt || new Date();
  const ms = end.getTime() - job.createdAt.getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function jobRow(job: RemediationJob): string {
  const sessionLink = job.devinSessionUrl
    ? `<a href="${job.devinSessionUrl}" target="_blank" style="color:#60a5fa">View Session</a>`
    : "—";
  const prLink = job.prUrl
    ? `<a href="${job.prUrl}" target="_blank" style="color:#34d399">View PR</a>`
    : "—";

  return `
    <tr style="border-bottom:1px solid #374151">
      <td style="padding:12px"><a href="${job.issueUrl}" target="_blank" style="color:#60a5fa">#${job.issueNumber}</a></td>
      <td style="padding:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${job.issueTitle}</td>
      <td style="padding:12px">${severityBadge(job.severity)}</td>
      <td style="padding:12px"><code style="color:#d1d5db;font-size:12px">${job.ruleId}</code></td>
      <td style="padding:12px">${statusBadge(job.status)}</td>
      <td style="padding:12px">${sessionLink}</td>
      <td style="padding:12px">${prLink}</td>
      <td style="padding:12px;color:#9ca3af">${formatDuration(job)}</td>
    </tr>
  `;
}

export function renderDashboard(metrics: DashboardMetrics): string {
  const { summary, severityBreakdown, jobs } = metrics;

  const severityCards = Object.entries(severityBreakdown)
    .sort(([a], [b]) => {
      const order = ["critical", "high", "medium", "low"];
      return order.indexOf(a) - order.indexOf(b);
    })
    .map(
      ([level, count]) => `
      <div style="background:#1f2937;border-radius:8px;padding:16px;text-align:center;min-width:100px">
        ${severityBadge(level)}
        <div style="font-size:24px;font-weight:700;margin-top:8px;color:#f9fafb">${count}</div>
      </div>
    `
    )
    .join("");

  const jobRows = jobs.map(jobRow).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="10">
  <title>CodeQL Remediation Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #111827; color: #f9fafb; }
    a { text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #374151; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <div style="max-width:1200px;margin:0 auto;padding:24px">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
      <div>
        <h1 style="font-size:24px;font-weight:700">🛡️ CodeQL Remediation Dashboard</h1>
        <p style="color:#9ca3af;margin-top:4px">Powered by Devin AI — Automated Security Fixes</p>
      </div>
      <div style="color:#6b7280;font-size:13px">
        Last updated: ${new Date(metrics.lastUpdated).toLocaleString()}<br>
        Auto-refreshes every 10s
      </div>
    </header>

    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:32px">
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Total Issues</div>
        <div style="font-size:36px;font-weight:700;color:#f9fafb;margin-top:4px">${summary.total}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">In Progress</div>
        <div style="font-size:36px;font-weight:700;color:#3b82f6;margin-top:4px">${summary.inProgress}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">PR Created</div>
        <div style="font-size:36px;font-weight:700;color:#10b981;margin-top:4px">${summary.prCreated}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Failed</div>
        <div style="font-size:36px;font-weight:700;color:#ef4444;margin-top:4px">${summary.failed}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Success Rate</div>
        <div style="font-size:36px;font-weight:700;color:#10b981;margin-top:4px">${summary.successRate}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Avg Fix Time</div>
        <div style="font-size:36px;font-weight:700;color:#f59e0b;margin-top:4px">${summary.avgTimeToFixMinutes !== null ? summary.avgTimeToFixMinutes + "m" : "—"}</div>
      </div>
    </div>

    <!-- Severity Breakdown -->
    <div style="margin-bottom:32px">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;color:#d1d5db">Severity Breakdown</h2>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${severityCards || '<div style="color:#6b7280">No issues yet</div>'}
      </div>
    </div>

    <!-- Jobs Table -->
    <div>
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;color:#d1d5db">Remediation Jobs</h2>
      ${
        jobs.length > 0
          ? `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;background:#1f2937;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="border-bottom:2px solid #374151;text-align:left">
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Issue</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Title</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Severity</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Rule</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Status</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Devin</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">PR</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${jobRows}
          </tbody>
        </table>
      </div>`
          : '<div style="background:#1f2937;border-radius:8px;padding:40px;text-align:center;color:#6b7280">No remediation jobs yet. Create issues labeled "vulnerability" or use the /trigger endpoint.</div>'
      }
    </div>

    <!-- Footer -->
    <footer style="margin-top:40px;padding-top:20px;border-top:1px solid #374151;color:#6b7280;font-size:13px;text-align:center">
      CodeQL Auto-Remediation Demo — Built with <a href="https://devin.ai" style="color:#60a5fa">Devin AI</a>
      <br>
      <span style="font-size:11px">API: <code>GET /api/status</code> | <code>POST /trigger</code> | <code>POST /webhook</code></span>
    </footer>
  </div>
</body>
</html>`;
}
