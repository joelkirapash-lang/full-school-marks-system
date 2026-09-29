import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export type Membership = {
  userId: string;
  isAdmin: boolean;
  isTeacher: boolean;
  fullName: string;
  email: string | null;
  teacher: {
    id: string;
    full_name: string;
    home_grade_level_id: string | null;
    home_stream_id: string | null;
  } | null;
};

export function useMembership() {
  const { user, loading } = useCurrentUser();

  const query = useQuery({
    queryKey: ["membership", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Membership> => {
      const [rolesRes, profileRes, teacherRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("profiles").select("full_name, email").eq("id", user!.id).maybeSingle(),
        supabase
          .from("teachers")
          .select("id, full_name, home_grade_level_id, home_stream_id")
          .eq("profile_id", user!.id)
          .maybeSingle(),
      ]);
      const roles = (rolesRes.data ?? []).map((r) => r.role);
      return {
        userId: user!.id,
        isAdmin: roles.includes("admin"),
        isTeacher: roles.includes("teacher"),
        fullName: profileRes.data?.full_name || user!.email || "",
        email: profileRes.data?.email ?? user!.email ?? null,
        teacher: teacherRes.data ?? null,
      };
    },
  });

  return { membership: query.data ?? null, loading: loading || query.isLoading, user };
}

export async function logActivity(action: string, entity: string, details?: unknown) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();
  await supabase.from("activity_log").insert({
    user_id: data.user.id,
    actor_name: profile?.full_name || data.user.email || "Unknown",
    action,
    entity,
    details: (details ?? null) as never,
  });
}
