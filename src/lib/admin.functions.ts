import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createTeacherSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  homeGradeLevelId: z.string().uuid().nullable().optional(),
  homeStreamId: z.string().uuid().nullable().optional(),
});

/**
 * Creates a confirmed login for a teacher and the matching teacher record.
 * Only admins may call this; the caller's role is verified server-side.
 */
export const createTeacherAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createTeacherSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify your permissions");
    if (!isAdmin) throw new Error("Only administrators can create teacher accounts");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.toLowerCase();
    let userId: string | null = null;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (created?.user) {
      userId = created.user.id;
    } else if (createError && /already been registered|already exists/i.test(createError.message)) {
      // Reuse the existing login: find it, reset password and confirm it.
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listError) throw new Error("Could not look up the existing login");
        const match = list.users.find((u) => u.email?.toLowerCase() === email);
        if (match) userId = match.id;
        if (list.users.length < 200) break;
      }
      if (!userId) throw new Error("This email is already registered but could not be found");
      const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (updError) throw new Error(updError.message);
    } else {
      throw new Error(createError?.message ?? "Could not create the teacher login");
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName, email });

    const teacherFields = {
      profile_id: userId,
      full_name: data.fullName,
      email,
      phone: data.phone || null,
      home_grade_level_id: data.homeGradeLevelId ?? null,
      home_stream_id: data.homeStreamId ?? null,
    };

    const { data: existing } = await supabaseAdmin
      .from("teachers")
      .select("id")
      .or(`profile_id.eq.${userId},email.ilike.${email}`)
      .limit(1)
      .maybeSingle();

    const { data: teacher, error: teacherError } = existing
      ? await supabaseAdmin
          .from("teachers")
          .update(teacherFields)
          .eq("id", existing.id)
          .select("id")
          .single()
      : await supabaseAdmin.from("teachers").insert(teacherFields).select("id").single();
    if (teacherError) throw new Error(teacherError.message);

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "teacher" }, { onConflict: "user_id,role" });

    return { teacherId: teacher.id, userId };
  });

const deleteTeacherSchema = z.object({ teacherId: z.string().uuid() });

export const deleteTeacherAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteTeacherSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only administrators can remove teachers");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: teacher } = await supabaseAdmin
      .from("teachers")
      .select("profile_id")
      .eq("id", data.teacherId)
      .maybeSingle();

    await supabaseAdmin.from("teachers").delete().eq("id", data.teacherId);
    if (teacher?.profile_id) {
      await supabaseAdmin.auth.admin.deleteUser(teacher.profile_id);
    }
    return { ok: true };
  });
