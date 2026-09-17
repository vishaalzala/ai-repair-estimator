"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";
import { syncAutomaticEstimateChargesForOpenEstimates } from "@/lib/estimating/automatic-charges";
import { syncAutomaticParkingFeesForOpenEstimates } from "@/lib/estimating/parking-fees";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function managementRole(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

export async function updateWorkshopProfile(formData: FormData) {
  const { supabase, organizationId, role } = await requireOrganizationContext();
  if (!managementRole(role)) {
    redirect("/settings/workshop?error=Only%20workshop%20management%20can%20change%20business%20settings");
  }

  const gstRate = Number(formData.get("gst_rate") ?? 15);
  const validDays = Number(formData.get("estimate_valid_days") ?? 30);
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100 || !Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
    redirect("/settings/workshop?error=Please%20check%20the%20GST%20rate%20and%20estimate%20validity");
  }

  const { error } = await supabase
    .from("workshop_settings")
    .update({
      trading_name: text(formData, "trading_name") || null,
      legal_name: text(formData, "legal_name") || null,
      gst_number: text(formData, "gst_number") || null,
      email: text(formData, "email") || null,
      phone: text(formData, "phone") || null,
      address_line_1: text(formData, "address_line_1") || null,
      address_line_2: text(formData, "address_line_2") || null,
      suburb: text(formData, "suburb") || null,
      city: text(formData, "city") || null,
      postcode: text(formData, "postcode") || null,
      country_code: text(formData, "country_code").toUpperCase().slice(0, 2) || "NZ",
      default_currency: text(formData, "default_currency").toUpperCase().slice(0, 3) || "NZD",
      gst_rate: gstRate,
      estimate_valid_days: validDays,
      estimate_terms: text(formData, "estimate_terms") || null,
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Workshop settings update failed", error.code);
    redirect("/settings/workshop?error=Unable%20to%20save%20workshop%20settings");
  }

  revalidatePath("/settings/workshop");
  redirect("/settings/workshop?message=Workshop%20settings%20saved");
}

export async function updateRateCardRate(formData: FormData) {
  const { supabase, organizationId, role } = await requireOrganizationContext();
  if (!managementRole(role)) {
    redirect("/settings/workshop?error=Only%20workshop%20management%20can%20change%20rates");
  }

  const rateCardId = text(formData, "rate_card_id");
  const categoryId = text(formData, "category_id");
  const hourlyRaw = text(formData, "hourly_rate");
  const fixedRaw = text(formData, "fixed_rate");
  const hourlyRate = hourlyRaw === "" ? null : Number(hourlyRaw);
  const fixedRate = fixedRaw === "" ? null : Number(fixedRaw);

  if (!rateCardId || !categoryId || (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) || (fixedRate !== null && (!Number.isFinite(fixedRate) || fixedRate < 0))) {
    redirect("/settings/workshop?error=Enter%20valid%20non-negative%20rates");
  }

  const [{ data: rateCard }, { data: category }] = await Promise.all([
    supabase.from("rate_cards").select("id").eq("organization_id", organizationId).eq("id", rateCardId).maybeSingle(),
    supabase.from("estimate_categories").select("id").eq("organization_id", organizationId).eq("id", categoryId).maybeSingle(),
  ]);
  if (!rateCard || !category) redirect("/settings/workshop?error=Invalid%20rate%20card%20selection");

  const { error } = await supabase.from("rate_card_rates").upsert({
    organization_id: organizationId,
    rate_card_id: rateCard.id,
    category_id: category.id,
    hourly_rate: hourlyRate,
    fixed_rate: fixedRate,
  }, { onConflict: "rate_card_id,category_id" });

  if (error) {
    console.error("Rate update failed", error.code);
    redirect("/settings/workshop?error=Unable%20to%20save%20that%20rate");
  }

  await syncAutomaticEstimateChargesForOpenEstimates();
  revalidatePath("/settings/workshop");
  revalidatePath("/jobs");
  redirect("/settings/workshop?message=Rate%20updated%20and%20automatic%20charges%20recalculated");
}

export async function updateAutomaticEstimateChargeSettings(formData: FormData) {
  const { supabase, organizationId, role } = await requireOrganizationContext();
  if (!managementRole(role)) {
    redirect("/settings/workshop?error=Only%20workshop%20management%20can%20change%20automatic%20estimate%20charges");
  }

  const panelPercent = Number(text(formData, "panel_materials_percent") || 0);
  const paintSetupAmount = Number(text(formData, "paint_setup_amount") || 0);
  const environmentalFeeAmount = Number(text(formData, "environmental_fee_amount") || 0);

  if (
    !Number.isFinite(panelPercent) || panelPercent < 0 || panelPercent > 100 ||
    !Number.isFinite(paintSetupAmount) || paintSetupAmount < 0 ||
    !Number.isFinite(environmentalFeeAmount) || environmentalFeeAmount < 0
  ) {
    redirect("/settings/workshop?error=Enter%20valid%20automatic%20charge%20values");
  }

  const { error } = await supabase
    .from("workshop_settings")
    .update({
      panel_materials_enabled: formData.get("panel_materials_enabled") === "on",
      panel_materials_percent: panelPercent,
      paint_setup_enabled: formData.get("paint_setup_enabled") === "on",
      paint_setup_amount: paintSetupAmount,
      environmental_fee_enabled: formData.get("environmental_fee_enabled") === "on",
      environmental_fee_amount: environmentalFeeAmount,
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Automatic estimate charge settings update failed", error.code);
    redirect("/settings/workshop?error=Unable%20to%20save%20automatic%20estimate%20charges");
  }

  await syncAutomaticEstimateChargesForOpenEstimates();
  revalidatePath("/settings/workshop");
  revalidatePath("/jobs");
  redirect("/settings/workshop?message=Automatic%20estimate%20charges%20saved%20and%20drafts%20recalculated");
}

export async function updateParkingFeeSettings(formData: FormData) {
  const { supabase, organizationId, role } = await requireOrganizationContext();
  if (!managementRole(role)) {
    redirect("/settings/workshop?error=Only%20workshop%20management%20can%20change%20parking%20fees");
  }

  const enabled = formData.get("parking_fee_enabled") === "on";
  const rateRaw = text(formData, "parking_fee_daily_rate");
  const dailyRate = rateRaw === "" ? 0 : Number(rateRaw);

  if (!Number.isFinite(dailyRate) || dailyRate < 0 || (enabled && dailyRate <= 0)) {
    redirect("/settings/workshop?error=Enter%20a%20parking%20fee%20greater%20than%200%20before%20enabling%20it");
  }

  const { error } = await supabase
    .from("workshop_settings")
    .update({
      parking_fee_enabled: enabled,
      parking_fee_daily_rate: dailyRate,
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Parking fee settings update failed", error.code);
    redirect("/settings/workshop?error=Unable%20to%20save%20parking%20fee%20settings");
  }

  await syncAutomaticParkingFeesForOpenEstimates();

  revalidatePath("/settings/workshop");
  revalidatePath("/jobs");
  redirect(`/settings/workshop?message=${enabled ? "Parking%20fees%20enabled%20and%20draft%20estimates%20updated" : "Parking%20fees%20disabled%20and%20draft%20charges%20removed"}`);
}
