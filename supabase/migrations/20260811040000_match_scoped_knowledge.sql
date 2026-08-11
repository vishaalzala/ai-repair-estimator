create or replace function public.match_scoped_knowledge(
  p_query_embedding extensions.vector(1536),
  p_organization_id uuid,
  p_match_threshold double precision default 0.55,
  p_match_count integer default 12
)
returns table (
  chunk_id uuid,
  source_id uuid,
  document_id uuid,
  scope text,
  title text,
  page_number integer,
  section_title text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id as chunk_id,
    c.source_id,
    c.document_id,
    s.scope,
    s.title,
    c.page_number,
    c.section_title,
    c.content,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_sources s on s.id = c.source_id
  where c.embedding is not null
    and s.status = 'active'
    and (
      s.scope = 'global'
      or (s.scope in ('organization','user') and s.organization_id = p_organization_id)
    )
    and 1 - (c.embedding <=> p_query_embedding) >= p_match_threshold
  order by c.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 30);
$$;

revoke all on function public.match_scoped_knowledge(extensions.vector, uuid, double precision, integer) from public, anon;
grant execute on function public.match_scoped_knowledge(extensions.vector, uuid, double precision, integer) to authenticated;
