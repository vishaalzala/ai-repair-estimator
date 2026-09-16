"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin/context";

export async function addModelPrice(formData: FormData){
  const model=String(formData.get("model")??"").trim();
  const input=Number(formData.get("input")??0); const cached=Number(formData.get("cached")??0); const output=Number(formData.get("output")??0);
  if(!model||input<0||cached<0||output<0)return;
  const {supabase,userId}=await requirePlatformAdmin();
  await Promise.all([
    supabase.from("ai_model_prices").update({active:false,effective_to:new Date().toISOString()}).eq("provider","openai").eq("model",model).eq("active",true),
    supabase.from("ai_model_prices").insert({provider:"openai",model,input_usd_per_million:input,cached_input_usd_per_million:cached,output_usd_per_million:output,effective_from:new Date().toISOString(),active:true}),
    supabase.from("platform_audit_logs").insert({actor_user_id:userId,action:"ai_model_price_updated",entity_type:"ai_model",entity_id:model,metadata:{input,cached,output}}),
  ]);
  revalidatePath("/admin/ai");
}
