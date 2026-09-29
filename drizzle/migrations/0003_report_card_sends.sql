CREATE TABLE public.report_card_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  status text NOT NULL,
  recipient text,
  error text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_card_sends_lookup ON public.report_card_sends (exam_id, learner_id, sent_at DESC);
GRANT SELECT ON public.report_card_sends TO authenticated;
GRANT ALL ON public.report_card_sends TO service_role;
ALTER TABLE public.report_card_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sends" ON public.report_card_sends FOR SELECT TO authenticated USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.can_send_report(_learner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_role(auth.uid(), 'admin') or exists (
    select 1 from public.learners l
    join public.streams s on s.id = l.stream_id
    join public.teachers t on t.id = s.class_teacher_id
    where l.id = _learner_id and t.profile_id = auth.uid()
  )
$$;