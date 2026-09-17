import { redirect } from "next/navigation";

export default async function LegacySecondPassRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const state = query.error ? "?error=1" : query.message ? "?message=1" : "";
  redirect(`/jobs/${id}/ai-review/second-pass${state}`);
}
