export type AiProviderName = "openai";

export type VehicleDamageRequest = {
  jobId: string;
  organizationId: string;
  photoUrls: string[];
  vehicle: { registration?: string; make?: string; model?: string; year?: number; vin?: string };
};

export type DamageFinding = {
  component: string;
  side: "LH" | "RH" | "FRONT" | "REAR" | "CENTRE" | "UNKNOWN";
  condition: string;
  recommendedAction: "repair" | "replace" | "remove_refit" | "inspect" | "check_after_strip";
  confidence: number;
  evidencePhotoIndexes: number[];
};

export type VehicleDamageResult = { impactArea: string; findings: DamageFinding[]; warnings: string[] };

export interface AiProvider {
  name: AiProviderName;
  analyzeVehicleDamage(input: VehicleDamageRequest): Promise<VehicleDamageResult>;
}
