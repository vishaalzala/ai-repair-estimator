create policy knowledge_documents_update_owner on public.knowledge_documents
for update to authenticated
using (
  exists (
    select 1 from public.knowledge_sources s
    where s.id = source_id
      and s.organization_id = organization_id
      and (
        (s.scope = 'user' and s.user_id = (select auth.uid()))
        or (s.scope = 'organization' and private.has_org_role(s.organization_id, array['owner','admin','manager']))
      )
  )
)
with check (
  exists (
    select 1 from public.knowledge_sources s
    where s.id = source_id
      and s.organization_id = organization_id
      and (
        (s.scope = 'user' and s.user_id = (select auth.uid()))
        or (s.scope = 'organization' and private.has_org_role(s.organization_id, array['owner','admin','manager']))
      )
  )
);

create policy knowledge_chunks_insert_owner on public.knowledge_chunks
for insert to authenticated
with check (
  exists (
    select 1 from public.knowledge_sources s
    where s.id = source_id
      and (
        (s.scope = 'user' and s.user_id = (select auth.uid()) and s.organization_id = organization_id)
        or (s.scope = 'organization' and s.organization_id = organization_id and private.has_org_role(s.organization_id, array['owner','admin','manager']))
      )
  )
);

create policy knowledge_chunks_delete_owner on public.knowledge_chunks
for delete to authenticated
using (
  exists (
    select 1 from public.knowledge_sources s
    where s.id = source_id
      and (
        (s.scope = 'user' and s.user_id = (select auth.uid()))
        or (s.scope = 'organization' and private.has_org_role(s.organization_id, array['owner','admin','manager']))
      )
  )
);

grant update on public.knowledge_documents to authenticated;
grant insert, delete on public.knowledge_chunks to authenticated;
