import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderSimplePdf } from "@/lib/reports/simple-pdf";

export const runtime = "nodejs";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "estimate";
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Authentication required" }, { status: 401 });

  const { data: version } = await supabase
    .from("estimate_versions")
    .select("id, organization_id, estimate_id, job_id, version_number, status_snapshot, currency, tax_rate, subtotal_ex_tax, tax_amount, total_inc_tax, category_totals, rate_card_snapshot, pricing_snapshot, created_at")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return NextResponse.json({ message: "Estimate version not found" }, { status: 404 });

  const [jobResult, itemResult, settingsResult, templateResult] = await Promise.all([
    supabase.from("jobs").select("id, job_number, customer_id, vehicle_id, job_reference, repair_type, work_source").eq("organization_id", version.organization_id).eq("id", version.job_id).maybeSingle(),
    supabase.from("estimate_version_items").select("category_name, component, side, operation_code, description, quantity, labour_hours, labour_rate, fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount, line_total_ex_tax, report_selected, blend_selected, extra_selected, sort_order").eq("organization_id", version.organization_id).eq("estimate_version_id", version.id).order("sort_order"),
    supabase.from("workshop_settings").select("trading_name, legal_name, gst_number, email, phone, address_line_1, address_line_2, suburb, city, postcode, estimate_valid_days, estimate_terms").eq("organization_id", version.organization_id).maybeSingle(),
    supabase.from("report_templates").select("id, name, header_text, footer_text").eq("organization_id", version.organization_id).eq("report_type", "insurance_estimate").eq("is_default", true).eq("is_active", true).maybeSingle(),
  ]);
  const job = jobResult.data;
  if (!job) return NextResponse.json({ message: "Job not found" }, { status: 404 });

  const [vehicleResult, customerResult, claimResult] = await Promise.all([
    job.vehicle_id ? supabase.from("vehicles").select("registration, vin, make, model, variant, model_year, colour, paint_code, odometer_km").eq("id", job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    job.customer_id ? supabase.from("customers").select("first_name, last_name, business_name, email, phone").eq("id", job.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("claims").select("claim_number, policy_number, insurer_id, assessor_name, assessor_email, excess_amount, accident_date, accident_location, authority_reference").eq("organization_id", version.organization_id).eq("job_id", job.id).maybeSingle(),
  ]);
  const claim = claimResult.data;
  const { data: insurer } = claim?.insurer_id ? await supabase.from("insurers").select("name").eq("id", claim.insurer_id).maybeSingle() : { data: null };
  const vehicle = vehicleResult.data;
  const customer = customerResult.data;
  const settings = settingsResult.data;
  const template = templateResult.data;
  const items = itemResult.data ?? [];
  const includedItems = items.filter((item) => !item.report_selected && !item.extra_selected);
  const reportOnlyItems = items.filter((item) => item.report_selected && !item.extra_selected);
  const extraItems = items.filter((item) => item.extra_selected);
  const reportOnlySubtotal = reportOnlyItems.reduce((sum, item) => sum + Number(item.line_total_ex_tax ?? 0), 0);
  const extraSubtotal = extraItems.reduce((sum, item) => sum + Number(item.line_total_ex_tax ?? 0), 0);
  const workshopName = settings?.trading_name || settings?.legal_name || "Repair Workshop";
  const customerName = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer";
  const vehicleName = [vehicle?.model_year, vehicle?.make, vehicle?.model, vehicle?.variant].filter(Boolean).join(" ") || "Vehicle";

  const operationLines = (source: typeof items, label?: string) => source.flatMap((item, index) => [
    { text: `${index + 1}. ${item.category_name} | ${[item.side, item.component, item.operation_code].filter(Boolean).join(" ") || "Operation"}${label ? ` | ${label}` : ""}`, bold: true, size: 9 },
    { text: `${item.description} | Qty ${Number(item.quantity).toFixed(2)} | Labour ${Number(item.labour_hours).toFixed(2)}h @ ${money(Number(item.labour_rate), version.currency)} | Line ${money(Number(item.line_total_ex_tax), version.currency)}${item.blend_selected ? " | Blend" : ""}`, size: 8, indent: 1, gapAfter: 3 },
  ]);

  const lines = [
    ...(template?.header_text ? [{ text: template.header_text, size: 9, gapAfter: 8 }] : []),
    { text: workshopName, bold: true, size: 13, gapAfter: 2 },
    { text: [settings?.address_line_1, settings?.address_line_2, settings?.suburb, settings?.city, settings?.postcode].filter(Boolean).join(", "), size: 9 },
    { text: [settings?.phone, settings?.email, settings?.gst_number ? `GST: ${settings.gst_number}` : null].filter(Boolean).join("  |  "), size: 9, gapAfter: 10 },
    { text: "INSURANCE / REPAIR ESTIMATE", bold: true, size: 14, gapAfter: 8 },
    { text: `Job: ${job.job_number}   Estimate version: ${version.version_number}   Created: ${new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(new Date(version.created_at))}`, size: 9, gapAfter: 5 },
    { text: `Customer: ${customerName}   Claim: ${claim?.claim_number || "-"}   Insurer: ${insurer?.name || "-"}`, size: 9 },
    { text: `Policy: ${claim?.policy_number || "-"}   Assessor: ${claim?.assessor_name || "-"}   Authority: ${claim?.authority_reference || "-"}`, size: 9 },
    { text: `Vehicle: ${vehicleName}   Registration: ${vehicle?.registration || "-"}   VIN: ${vehicle?.vin || "-"}`, size: 9 },
    { text: `Colour/Paint: ${[vehicle?.colour, vehicle?.paint_code].filter(Boolean).join(" / ") || "-"}   Odometer: ${vehicle?.odometer_km != null ? `${Number(vehicle.odometer_km).toLocaleString("en-NZ")} km` : "-"}   Excess: ${claim?.excess_amount != null ? money(Number(claim.excess_amount), version.currency) : "-"}`, size: 9, gapAfter: 10 },
    { text: "CURRENT ESTIMATE OPERATIONS", bold: true, size: 11, gapAfter: 5 },
    ...operationLines(includedItems),
    ...(reportOnlyItems.length ? [
      { text: "REPORT-ONLY ITEMS - PRICE SHOWN, NOT INCLUDED IN CURRENT TOTAL", bold: true, size: 10, gapAfter: 5 },
      ...operationLines(reportOnlyItems, "REPORT ONLY"),
      { text: `Report-only subtotal: ${money(reportOnlySubtotal, version.currency)} (excluded from total)`, bold: true, size: 9, gapAfter: 8 },
    ] : []),
    ...(extraItems.length ? [
      { text: "ADDITIONAL / PENDING EXTRAS - NOT INCLUDED IN CURRENT TOTAL", bold: true, size: 10, gapAfter: 5 },
      ...operationLines(extraItems, "EXTRA"),
      { text: `Pending extras subtotal: ${money(extraSubtotal, version.currency)} (excluded from total)`, bold: true, size: 9, gapAfter: 8 },
    ] : []),
    { text: "FINANCIAL SUMMARY", bold: true, size: 11, gapAfter: 5 },
    ...Object.entries((version.category_totals ?? {}) as Record<string, number | string>).map(([category, value]) => ({ text: `${category.toUpperCase()}: ${money(Number(value), version.currency)}`, size: 9, indent: 1 })),
    { text: `Included subtotal: ${money(Number(version.subtotal_ex_tax), version.currency)}`, bold: true, size: 10, gapAfter: 1 },
    { text: `GST ${Number(version.tax_rate).toFixed(2)}%: ${money(Number(version.tax_amount), version.currency)}`, size: 10 },
    { text: `CURRENT ESTIMATE TOTAL: ${money(Number(version.total_inc_tax), version.currency)}`, bold: true, size: 13, gapAfter: 4 },
    ...(reportOnlySubtotal ? [{ text: `Report-only value (excluded): ${money(reportOnlySubtotal, version.currency)}`, size: 9 }] : []),
    ...(extraSubtotal ? [{ text: `Pending extras (excluded): ${money(extraSubtotal, version.currency)}`, size: 9, gapAfter: 10 }] : []),
    ...(claim?.accident_date || claim?.accident_location ? [{ text: `Accident: ${[claim.accident_date, claim.accident_location].filter(Boolean).join(" | ")}`, size: 9, gapAfter: 5 }] : []),
    ...(settings?.estimate_terms ? [{ text: "TERMS", bold: true, size: 10, gapAfter: 3 }, { text: settings.estimate_terms, size: 8 }] : []),
  ];

  const pdf = renderSimplePdf({
    title: `${workshopName} - Repair Estimate`,
    subtitle: `${job.job_number} | ${vehicle?.registration || vehicleName} | Version ${version.version_number}`,
    lines,
    footer: template?.footer_text || `Estimate version ${version.version_number}. Report-only and pending-extra items are displayed separately and excluded from the current estimate total.`,
  });
  const sha256 = createHash("sha256").update(pdf).digest("hex");

  let { data: report } = await supabase
    .from("reports")
    .select("id")
    .eq("organization_id", version.organization_id)
    .eq("estimate_version_id", version.id)
    .eq("report_type", "insurance_estimate")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!report) {
    const result = await supabase.from("reports").insert({
      organization_id: version.organization_id,
      job_id: job.id,
      report_type: "insurance_estimate",
      estimate_version_id: version.id,
      template_id: template?.id ?? null,
      status: "draft",
      title: `${job.job_number} Insurance Estimate`,
      created_by: auth.user.id,
    }).select("id").single();
    report = result.data;
  }
  if (!report) return NextResponse.json({ message: "Unable to register report" }, { status: 500 });

  const { data: previousVersion } = await supabase.from("report_versions").select("version_number").eq("organization_id", version.organization_id).eq("report_id", report.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const reportVersionNumber = Number(previousVersion?.version_number ?? 0) + 1;
  const reportVersionId = randomUUID();
  const fileName = `${safeFilePart(job.job_number)}-estimate-v${version.version_number}-r${reportVersionNumber}.pdf`;
  const storagePath = `${version.organization_id}/${job.id}/${reportVersionId}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from("report-files").upload(storagePath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) return NextResponse.json({ message: "Unable to store generated report" }, { status: 500 });

  const contentSnapshot = {
    estimate_version_id: version.id,
    estimate_version_number: version.version_number,
    job_number: job.job_number,
    workshop_name: workshopName,
    customer_name: customerName,
    vehicle: vehicleName,
    registration: vehicle?.registration,
    claim_number: claim?.claim_number,
    insurer: insurer?.name,
    totals: {
      subtotal: version.subtotal_ex_tax,
      tax_rate: version.tax_rate,
      tax: version.tax_amount,
      total: version.total_inc_tax,
      report_only: reportOnlySubtotal,
      pending_extras: extraSubtotal,
    },
    item_count: items.length,
    included_item_count: includedItems.length,
    report_only_item_count: reportOnlyItems.length,
    extra_item_count: extraItems.length,
  };

  const { error: versionInsertError } = await supabase.from("report_versions").insert({
    id: reportVersionId,
    organization_id: version.organization_id,
    report_id: report.id,
    version_number: reportVersionNumber,
    content_snapshot: contentSnapshot,
    storage_path: storagePath,
    mime_type: "application/pdf",
    sha256,
    generated_by: auth.user.id,
  });
  if (versionInsertError) {
    await supabase.storage.from("report-files").remove([storagePath]);
    return NextResponse.json({ message: "Unable to version the generated report" }, { status: 500 });
  }

  await Promise.all([
    supabase.from("reports").update({ status: "generated" }).eq("organization_id", version.organization_id).eq("id", report.id),
    supabase.from("activity_events").insert({ organization_id: version.organization_id, job_id: job.id, actor_user_id: auth.user.id, event_type: "insurance_report_generated", title: "Insurance estimate PDF generated", details: { report_id: report.id, report_version_id: reportVersionId, estimate_version_id: version.id, sha256 } }),
  ]);

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
