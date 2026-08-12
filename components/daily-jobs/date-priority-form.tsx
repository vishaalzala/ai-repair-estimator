"use client";

import { useRef } from "react";

export function DatePriorityForm({
  action,
  jobId,
  scheduledDate,
  priority,
}: {
  action: (formData: FormData) => void | Promise<void>;
  jobId: string;
  scheduledDate: string;
  priority: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="grid min-w-[150px] gap-1.5">
      <input type="hidden" name="job_id" value={jobId} />
      <input
        type="date"
        name="scheduled_date"
        defaultValue={scheduledDate}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-[var(--border)] bg-[#091322] px-2 py-1.5 text-xs outline-none focus:border-[var(--brand)]"
      />
      <select
        name="priority"
        defaultValue={priority}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-[var(--border)] bg-[#091322] px-2 py-1.5 text-xs outline-none focus:border-[var(--brand)]"
      >
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
    </form>
  );
}
