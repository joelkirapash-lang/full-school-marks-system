ALTER TABLE public.learners ADD COLUMN IF NOT EXISTS assessment_no text;

CREATE OR REPLACE FUNCTION public.can_edit_marks(_grade_level_id uuid, _stream_id uuid, _subject_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_role(auth.uid(), 'admin')
  or exists (
    select 1
    from public.teacher_assignments ta
    join public.teachers t on t.id = ta.teacher_id
    where t.profile_id = auth.uid()
      and ta.grade_level_id = _grade_level_id
      and ta.subject_id = _subject_id
      and (ta.stream_id is null or ta.stream_id = _stream_id)
  )
  or exists (
    select 1
    from public.streams s
    join public.teachers t on t.id = s.class_teacher_id
    join public.subjects sub on sub.id = _subject_id and sub.grade_level_id = s.grade_level_id
    where t.profile_id = auth.uid()
      and s.id = _stream_id
      and s.grade_level_id = _grade_level_id
  )
$function$;