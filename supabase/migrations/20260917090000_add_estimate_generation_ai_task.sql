alter table public.ai_analysis_runs
  drop constraint if exists ai_analysis_runs_task_check;

alter table public.ai_analysis_runs
  add constraint ai_analysis_runs_task_check
  check (task = any (array[
    'photo_classification'::text,
    'vehicle_intake'::text,
    'damage_analysis'::text,
    'estimate_generation'::text,
    'estimate_review'::text,
    'document_extraction'::text,
    'learning_analysis'::text
  ]));
