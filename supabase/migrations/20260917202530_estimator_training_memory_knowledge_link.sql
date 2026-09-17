alter table public.estimator_training_cases
  add column if not exists knowledge_source_id uuid references public.knowledge_sources(id) on delete set null;

create index if not exists estimator_training_cases_knowledge_source_idx
  on public.estimator_training_cases(knowledge_source_id)
  where knowledge_source_id is not null;
