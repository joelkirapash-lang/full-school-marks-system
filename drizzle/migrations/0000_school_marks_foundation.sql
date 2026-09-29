-- Roles
create type public.app_role as enum ('admin', 'teacher');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

-- Curriculum
create table public.grade_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.streams (
  id uuid primary key default gen_random_uuid(),
  grade_level_id uuid not null references public.grade_levels(id) on delete cascade,
  name text not null,
  class_teacher_id uuid,
  created_at timestamptz not null default now(),
  unique (grade_level_id, name)
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  grade_level_id uuid not null references public.grade_levels(id) on delete cascade,
  name text not null,
  short_name text,
  max_score int not null default 100,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (grade_level_id, name)
);
create table public.grading_bands (
  id uuid primary key default gen_random_uuid(),
  level_code text not null unique,
  label text not null default '',
  min_score numeric not null,
  max_score numeric not null,
  sort_order int not null default 0
);

-- Teachers
create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text unique,
  phone text,
  home_grade_level_id uuid references public.grade_levels(id) on delete set null,
  home_stream_id uuid references public.streams(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.streams
  add constraint streams_class_teacher_fk
  foreign key (class_teacher_id) references public.teachers(id) on delete set null;

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  grade_level_id uuid not null references public.grade_levels(id) on delete cascade,
  stream_id uuid references public.streams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, grade_level_id, stream_id, subject_id)
);

-- Learners
create table public.learners (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  upi_number text,
  full_name text not null,
  gender text,
  date_of_birth date,
  grade_level_id uuid references public.grade_levels(id) on delete set null,
  stream_id uuid references public.streams(id) on delete set null,
  guardian_name text,
  guardian_phone text,
  guardian_email text,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Exams
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  term text not null default 'Term 1',
  year int not null,
  start_date date,
  end_date date,
  submission_deadline date,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Marks
create table public.marks (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  grade_level_id uuid not null references public.grade_levels(id) on delete cascade,
  stream_id uuid references public.streams(id) on delete set null,
  score numeric,
  remarks text,
  entered_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (learner_id, exam_id, subject_id)
);

-- Settings, remarks bank, activity log
create table public.school_settings (
  id boolean primary key default true,
  school_name text not null default 'Sikinter Primary and Junior School',
  motto text default '',
  address text default '',
  phone text default '',
  email text default '',
  logo_url text,
  next_term_begins date,
  report_footer_text text default '',
  allow_parent_links boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint school_settings_singleton check (id)
);

create table public.remark_templates (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action text not null,
  entity text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Grants
grant select, insert, update, delete on public.grade_levels to authenticated;
grant select, insert, update, delete on public.streams to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.grading_bands to authenticated;
grant select, insert, update, delete on public.teachers to authenticated;
grant select, insert, update, delete on public.teacher_assignments to authenticated;
grant select, insert, update, delete on public.learners to authenticated;
grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.marks to authenticated;
grant select, insert, update, delete on public.school_settings to authenticated;
grant select, insert, update, delete on public.remark_templates to authenticated;
grant select, insert on public.activity_log to authenticated;
grant all on public.grade_levels, public.streams, public.subjects, public.grading_bands,
  public.teachers, public.teacher_assignments, public.learners, public.exams, public.marks,
  public.school_settings, public.remark_templates, public.activity_log to service_role;

alter table public.grade_levels enable row level security;
alter table public.streams enable row level security;
alter table public.subjects enable row level security;
alter table public.grading_bands enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.learners enable row level security;
alter table public.exams enable row level security;
alter table public.marks enable row level security;
alter table public.school_settings enable row level security;
alter table public.remark_templates enable row level security;
alter table public.activity_log enable row level security;

-- Profiles / roles policies
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Reference data: all authenticated read, admin write
create policy "read grades" on public.grade_levels for select to authenticated using (true);
create policy "admin write grades" on public.grade_levels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read streams" on public.streams for select to authenticated using (true);
create policy "admin write streams" on public.streams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read subjects" on public.subjects for select to authenticated using (true);
create policy "admin write subjects" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read bands" on public.grading_bands for select to authenticated using (true);
create policy "admin write bands" on public.grading_bands for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read teachers" on public.teachers for select to authenticated using (true);
create policy "admin write teachers" on public.teachers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read assignments" on public.teacher_assignments for select to authenticated using (true);
create policy "admin write assignments" on public.teacher_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read learners" on public.learners for select to authenticated using (true);
create policy "admin write learners" on public.learners for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read exams" on public.exams for select to authenticated using (true);
create policy "admin write exams" on public.exams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read settings" on public.school_settings for select to authenticated using (true);
create policy "admin write settings" on public.school_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read remarks" on public.remark_templates for select to authenticated using (true);
create policy "write remarks" on public.remark_templates for insert to authenticated with check (auth.uid() is not null);
create policy "admin manage remarks" on public.remark_templates for delete to authenticated using (public.is_admin() or created_by = auth.uid());
create policy "read log" on public.activity_log for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy "insert log" on public.activity_log for insert to authenticated with check (auth.uid() is not null);

-- Marks permission function
create or replace function public.can_edit_marks(_grade_level_id uuid, _stream_id uuid, _subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or exists (
    select 1
    from public.teacher_assignments ta
    join public.teachers t on t.id = ta.teacher_id
    where t.profile_id = auth.uid()
      and ta.grade_level_id = _grade_level_id
      and ta.subject_id = _subject_id
      and (ta.stream_id is null or ta.stream_id = _stream_id)
  )
$$;

create policy "read marks" on public.marks for select to authenticated using (true);
create policy "insert marks" on public.marks for insert to authenticated
  with check (public.can_edit_marks(grade_level_id, stream_id, subject_id));
create policy "update marks" on public.marks for update to authenticated
  using (public.can_edit_marks(grade_level_id, stream_id, subject_id))
  with check (public.can_edit_marks(grade_level_id, stream_id, subject_id));
create policy "delete marks" on public.marks for delete to authenticated
  using (public.can_edit_marks(grade_level_id, stream_id, subject_id));

-- New user handling: link teacher records, grant roles
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _teacher_id uuid;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;

  if lower(new.email) = 'jameskirapash504@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;

  select id into _teacher_id from public.teachers where lower(email) = lower(new.email) limit 1;
  if _teacher_id is not null then
    update public.teachers set profile_id = new.id where id = _teacher_id;
    insert into public.user_roles (user_id, role) values (new.id, 'teacher')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Default grading bands (CBC performance levels)
insert into public.grading_bands (level_code, label, min_score, max_score, sort_order) values
  ('BE1', 'Below Expectation 1', 0, 19, 1),
  ('BE2', 'Below Expectation 2', 20, 39, 2),
  ('AE1', 'Approaching Expectation 1', 40, 49, 3),
  ('AE2', 'Approaching Expectation 2', 50, 59, 4),
  ('ME1', 'Meeting Expectation 1', 60, 69, 5),
  ('ME2', 'Meeting Expectation 2', 70, 79, 6),
  ('EE1', 'Exceeding Expectation 1', 80, 89, 7),
  ('EE2', 'Exceeding Expectation 2', 90, 100, 8);

insert into public.school_settings (id) values (true) on conflict do nothing;
