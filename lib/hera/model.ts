import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/*
 * Which model Hera runs on, picked from .env.local:
 *  - NVIDIA_API_KEY  → NVIDIA NIM (OpenAI-compatible). HERA_MODEL is a NIM id.
 *  - ANTHROPIC_API_KEY → Claude. HERA_MODEL is an Anthropic id.
 *  - AI_GATEWAY_API_KEY → Vercel AI Gateway. HERA_MODEL is "provider/model".
 */

type Provider = "nvidia" | "anthropic" | "gateway";

const provider: Provider = process.env.NVIDIA_API_KEY ? "nvidia" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "gateway";

const DEFAULT_MODEL: Record<Provider, string> = {
  nvidia: "nvidia/nemotron-3-ultra-550b-a55b",
  anthropic: "claude-sonnet-5-5",
  gateway: "anthropic/claude-sonnet-5-5",
};

const nim = createOpenAICompatible({
  name: "nvidia",
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
  supportsStructuredOutputs: true, // NIM honours response_format json_schema
  // Enable Nemotron thinking explicitly; HERA_THINKING=0 opts out.
  transformRequestBody: (body) =>
    String(body.model).startsWith("nvidia/nemotron")
      ? { ...body, chat_template_kwargs: { enable_thinking: process.env.HERA_THINKING !== "0" } }
      : body,
});

function model(id: string): LanguageModel {
  if (provider === "nvidia") return nim.chatModel(id);
  if (provider === "anthropic") return anthropic(id);
  return id;
}

export const heraModel = () => model(process.env.HERA_MODEL || DEFAULT_MODEL[provider]);

/** A faster model to retry with when the main one stalls (NIM's free tier queues sometimes). */
export const heraFallbackModel = () =>
  model(process.env.HERA_FALLBACK_MODEL || (provider === "nvidia" ? "nvidia/nemotron-3.5-lightning-30b-a3b" : process.env.HERA_MODEL || DEFAULT_MODEL[provider]));

/** Claude reads PDFs natively; for everything else Hera extracts the text first. */
export const modelReadsPdfs = provider !== "nvidia";
