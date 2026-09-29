import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGradeLevels() {
  return useQuery({
    queryKey: ["grade_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grade_levels")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useStreams() {
  return useQuery({
    queryKey: ["streams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("streams").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useGradingBands() {
  return useQuery({
    queryKey: ["grading_bands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grading_bands")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teachers").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useTeacherAssignments() {
  return useQuery({
    queryKey: ["teacher_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teacher_assignments").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useLearners() {
  return useQuery({
    queryKey: ["learners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("*")
        .order("admission_no");
      if (error) throw error;
      return data;
    },
  });
}

export function useExams() {
  return useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("year", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSchoolSettings() {
  return useQuery({
    queryKey: ["school_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMarksCount() {
  return useQuery({
    queryKey: ["marks_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("marks")
        .select("id", { count: "exact", head: true })
        .not("score", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
