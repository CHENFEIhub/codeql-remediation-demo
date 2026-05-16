import crypto from "crypto";
import { GitHubIssue } from "./types";

export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub API error ${response.status} ${method} ${path}: ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      "GET",
      `/repos/${owner}/${repo}/issues/${issueNumber}`
    );
  }

  async listIssues(
    owner: string,
    repo: string,
    labels: string = "vulnerability",
    state: string = "open"
  ): Promise<GitHubIssue[]> {
    return this.request<GitHubIssue[]>(
      "GET",
      `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(labels)}&state=${state}&per_page=100`
    );
  }

  async postComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    await this.request("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      body,
    });
  }

  async addLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<void> {
    await this.request("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
      labels,
    });
  }

  async removeLabel(
    owner: string,
    repo: string,
    issueNumber: number,
    label: string
  ): Promise<void> {
    try {
      await this.request(
        "DELETE",
        `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`
      );
    } catch {
      // Label may not exist — ignore
    }
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[]
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      "POST",
      `/repos/${owner}/${repo}/issues`,
      { title, body, labels }
    );
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    if (!secret) return true; // Skip verification if no secret configured
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}
