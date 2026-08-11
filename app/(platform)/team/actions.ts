"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/context";

const allowedRoles = new Set(["admin", "manager", "estimator", "reviewer", "parts", "technician", "read_only"]);

export async function createWorkshopInvitation(formData: FormData) {
  const { supabase, organizationId, userId, role } = await requireOrganizationContext();
  if (!["owner", "admin", "manager"].includes(role)) redirect("/team?error=Only%20workshop%20management%20can%20invite%20users");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const memberRole = String(formData.get("role") ?? "estimator");
  if (!email.includes("@") || !allowedRoles.has(memberRole)) redirect("/team?error=Enter%20a%20valid%20email%20and%20role");

  await supabase.from("organization_invitations").update({ status: "revoked" }).eq("organization_id", organizationId).eq("email", email).eq("status", "pending");

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("organization_invitations").insert({
    organization_id: organizationId,
    email,
    role: memberRole,
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by: userId,
  });
  if (error) {
    console.error("Invitation create failed", error.code);
    redirect("/team?error=Unable%20to%20create%20the%20invitation");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const link = `${appUrl}/invite/${encodeURIComponent(token)}`;
  revalidatePath("/team");
  redirect(`/team?message=Invitation%20created&invite=${encodeURIComponent(link)}`);
}

export async function revokeWorkshopInvitation(formData: FormData) {
  const { supabase, organizationId, role } = await requireOrganizationContext();
  if (!["owner", "admin", "manager"].includes(role)) return;
  const invitationId = String(formData.get("invitation_id") ?? "");
  if (!invitationId) return;
  await supabase.from("organization_invitations").update({ status: "revoked" }).eq("organization_id", organizationId).eq("id", invitationId).eq("status", "pending");
  revalidatePath("/team");
}
