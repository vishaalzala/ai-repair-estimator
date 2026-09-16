alter table public.workshop_settings
  add column if not exists parking_fee_enabled boolean not null default false,
  add column if not exists parking_fee_daily_rate numeric(12,2) not null default 0;

alter table public.workshop_settings
  drop constraint if exists workshop_settings_parking_fee_daily_rate_check;

alter table public.workshop_settings
  add constraint workshop_settings_parking_fee_daily_rate_check
  check (parking_fee_daily_rate >= 0);
