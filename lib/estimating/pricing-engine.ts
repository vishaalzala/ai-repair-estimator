export type PricingLineInput = {
  quantity?: number;
  labourHours?: number;
  labourRate?: number;
  fixedAmount?: number;
  partCost?: number;
  markupPercent?: number;
  freightAmount?: number;
  adjustmentAmount?: number;
};

export type EstimateTotalInput = {
  lineTotalExTax: number;
  categoryCode?: string | null;
  reportSelected?: boolean;
  extraSelected?: boolean;
};

function finite(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLineTotal(input: PricingLineInput) {
  const quantity = Math.max(0, finite(input.quantity) || 1);
  const labour = roundMoney(Math.max(0, finite(input.labourHours)) * Math.max(0, finite(input.labourRate)));
  const fixed = roundMoney(finite(input.fixedAmount));
  const partsBase = roundMoney(quantity * Math.max(0, finite(input.partCost)));
  const markup = roundMoney(partsBase * (Math.max(0, finite(input.markupPercent)) / 100));
  const freight = roundMoney(Math.max(0, finite(input.freightAmount)));
  const adjustment = roundMoney(finite(input.adjustmentAmount));
  const total = roundMoney(labour + fixed + partsBase + markup + freight + adjustment);

  return {
    labour,
    fixed,
    partsBase,
    markup,
    freight,
    adjustment,
    total,
  };
}

function addCategoryTotal(target: Record<string, number>, line: EstimateTotalInput) {
  const key = line.categoryCode || "uncategorised";
  target[key] = roundMoney((target[key] ?? 0) + finite(line.lineTotalExTax));
}

export function calculateEstimateTotals(lines: EstimateTotalInput[], taxRate: number) {
  const includedLines = lines.filter((line) => !line.reportSelected && !line.extraSelected);
  const reportOnlyLines = lines.filter((line) => Boolean(line.reportSelected) && !line.extraSelected);
  const extraLines = lines.filter((line) => Boolean(line.extraSelected));

  const subtotal = roundMoney(includedLines.reduce((sum, line) => sum + finite(line.lineTotalExTax), 0));
  const reportOnlySubtotal = roundMoney(reportOnlyLines.reduce((sum, line) => sum + finite(line.lineTotalExTax), 0));
  const extraSubtotal = roundMoney(extraLines.reduce((sum, line) => sum + finite(line.lineTotalExTax), 0));
  const grossVisibleSubtotal = roundMoney(subtotal + reportOnlySubtotal + extraSubtotal);

  const safeTaxRate = Math.max(0, finite(taxRate));
  const tax = roundMoney(subtotal * (safeTaxRate / 100));
  const total = roundMoney(subtotal + tax);

  const categoryTotals: Record<string, number> = {};
  const reportCategoryTotals: Record<string, number> = {};
  const extraCategoryTotals: Record<string, number> = {};

  includedLines.forEach((line) => addCategoryTotal(categoryTotals, line));
  reportOnlyLines.forEach((line) => addCategoryTotal(reportCategoryTotals, line));
  extraLines.forEach((line) => addCategoryTotal(extraCategoryTotals, line));

  return {
    subtotal,
    reportOnlySubtotal,
    extraSubtotal,
    grossVisibleSubtotal,
    tax,
    total,
    categoryTotals,
    reportCategoryTotals,
    extraCategoryTotals,
  };
}

export function parseNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
