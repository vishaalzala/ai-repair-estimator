alter table public.estimate_items
  add column if not exists report_selected boolean not null default false,
  add column if not exists blend_selected boolean not null default false;

comment on column public.estimate_items.report_selected is
  'Estimator-selected flag for including/highlighting the operation in the repair report.';

comment on column public.estimate_items.blend_selected is
  'Paint-only blend flag. Application logic keeps this false for non-paint categories.';
