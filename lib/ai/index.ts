import type { AiProvider } from "@/lib/ai/provider";
import { OpenAiProvider } from "@/lib/ai/providers/openai";

let provider: AiProvider | undefined;

export function getAiProvider(): AiProvider {
  if (!provider) provider = new OpenAiProvider();
  return provider;
}
