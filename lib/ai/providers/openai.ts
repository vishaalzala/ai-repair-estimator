import OpenAI from "openai";
import type { AiProvider, VehicleDamageRequest, VehicleDamageResult } from "@/lib/ai/provider";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;

  private get client() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    return new OpenAI({ apiKey });
  }

  async analyzeVehicleDamage(_input: VehicleDamageRequest): Promise<VehicleDamageResult> {
    void this.client;
    throw new Error("OpenAI damage analysis is not enabled yet");
  }
}
