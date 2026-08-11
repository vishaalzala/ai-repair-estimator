alter table public.branches add constraint branches_org_id_unique unique (organization_id, id);
alter table public.customers add constraint customers_org_id_unique unique (organization_id, id);
alter table public.vehicles add constraint vehicles_org_id_unique unique (organization_id, id);
alter table public.insurers add constraint insurers_org_id_unique unique (organization_id, id);
alter table public.jobs add constraint jobs_org_id_unique unique (organization_id, id);

alter table public.vehicles
  add constraint vehicles_customer_same_org_fk
  foreign key (organization_id, customer_id)
  references public.customers(organization_id, id)
  on delete set null (customer_id);

alter table public.jobs
  add constraint jobs_branch_same_org_fk
  foreign key (organization_id, branch_id)
  references public.branches(organization_id, id)
  on delete set null (branch_id),
  add constraint jobs_customer_same_org_fk
  foreign key (organization_id, customer_id)
  references public.customers(organization_id, id)
  on delete set null (customer_id),
  add constraint jobs_vehicle_same_org_fk
  foreign key (organization_id, vehicle_id)
  references public.vehicles(organization_id, id)
  on delete set null (vehicle_id),
  add constraint jobs_assigned_member_fk
  foreign key (organization_id, assigned_to)
  references public.organization_members(organization_id, user_id)
  on delete set null (assigned_to);

alter table public.claims
  add constraint claims_job_same_org_fk
  foreign key (organization_id, job_id)
  references public.jobs(organization_id, id)
  on delete cascade,
  add constraint claims_insurer_same_org_fk
  foreign key (organization_id, insurer_id)
  references public.insurers(organization_id, id)
  on delete set null (insurer_id);

alter table public.job_assignments
  add constraint job_assignments_job_same_org_fk
  foreign key (organization_id, job_id)
  references public.jobs(organization_id, id)
  on delete cascade,
  add constraint job_assignments_member_fk
  foreign key (organization_id, user_id)
  references public.organization_members(organization_id, user_id)
  on delete cascade;

alter table public.job_status_history
  add constraint job_status_history_job_same_org_fk
  foreign key (organization_id, job_id)
  references public.jobs(organization_id, id)
  on delete cascade;

alter table public.job_notes
  add constraint job_notes_job_same_org_fk
  foreign key (organization_id, job_id)
  references public.jobs(organization_id, id)
  on delete cascade;

alter table public.activity_events
  add constraint activity_events_job_same_org_fk
  foreign key (organization_id, job_id)
  references public.jobs(organization_id, id)
  on delete cascade;
