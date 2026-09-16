create or replace function public.capture_ai_edit_learning_candidate()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.event_type='ai_modified' and new.organization_id is not null then
    insert into public.learning_candidates(
      organization_id,scope,title,pattern_summary,supporting_event_ids,confidence,status
    ) values (
      new.organization_id,
      'organization',
      'Estimator corrected AI estimate line',
      concat(
        'AI originally suggested: ',coalesce(new.before_data->>'description','(no description)'),
        ' | hours=',coalesce(new.before_data->>'labour_hours','0'),
        ' | rate=',coalesce(new.before_data->>'labour_rate','0'),
        '. Estimator changed it to: ',coalesce(new.after_data->>'description','(no description)'),
        ' | hours=',coalesce(new.after_data->>'labour_hours','0'),
        ' | rate=',coalesce(new.after_data->>'labour_rate','0'),
        '. Review this correction before teaching the global estimator.'
      ),
      array[new.id],
      0.60,
      'pending'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_ai_edit_learning_candidate on public.learning_events;
create trigger trg_capture_ai_edit_learning_candidate
after insert on public.learning_events
for each row execute function public.capture_ai_edit_learning_candidate();
