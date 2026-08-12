"use client";

import { useRef } from "react";

type Option = { value: string; label: string };

export function AutoSubmitSelect({
  action,
  name,
  value,
  options,
  hidden,
  className = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  value: string;
  options: Option[];
  hidden?: Record<string, string>;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline-flex">
      {Object.entries(hidden ?? {}).map(([key, hiddenValue]) => (
        <input key={key} type="hidden" name={key} value={hiddenValue} />
      ))}
      <select
        name={name}
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
        className={`rounded-lg border border-[var(--border)] bg-[#091322] px-2 py-1.5 text-xs outline-none transition focus:border-[var(--brand)] ${className}`}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </form>
  );
}

export function AutoSubmitCheckbox({
  action,
  name,
  checked,
  hidden,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  checked: boolean;
  hidden?: Record<string, string>;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline-flex items-center gap-2">
      {Object.entries(hidden ?? {}).map(([key, hiddenValue]) => (
        <input key={key} type="hidden" name={key} value={hiddenValue} />
      ))}
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          name={name}
          defaultChecked={checked}
          onChange={() => formRef.current?.requestSubmit()}
          className="size-4 accent-[var(--brand)]"
        />
        <span>{label}</span>
      </label>
    </form>
  );
}
