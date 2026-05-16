import { DevinSessionResponse } from "./types";

interface CreateSessionOptions {
  prompt: string;
  playbookId?: string;
  tags?: string[];
  repos?: string[];
  maxAcuLimit?: number;
}

export class DevinClient {
  private apiKey: string;
  private orgId: string;
  private baseUrl = "https://api.devin.ai/v3";

  constructor(apiKey: string, orgId: string) {
    this.apiKey = apiKey;
    this.orgId = orgId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429) {
        retries++;
        const waitMs = Math.min(1000 * Math.pow(2, retries), 60000);
        console.log(
          `[devin] Rate limited. Retry ${retries}/${maxRetries} in ${waitMs}ms`
        );
        await this.sleep(waitMs);
        continue;
      }

      if (response.status >= 500 && retries < maxRetries) {
        retries++;
        const waitMs = Math.min(1000 * Math.pow(2, retries), 60000);
        console.log(
          `[devin] Server error ${response.status}. Retry ${retries}/${maxRetries} in ${waitMs}ms`
        );
        await this.sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Devin API error ${response.status} ${method} ${path}: ${errorText}`
        );
      }

      return response.json() as Promise<T>;
    }

    throw new Error(`Devin API: max retries exceeded for ${method} ${path}`);
  }

  async createSession(options: CreateSessionOptions): Promise<DevinSessionResponse> {
    const body: Record<string, unknown> = {
      prompt: options.prompt,
    };

    if (options.playbookId) {
      body.playbook_id = options.playbookId;
    }
    if (options.tags) {
      body.tags = options.tags;
    }
    if (options.repos) {
      body.repos = options.repos;
    }
    if (options.maxAcuLimit) {
      body.max_acu_limit = options.maxAcuLimit;
    }

    const response = await this.request<DevinSessionResponse>(
      "POST",
      `/organizations/${this.orgId}/sessions`,
      body
    );

    return response;
  }

  async getSession(sessionId: string): Promise<DevinSessionResponse> {
    return this.request<DevinSessionResponse>(
      "GET",
      `/organizations/${this.orgId}/sessions/${sessionId}`
    );
  }

  async pollUntilSettled(
    sessionId: string,
    timeoutMs: number = 30 * 60 * 1000,
    onUpdate?: (session: DevinSessionResponse) => void
  ): Promise<DevinSessionResponse> {
    const startTime = Date.now();
    let pollInterval = 15000; // Start at 15s
    const maxInterval = 120000; // Cap at 2 min

    while (Date.now() - startTime < timeoutMs) {
      const session = await this.getSession(sessionId);

      if (onUpdate) {
        onUpdate(session);
      }

      const isSettled =
        session.status === "stopped" ||
        session.status === "error" ||
        session.status_detail === "finished" ||
        session.status_detail === "waiting_for_user";

      if (isSettled) {
        return session;
      }

      await this.sleep(pollInterval);
      pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    }

    throw new Error(
      `Devin session ${sessionId} did not settle within ${timeoutMs / 1000}s`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
