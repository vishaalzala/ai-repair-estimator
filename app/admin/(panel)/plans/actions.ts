"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

export async function savePlan(formData:FormData){
  const id=String(formData.get("plan_id")??""); const code=String(formData.get("code")??"").trim().toLowerCase(); const name=String(formData.get("name")??"").trim();
  const monthly=Number(formData.get("monthly_price_nzd")??0); const markup=Number(formData.get("ai_markup_percent")??0); const minimum=Number(formData.get("minimum_estimate_charge_nzd")??0); const active=String(formData.get("active")??"")==="on";
  if(!code||!name||monthly<0||markup<0||minimum<0)return;
  const {supabase,userId}=await requirePlatformAdmin();
  const payload={code,name,description:String(formData.get("description")??"").trim()||null,monthly_price_nzd:monthly,ai_markup_percent:markup,minimum_estimate_charge_nzd:minimum,active,updated_at:new Date().toISOString()};
  let planId=id;
  if(id){await supabase.from("plans").update(payload).eq("id",id);}else{const {data}=await supabase.from("plans").insert(payload).select("id").single(); planId=data?.id??"";}
  await supabase.from("platform_audit_logs").insert({actor_user_id:userId,action:id?"plan_updated":"plan_created",entity_type:"plan",entity_id:planId,metadata:{code,monthly,markup,minimum,active}});
  revalidatePath("/admin/plans");
}
