import { AppConfig } from "./types";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(optionalEnv("PORT", "3000"), 10),
    githubToken: requiredEnv("GITHUB_TOKEN"),
    githubWebhookSecret: optionalEnv("GITHUB_WEBHOOK_SECRET", ""),
    devinApiKey: requiredEnv("DEVIN_API_KEY"),
    devinOrgId: requiredEnv("DEVIN_ORG_ID"),
    slackWebhookUrl: optionalEnv("SLACK_WEBHOOK_URL", ""),
    targetRepo: optionalEnv("TARGET_REPO", ""),
    maxConcurrentSessions: parseInt(
      optionalEnv("MAX_CONCURRENT_SESSIONS", "3"),
      10
    ),
    playookId: optionalEnv("PLAYBOOK_ID", ""),
  };
}
