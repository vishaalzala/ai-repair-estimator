"use server";

import { redirect } from "next/navigation";

export async function teachAi() {
  redirect("/dashboard");
}

export async function retireKnowledge() {
  redirect("/dashboard");
}
