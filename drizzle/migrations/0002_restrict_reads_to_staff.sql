create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','teacher'))
$$;

drop policy if exists "read exams" on public.exams;
create policy "read exams" on public.exams for select to authenticated using (public.is_staff());
drop policy if exists "read grades" on public.grade_levels;
create policy "read grades" on public.grade_levels for select to authenticated using (public.is_staff());
drop policy if exists "read bands" on public.grading_bands;
create policy "read bands" on public.grading_bands for select to authenticated using (public.is_staff());
drop policy if exists "read learners" on public.learners;
create policy "read learners" on public.learners for select to authenticated using (public.is_staff());
drop policy if exists "read marks" on public.marks;
create policy "read marks" on public.marks for select to authenticated using (public.is_staff());
drop policy if exists "read settings" on public.school_settings;
create policy "read settings" on public.school_settings for select to authenticated using (public.is_staff());
drop policy if exists "read streams" on public.streams;
create policy "read streams" on public.streams for select to authenticated using (public.is_staff());
drop policy if exists "read subjects" on public.subjects;
create policy "read subjects" on public.subjects for select to authenticated using (public.is_staff());
drop policy if exists "read assignments" on public.teacher_assignments;
create policy "read assignments" on public.teacher_assignments for select to authenticated using (public.is_staff());
drop policy if exists "read teachers" on public.teachers;
create policy "read teachers" on public.teachers for select to authenticated using (public.is_staff());
drop policy if exists "read remarks" on public.remark_templates;
create policy "read remarks" on public.remark_templates for select to authenticated using (public.is_staff());

drop policy if exists "write remarks" on public.remark_templates;
create policy "write remarks" on public.remark_templates for insert to authenticated
  with check (created_by = auth.uid() and public.is_staff());
drop policy if exists "insert log" on public.activity_log;
create policy "insert log" on public.activity_log for insert to authenticated
  with check (user_id = auth.uid());