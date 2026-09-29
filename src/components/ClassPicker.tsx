import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExams, useGradeLevels, useStreams } from "@/lib/queries";

export type ClassPick = { examId: string; gradeId: string; streamId: string };

/** Exam + grade + stream selectors. streamId "all" means every stream in the grade. */
export function ClassPicker({
  value,
  onChange,
  allowAllStreams = true,
  gradeFilter,
}: {
  value: ClassPick;
  onChange: (v: ClassPick) => void;
  allowAllStreams?: boolean;
  gradeFilter?: (gradeId: string) => boolean;
}) {
  const exams = useExams();
  const grades = useGradeLevels();
  const streams = useStreams();
  const gradeList = (grades.data ?? []).filter((g) => !gradeFilter || gradeFilter(g.id));
  const gradeStreams = (streams.data ?? []).filter((s) => s.grade_level_id === value.gradeId);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label>Exam</Label>
        <Select value={value.examId} onValueChange={(examId) => onChange({ ...value, examId })}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select exam" />
          </SelectTrigger>
          <SelectContent>
            {exams.data?.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} · {e.term} {e.year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Grade</Label>
        <Select
          value={value.gradeId}
          onValueChange={(gradeId) => onChange({ ...value, gradeId, streamId: allowAllStreams ? "all" : "" })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select grade" />
          </SelectTrigger>
          <SelectContent>
            {gradeList.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Class</Label>
        <Select value={value.streamId} onValueChange={(streamId) => onChange({ ...value, streamId })}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {allowAllStreams && <SelectItem value="all">All classes</SelectItem>}
            {gradeStreams.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
