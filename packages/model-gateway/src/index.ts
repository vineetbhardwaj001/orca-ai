import { z } from "zod";

export const ModelTaskSchema = z.enum(["discovery_summary","scenario_generation","exploration_planning","bug_triage","evidence_review","code_assistance"]);
export type ModelTask = z.infer<typeof ModelTaskSchema>;

export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
export type ModelRequest = { task: ModelTask; model: string; messages: ModelMessage[]; temperature?: number; maxTokens?: number; timeoutMs?: number };
export type ModelResponse = { provider: string; model: string; text: string; latencyMs: number; inputTokens?: number; outputTokens?: number };
export interface ModelProvider {
  readonly providerId: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
  healthCheck(): Promise<boolean>;
}

export type OpenAICompatibleConfig = { providerId: string; baseUrl: string; apiKey?: string; defaultModel: string };

// Compatible with Ollama's OpenAI-compatible /v1 endpoint and compatible hosted inference endpoints.
// It deliberately has no built-in provider/model or API-key default.
export class OpenAICompatibleProvider implements ModelProvider {
  readonly providerId: string;
  constructor(private readonly config: OpenAICompatibleConfig) { this.providerId = config.providerId; }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const started = Date.now();
    const response = await fetch(new URL("/v1/chat/completions", this.config.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.config.apiKey ? { authorization: "Bearer " + this.config.apiKey } : {}) },
      body: JSON.stringify({ model: request.model || this.config.defaultModel, messages: request.messages, temperature: request.temperature ?? 0.2, max_tokens: request.maxTokens ?? 1200 }),
      signal: AbortSignal.timeout(request.timeoutMs ?? 30000)
    });
    if (!response.ok) throw new Error("Model provider request failed with HTTP " + response.status);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("Model provider returned no message content");
    return { provider: this.providerId, model: request.model || this.config.defaultModel, text, latencyMs: Date.now() - started, inputTokens: payload.usage?.prompt_tokens, outputTokens: payload.usage?.completion_tokens };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(new URL("/v1/models", this.config.baseUrl), { headers: this.config.apiKey ? { authorization: "Bearer " + this.config.apiKey } : {}, signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch { return false; }
  }
}
