import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Camera,
  CircleDollarSign,
  FileCheck2,
  PackageSearch,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/context";
import { calculateEstimateTotals } from "@/lib/estimating/pricing-engine";

function statusLabel(status: string) {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function money(value: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 }).format(value);
}

export default async function DashboardPage() {
  const { supabase, organizationId } = await requireOrganizationContext();

  const [jobResult, estimateResult, reviewResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_number, status, customer_id, vehicle_id, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("estimates")
      .select("id, job_id, status, tax_rate")
      .eq("organization_id", organizationId)
      .neq("status", "cancelled"),
    supabase
      .from("ai_review_checks")
      .select("id, job_id, severity, resolution")
      .eq("organization_id", organizationId),
  ]);

  const jobs = jobResult.data ?? [];
  const estimates = estimateResult.data ?? [];
  const reviewChecks = reviewResult.data ?? [];
  const vehicleIds = jobs.map((job) => job.vehicle_id).filter((id): id is string => Boolean(id));
  const customerIds = jobs.map((job) => job.customer_id).filter((id): id is string => Boolean(id));
  const estimateIds = estimates.map((estimate) => estimate.id);

  const [vehicleResult, customerResult, claimResult, itemResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, make, model, model_year, registration").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? supabase.from("customers").select("id, first_name, last_name, business_name").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    jobs.length
      ? supabase.from("claims").select("job_id, claim_number").in("job_id", jobs.map((job) => job.id))
      : Promise.resolve({ data: [] }),
    estimateIds.length
      ? supabase.from("estimate_items").select("estimate_id, line_total_ex_tax").in("estimate_id", estimateIds)
      : Promise.resolve({ data: [] }),
  ]);

  const vehicles = vehicleResult.data ?? [];
  const customers = customerResult.data ?? [];
  const claims = claimResult.data ?? [];
  const items = itemResult.data ?? [];
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const claimByJobId = new Map(claims.map((claim) => [claim.job_id, claim]));
  const estimateByJobId = new Map(estimates.map((estimate) => [estimate.job_id, estimate]));

  const estimateTotals = new Map(
    estimates.map((estimate) => {
      const estimateItems = items.filter((item) => item.estimate_id === estimate.id);
      const totals = calculateEstimateTotals(
        estimateItems.map((item) => ({ lineTotalExTax: Number(item.line_total_ex_tax) })),
        Number(estimate.tax_rate),
      );
      return [estimate.id, totals.total] as const;
    }),
  );

  const awaitingAiReview = jobs.filter((job) => job.status === "ai_review").length;
  const awaitingParts = jobs.filter((job) => job.status === "awaiting_parts").length;
  const ready = jobs.filter((job) => ["ready_for_approval", "approved"].includes(job.status)).length;
  const newAssessments = jobs.filter((job) => ["draft", "intake_complete", "photos_required", "damage_review"].includes(job.status)).length;
  const unresolvedReviews = reviewChecks.filter((check) => !check.resolution && ["review", "blocking"].includes(check.severity)).length;
  const blockingReviews = reviewChecks.filter((check) => !check.resolution && check.severity === "blocking").length;
  const passedReviews = reviewChecks.filter((check) => check.severity === "pass").length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthJobIds = new Set(jobs.filter((job) => new Date(job.updated_at) >= monthStart).map((job) => job.id));
  const monthValue = estimates.reduce((sum, estimate) => {
    if (!monthJobIds.has(estimate.job_id)) return sum;
    return sum + (estimateTotals.get(estimate.id) ?? 0);
  }, 0);
  const monthEstimateCount = estimates.filter((estimate) => monthJobIds.has(estimate.job_id)).length;
  const averageRepair = monthEstimateCount ? monthValue / monthEstimateCount : 0;

  const stats = [
    { label: "New assessments", value: String(newAssessments), note: "Intake / photos", icon: Camera },
    { label: "Awaiting AI review", value: String(awaitingAiReview), note: unresolvedReviews ? `${unresolvedReviews} checks open` : "No open checks", icon: Bot },
    { label: "Awaiting parts", value: String(awaitingParts), note: "Parts / TBC", icon: PackageSearch },
    { label: "Ready to finalise", value: String(ready), note: "Approval workflow", icon: FileCheck2 },
  ];

  const recentRows = jobs.slice(0, 8).map((job) => {
    const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined;
    const customer = job.customer_id ? customerById.get(job.customer_id) : undefined;
    const estimate = estimateByJobId.get(job.id);
    return {
      id: job.id,
      job: job.job_number ?? "Job",
      vehicle: [vehicle?.model_year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle pending",
      registration: vehicle?.registration || "—",
      customer: customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer pending",
      claim: claimByJobId.get(job.id)?.claim_number || "—",
      status: statusLabel(job.status),
      total: estimate ? money(estimateTotals.get(estimate.id) ?? 0) : "—",
    };
  });

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--brand)]"><ShieldCheck className="size-4" /> Insurance estimating workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight">Workshop dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">Live workshop workload, estimate status and review attention areas. AI suggestions remain under estimator control.</p>
        </div>
        <Link href="/jobs/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[#06110e] transition hover:bg-[var(--brand-strong)]"><Plus className="size-4" /> New assessment</Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => { const Icon = stat.icon; return <article key={stat.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-6 flex items-center justify-between"><span className="text-sm text-[var(--muted)]">{stat.label}</span><span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-3)] text-[var(--brand)]"><Icon className="size-4" /></span></div><div className="flex items-end justify-between gap-3"><strong className="text-3xl font-semibold">{stat.value}</strong><span className="text-xs text-[var(--muted)]">{stat.note}</span></div></article>; })}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="font-semibold">Recent jobs</h2><p className="mt-1 text-xs text-[var(--muted)]">Latest tenant-scoped assessments and estimate totals.</p></div><Link href="/jobs" className="flex items-center gap-1 text-xs font-semibold text-[var(--brand)]">View all <ArrowRight className="size-3.5" /></Link></div>
          {recentRows.length === 0 ? <div className="grid min-h-64 place-items-center px-6 text-center"><div><p className="font-medium">No assessments yet</p><p className="mt-2 text-sm text-[var(--muted)]">Create the first job to start the intake and evidence workflow.</p><Link href="/jobs/new" className="mt-4 inline-flex text-sm font-semibold text-[var(--brand)]">Create assessment →</Link></div></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[#0a1423] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-5 py-3 font-medium">Job</th><th className="px-5 py-3 font-medium">Vehicle</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Claim</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Estimate</th></tr></thead><tbody>{recentRows.map((row) => <tr key={row.id} className="border-t border-[var(--border)]/70 hover:bg-[var(--surface-2)]/60"><td className="px-5 py-4"><Link href={`/jobs/${row.id}`} className="font-medium hover:text-[var(--brand)]">{row.job}</Link></td><td className="px-5 py-4"><div>{row.vehicle}</div><div className="mt-1 text-xs text-[var(--muted)]">{row.registration}</div></td><td className="px-5 py-4 text-[var(--muted)]">{row.customer}</td><td className="px-5 py-4 text-[var(--muted)]">{row.claim}</td><td className="px-5 py-4"><span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs">{row.status}</span></td><td className="px-5 py-4 text-right font-medium tabular-nums">{row.total}</td></tr>)}</tbody></table></div>}
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">AI estimate review</h2><p className="mt-1 text-xs text-[var(--muted)]">Review status from completed checks.</p></div><Sparkles className="size-5 text-[var(--brand)]" /></div>
            <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border border-[var(--border)] p-3"><div className="text-lg font-semibold text-[var(--brand)]">{passedReviews}</div><div className="text-[10px] text-[var(--muted)]">Passed</div></div><div className="rounded-xl border border-[var(--border)] p-3"><div className="text-lg font-semibold">{unresolvedReviews}</div><div className="text-[10px] text-[var(--muted)]">Review</div></div><div className="rounded-xl border border-[var(--border)] p-3"><div className="text-lg font-semibold text-[var(--danger)]">{blockingReviews}</div><div className="text-[10px] text-[var(--muted)]">Blocking</div></div></div>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#102439] to-[#0d1a2c] p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Estimated this month</p><p className="mt-2 text-3xl font-semibold">{money(monthValue)}</p></div><CircleDollarSign className="size-8 text-[var(--brand)]" /></div>
            <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]"><span>Average estimate</span><strong className="text-sm text-white">{money(averageRepair)}</strong></div>
          </article>
        </div>
      </section>
    </div>
  );
}
