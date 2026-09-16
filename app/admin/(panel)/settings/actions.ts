"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

export async function savePlatformSettings(formData: FormData){
  const fx=Number(formData.get("usd_to_nzd_rate")??0); const markup=Number(formData.get("ai_markup_percent")??0);
  if(fx<=0||markup<0)return;
  const {supabase,userId}=await requirePlatformAdmin(); const now=new Date().toISOString();
  await Promise.all([
    supabase.from("platform_settings").upsert({key:"usd_to_nzd_rate",value:fx,updated_by:userId,updated_at:now}),
    supabase.from("platform_settings").upsert({key:"ai_markup_percent",value:markup,updated_by:userId,updated_at:now}),
    supabase.from("platform_audit_logs").insert({actor_user_id:userId,action:"platform_billing_settings_updated",entity_type:"platform_settings",metadata:{usd_to_nzd_rate:fx,ai_markup_percent:markup}}),
  ]);
  revalidatePath("/admin/settings");
}
