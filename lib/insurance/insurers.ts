export const PRIVATE_JOB_OPTION = "Private Job";

export const INSURANCE_CUSTOMERS = [
  PRIVATE_JOB_OPTION,
  "AA Insurance",
  "Allianz New Zealand",
  "AMI Insurance",
  "AMP General Insurance",
  "Ando Insurance",
  "ANZ Insurance Service Centre",
  "AON Insurance",
  "ASB Insurance",
  "Assurant",
  "Autosure",
  "Covi Insurance",
  "Crash Management",
  "Custom Fleet",
  "DPL Insurance",
  "FMG Insurance",
  "IAG New Zealand Ltd",
  "Janssen Insurance",
  "Lantern Insurance",
  "Lumley General Insurance",
  "Medical Assurance Society NZ Ltd",
  "Monument Insurance",
  "NAC Claims",
  "Protecta Insurance",
  "Provident Insurance Corporation Ltd",
  "QBE Insurance",
  "Quest Insurance",
  "Smartpak",
  "STAR Campercare (SIS)",
  "Tower Insurance",
  "Toyota Insurance",
  "Vero Insurance New Zealand Limited",
  "Zurich Insurance",
] as const;

export type InsuranceCustomer = (typeof INSURANCE_CUSTOMERS)[number];

const insuranceCustomerSet = new Set<string>(INSURANCE_CUSTOMERS);

export function normalizeInsuranceCustomer(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return insuranceCustomerSet.has(normalized) ? normalized : "";
}

export function defaultWorkSourceForInsurer(insurerName: string) {
  const normalized = normalizeInsuranceCustomer(insurerName);
  if (!normalized) return "";
  return normalized === PRIVATE_JOB_OPTION ? "Private" : "Insurance";
}
