/**
 * Thin client for the NVIDIA NIM OpenAI-compatible endpoint.
 *
 * Why a wrapper instead of importing OpenAI everywhere:
 *  - the rest of the app depends on `completeText`, never on a vendor SDK;
 *  - reasoning models (like nemotron) stream `reasoning_content` deltas that
 *    must NOT be treated as answer text — that handling lives here, once;
 *  - swapping providers later is a one-file change.
 *
 * The API key is read from env on the server only and never crosses the
 * client boundary.
 */

import OpenAI from "openai";
import { AIProviderUnavailableError } from "@/domain/errors/DomainError";

export interface LlmClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class NvidiaLlmClient {
  private readonly client: OpenAI | null;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: LlmClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.NVIDIA_API_KEY;
    const baseUrl = options.baseUrl ?? process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
    this.model = options.model ?? process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3.5-lightning-30b-a3b";
    this.timeoutMs = options.timeoutMs ?? 180_000;

    if (!apiKey) {
      this.client = null;
    } else {
      // No SDK-level retries: parse-failure retries are handled at the
      // evaluator level with a corrective prompt, which is more useful than
      // silently repeating an identical request.
      this.client = new OpenAI({ apiKey, baseURL: baseUrl, timeout: this.timeoutMs, maxRetries: 0 });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Streams a completion and returns ONLY the answer content —
   * reasoning_content deltas (chain-of-thought) are discarded.
   */
  async completeText(system: string, user: string, maxTokens: number): Promise<string> {
    if (this.client === null) {
      throw new AIProviderUnavailableError("no API key configured");
    }
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: maxTokens,
        stream: true,
        // Thinking mode is deliberately OFF for this task: the review is a
        // single structured-JSON generation, and inline reasoning multiplied
        // latency to multiple minutes and occasionally leaked chain-of-thought
        // prose into `content`. The domain's quality lever is the prompt, not
        // the thinking budget.
        ...( {
          chat_template_kwargs: { enable_thinking: false },
        } as Record<string, unknown> ),
      });

      let content = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        const reasoning = (delta as { reasoning_content?: string }).reasoning_content;
        void reasoning; // deliberately ignored — chain of thought is not the answer
        if (delta.content) content += delta.content;
      }

      if (content.trim().length === 0) {
        throw new AIProviderUnavailableError("model returned an empty response");
      }
      return content;
    } catch (err) {
      if (err instanceof AIProviderUnavailableError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new AIProviderUnavailableError(message);
    }
  }
}
