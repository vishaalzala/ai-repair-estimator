create policy organization_counters_no_client_access on public.organization_counters
for all to authenticated
using (false)
with check (false);
