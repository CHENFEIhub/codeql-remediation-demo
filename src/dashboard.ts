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

function sessionInfo(job: RemediationJob): string {
  if (!job.devinSessionId) return `<span style="color:#6b7280">—</span>`;
  const shortId = job.devinSessionId.substring(0, 8);
  const statusIcon = job.status === "in_progress"
    ? `<span style="display:inline-block;width:6px;height:6px;background:#3b82f6;border-radius:50%;animation:pulse 2s infinite;margin-right:6px"></span>`
    : job.status === "pr_created" || job.status === "completed"
    ? `<span style="display:inline-block;width:6px;height:6px;background:#10b981;border-radius:50%;margin-right:6px"></span>`
    : job.status === "failed"
    ? `<span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:6px"></span>`
    : `<span style="display:inline-block;width:6px;height:6px;background:#6b7280;border-radius:50%;margin-right:6px"></span>`;
  return `<span style="display:inline-flex;align-items:center">${statusIcon}<code style="color:#93c5fd;font-size:11px;background:#1e3a5f;padding:2px 6px;border-radius:4px">${shortId}...</code></span>`;
}

function jobRow(job: RemediationJob): string {
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
      <td style="padding:12px">${sessionInfo(job)}</td>
      <td style="padding:12px">${prLink}</td>
      <td style="padding:12px;color:#9ca3af">${formatDuration(job)}</td>
    </tr>
  `;
}

export function renderDashboard(
  metrics: DashboardMetrics,
  targetRepo?: string
): string {
  const { summary, severityBreakdown, jobs } = metrics;
  const repo = targetRepo || "CHENFEIhub/superset";

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
  <title>CodeQL Remediation Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #111827; color: #f9fafb; }
    a { text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #374151; padding: 2px 6px; border-radius: 3px; }
    .btn {
      padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .btn:active { transform: translateY(0); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-success { background: #10b981; color: white; }
    .btn-success:hover { background: #059669; }
    .btn-outline { background: transparent; color: #9ca3af; border: 1px solid #374151; }
    .btn-outline:hover { background: #1f2937; color: #f9fafb; }
    .input-field {
      background: #1f2937; border: 1px solid #374151; color: #f9fafb; padding: 10px 14px;
      border-radius: 8px; font-size: 14px; width: 80px; text-align: center;
    }
    .input-field:focus { outline: none; border-color: #3b82f6; }
    .toast {
      position: fixed; bottom: 24px; right: 24px; padding: 14px 20px; border-radius: 8px;
      font-size: 14px; font-weight: 500; z-index: 1000; animation: slideIn 0.3s ease;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4); max-width: 400px;
    }
    .toast-success { background: #065f46; color: #a7f3d0; border: 1px solid #10b981; }
    .toast-error { background: #7f1d1d; color: #fca5a5; border: 1px solid #ef4444; }
    .toast-info { background: #1e3a5f; color: #93c5fd; border: 1px solid #3b82f6; }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .live-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; animation: pulse 2s infinite; }
  </style>
</head>
<body>
  <div style="max-width:1200px;margin:0 auto;padding:24px">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div>
        <h1 style="font-size:24px;font-weight:700">&#x1f6e1;&#xfe0f; CodeQL Remediation Dashboard</h1>
        <p style="color:#9ca3af;margin-top:4px">Powered by Devin AI — Automated Security Fixes</p>
      </div>
      <div style="text-align:right">
        <div style="color:#6b7280;font-size:13px">
          <span class="live-dot"></span> Live — auto-refreshes every 5s
        </div>
        <div style="color:#6b7280;font-size:12px;margin-top:2px" id="lastUpdated">
          Last updated: ${new Date(metrics.lastUpdated).toLocaleString()}
        </div>
      </div>
    </header>

    <!-- Action Panel -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#1f2937);border:1px solid #374151;border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
        <div>
          <h2 style="font-size:16px;font-weight:600;color:#e5e7eb;margin-bottom:4px">Remediation Controls</h2>
          <p style="color:#9ca3af;font-size:13px">Target: <code style="color:#60a5fa">${repo}</code></p>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="color:#9ca3af;font-size:13px">Issue #</label>
            <input type="number" id="issueNumber" class="input-field" value="1" min="1" max="99">
            <button class="btn btn-primary" onclick="triggerSingle()" id="btnTrigger">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2l10 6-10 6V2z" fill="currentColor"/></svg>
              Trigger Fix
            </button>
          </div>
          <div style="width:1px;height:32px;background:#374151"></div>
          <button class="btn btn-success" onclick="scanAll()" id="btnScan">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8a7 7 0 1114 0A7 7 0 011 8zm7-5a5 5 0 100 10A5 5 0 008 3zm0 2a3 3 0 110 6 3 3 0 010-6z" fill="currentColor"/></svg>
            Scan &amp; Fix All
          </button>
          <button class="btn btn-outline" onclick="refreshDashboard()" id="btnRefresh">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.65 2.35A8 8 0 1016 8h-2a6 6 0 11-1.76-4.24l-2.24 2.24h5V1l-2.35 1.35z" fill="currentColor"/></svg>
            Refresh
          </button>
        </div>
      </div>
      <div id="actionLog" style="margin-top:12px;display:none;background:#111827;border-radius:8px;padding:12px;font-family:monospace;font-size:13px;color:#6ee7b7;max-height:120px;overflow-y:auto"></div>
    </div>

    <!-- Summary Cards -->
    <div id="summaryCards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:32px">
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Total Issues</div>
        <div style="font-size:36px;font-weight:700;color:#f9fafb;margin-top:4px" id="statTotal">${summary.total}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">In Progress</div>
        <div style="font-size:36px;font-weight:700;color:#3b82f6;margin-top:4px" id="statProgress">${summary.inProgress}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">PR Created</div>
        <div style="font-size:36px;font-weight:700;color:#10b981;margin-top:4px" id="statPR">${summary.prCreated}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Failed</div>
        <div style="font-size:36px;font-weight:700;color:#ef4444;margin-top:4px" id="statFailed">${summary.failed}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Success Rate</div>
        <div style="font-size:36px;font-weight:700;color:#10b981;margin-top:4px" id="statRate">${summary.successRate}</div>
      </div>
      <div style="background:#1f2937;border-radius:8px;padding:20px;text-align:center">
        <div style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:1px">Avg Fix Time</div>
        <div style="font-size:36px;font-weight:700;color:#f59e0b;margin-top:4px" id="statTime">${summary.avgTimeToFixMinutes !== null ? summary.avgTimeToFixMinutes + "m" : "&#x2014;"}</div>
      </div>
    </div>

    <!-- Severity Breakdown -->
    <div style="margin-bottom:32px">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;color:#d1d5db">Severity Breakdown</h2>
      <div id="severityBreakdown" style="display:flex;gap:12px;flex-wrap:wrap">
        ${severityCards || '<div style="color:#6b7280">No issues yet</div>'}
      </div>
    </div>

    <!-- Jobs Table -->
    <div>
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;color:#d1d5db">Remediation Jobs</h2>
      <div id="jobsContainer">
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
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Devin Session</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">PR</th>
              <th style="padding:12px;color:#9ca3af;font-size:12px;text-transform:uppercase">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${jobRows}
          </tbody>
        </table>
      </div>`
          : '<div style="background:#1f2937;border-radius:8px;padding:40px;text-align:center;color:#6b7280">No remediation jobs yet. Use the controls above to trigger remediation.</div>'
      }
      </div>
    </div>

    <!-- Footer -->
    <footer style="margin-top:40px;padding-top:20px;border-top:1px solid #374151;color:#6b7280;font-size:13px;text-align:center">
      CodeQL Auto-Remediation Demo — Built with <a href="https://devin.ai" style="color:#60a5fa">Devin AI</a>
    </footer>
  </div>

  <script>
    const REPO = "${repo}";

    function showToast(message, type) {
      var existing = document.querySelector('.toast');
      if (existing) existing.remove();
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(function() { toast.style.animation = 'fadeOut 0.3s ease'; setTimeout(function() { toast.remove(); }, 300); }, 4000);
    }

    function logAction(msg) {
      var log = document.getElementById('actionLog');
      log.style.display = 'block';
      var line = document.createElement('div');
      line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }

    function triggerSingle() {
      var num = parseInt(document.getElementById('issueNumber').value, 10);
      if (!num || num < 1) { showToast('Please enter a valid issue number', 'error'); return; }
      var btn = document.getElementById('btnTrigger');
      btn.disabled = true;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="animation:spin 1s linear infinite"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="20 10"/></svg> Triggering...';
      logAction('Triggering remediation for issue #' + num + ' in ' + REPO + '...');
      fetch('/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: REPO, issue_number: num })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        showToast('Remediation triggered for issue #' + num + '! Devin session starting...', 'success');
        logAction('Session created for issue #' + num + ' — Devin is analyzing the codebase');
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2l10 6-10 6V2z" fill="currentColor"/></svg> Trigger Fix';
        setTimeout(refreshDashboard, 2000);
      })
      .catch(function(err) {
        showToast('Error: ' + err.message, 'error');
        logAction('ERROR: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2l10 6-10 6V2z" fill="currentColor"/></svg> Trigger Fix';
      });
    }

    function scanAll() {
      var btn = document.getElementById('btnScan');
      btn.disabled = true;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="animation:spin 1s linear infinite"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="20 10"/></svg> Scanning...';
      logAction('Scanning all open vulnerability issues in ' + REPO + '...');
      fetch('/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: REPO })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        showToast('Batch remediation triggered! Devin sessions starting for all open issues...', 'success');
        logAction('Batch scan complete — Devin sessions created for all vulnerability issues');
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8a7 7 0 1114 0A7 7 0 011 8zm7-5a5 5 0 100 10A5 5 0 008 3zm0 2a3 3 0 110 6 3 3 0 010-6z" fill="currentColor"/></svg> Scan &amp; Fix All';
        setTimeout(refreshDashboard, 2000);
      })
      .catch(function(err) {
        showToast('Error: ' + err.message, 'error');
        logAction('ERROR: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8a7 7 0 1114 0A7 7 0 011 8zm7-5a5 5 0 100 10A5 5 0 008 3zm0 2a3 3 0 110 6 3 3 0 010-6z" fill="currentColor"/></svg> Scan &amp; Fix All';
      });
    }

    function refreshDashboard() {
      fetch('/api/status')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          document.getElementById('lastUpdated').textContent = 'Last updated: ' + new Date().toLocaleString();
          if (data.summary) {
            document.getElementById('statTotal').textContent = data.summary.total;
            document.getElementById('statProgress').textContent = data.summary.inProgress;
            document.getElementById('statPR').textContent = data.summary.prCreated;
            document.getElementById('statFailed').textContent = data.summary.failed;
            document.getElementById('statRate').textContent = data.summary.successRate;
            document.getElementById('statTime').textContent = data.summary.avgTimeToFixMinutes !== null ? data.summary.avgTimeToFixMinutes + 'm' : '\\u2014';
          }
          // Full page refresh to update jobs table and severity breakdown
          if (data.summary && data.summary.total > 0) {
            location.reload();
          }
        })
        .catch(function() {});
    }

    // Auto-refresh every 5 seconds
    setInterval(refreshDashboard, 5000);

    // Spin animation for loading buttons
    var styleEl = document.createElement('style');
    styleEl.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(styleEl);
  </script>
</body>
</html>`;
}
