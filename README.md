# CodeQL Auto-Remediation with Devin AI

An event-driven automation that uses the [Devin API](https://docs.devin.ai/api-reference/overview) to automatically remediate CodeQL security findings. When a vulnerability issue is created in GitHub, this system spins up a Devin session to analyze the code, apply a fix, and create a pull request — closing the loop between security scanners and engineering teams.

## Architecture

```
GitHub Issue (labeled "vulnerability")
        │
        ▼
  ┌──────────────┐
  │  Orchestrator │◄── Webhook (POST /webhook)
  │  (Express)    │◄── Manual  (POST /trigger)
  │               │◄── Batch   (POST /scan)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────┐
  │  Devin API   │────▶│  Fix PR      │
  │  (Session)   │     │  in GitHub   │
  └──────────────┘     └──────────────┘
         │
         ▼
  ┌──────────────┐
  │  Dashboard   │  GET /dashboard (HTML)
  │  + API       │  GET /api/status (JSON)
  └──────────────┘
```

## How It Works

1. **Event Trigger**: A GitHub issue with the `vulnerability` label is created (manually or via CodeQL scan integration)
2. **Orchestrator Processes**: The server receives the webhook, validates it, and creates a remediation job
3. **Devin Session**: A Devin session is created with a detailed prompt including the vulnerability details, CWE context, and fix instructions
4. **Fix & PR**: Devin analyzes the code, applies a minimal fix, adds tests, and creates a pull request
5. **Notifications**: GitHub issue comments and optional Slack notifications keep stakeholders informed
6. **Dashboard**: Real-time dashboard shows remediation progress, success rates, and severity breakdown

## Quick Start

### Prerequisites

- Docker and Docker Compose
- GitHub Personal Access Token (with `repo` scope)
- Devin API Key ([get one here](https://app.devin.ai/settings))
- A GitHub repository with issues labeled `vulnerability`

### Run with Docker

```bash
# Clone this repository
git clone https://github.com/CHENFEIhub/codeql-remediation-demo.git
cd codeql-remediation-demo

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Build and run
docker compose up --build
```

### Run Locally (Development)

```bash
npm install
cp .env.example .env
# Edit .env with your credentials

npm run dev
```

The server starts on `http://localhost:3000`.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /health` | GET | Health check |
| `GET /dashboard` | GET | HTML dashboard with real-time metrics |
| `GET /api/status` | GET | JSON metrics (total, in-progress, success rate, etc.) |
| `GET /api/jobs` | GET | List all remediation jobs |
| `GET /api/jobs/:owner/:name/:issueNumber` | GET | Get a specific job |
| `POST /webhook` | POST | GitHub webhook endpoint (issue events) |
| `POST /trigger` | POST | Manually trigger remediation for a specific issue |
| `POST /scan` | POST | Batch remediation for all open vulnerability issues |

### Trigger Remediation Manually

```bash
# Single issue
curl -X POST http://localhost:3000/trigger \
  -H "Content-Type: application/json" \
  -d '{"repo": "CHENFEIhub/superset", "issue_number": 1}'

# All open vulnerability issues
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"repo": "CHENFEIhub/superset"}'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub PAT with `repo` scope |
| `DEVIN_API_KEY` | Yes | Devin API key (starts with `cog_`) |
| `DEVIN_ORG_ID` | Yes | Devin organization ID (starts with `org-`) |
| `TARGET_REPO` | No | Default target repository (e.g., `CHENFEIhub/superset`) |
| `GITHUB_WEBHOOK_SECRET` | No | Secret for webhook signature verification |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook for notifications |
| `MAX_CONCURRENT_SESSIONS` | No | Max parallel Devin sessions (default: 3) |
| `PLAYBOOK_ID` | No | Devin playbook ID for consistent remediation |
| `PORT` | No | Server port (default: 3000) |

## Safety & Guardrails

- **Human-in-the-loop**: Devin creates draft PRs — all fixes require code review before merging
- **CI as safety net**: PRs must pass existing CI/CD pipelines before merge
- **Scoped permissions**: GitHub token uses minimum required scope
- **Blast radius control**: Concurrency limits prevent overwhelming the repo with PRs
- **Deduplication**: Same issue won't trigger multiple sessions (idempotency key: `repo#issue_number`)
- **Retry with backoff**: Failed API calls retry up to 3 times with exponential backoff
- **Graceful degradation**: Slack/notification failures don't block remediation

## Observability

The dashboard answers: **"If I were an engineering leader, how would I know this is working?"**

- **Total Issues**: How many vulnerabilities have been processed
- **Success Rate**: Percentage of issues that resulted in fix PRs
- **Avg Fix Time**: How long Devin takes to analyze and fix each issue
- **Severity Breakdown**: Distribution across critical/high/medium/low
- **Per-Job Status**: Individual job tracking with links to Devin sessions and PRs

## Project Structure

```
src/
├── server.ts          # Express server with routes
├── config.ts          # Environment configuration
├── types.ts           # TypeScript type definitions
├── github.ts          # GitHub API client
├── devin.ts           # Devin API client
├── orchestrator.ts    # Core remediation logic
├── prompt.ts          # Prompt builder for Devin sessions
├── notifications.ts   # Slack notification service
└── dashboard.ts       # HTML dashboard renderer
```

## License

MIT
