export const ACAFE_SUBJECTS = [
  { value: "portugues", label: "Português" },
  { value: "matematica", label: "Matemática" },
  { value: "historia", label: "História" },
  { value: "geografia", label: "Geografia" },
  { value: "fisica", label: "Física" },
  { value: "quimica", label: "Química" },
  { value: "biologia", label: "Biologia" },
  { value: "ingles", label: "Inglês" },
] as const;

export type AcafeSubject = typeof ACAFE_SUBJECTS[number]["value"];

export const getSubjectLabel = (value: string): string => {
  const subject = ACAFE_SUBJECTS.find(s => s.value === value);
  return subject?.label || value;
};

export const getSubjectColor = (value: string): string => {
  const colors: Record<string, string> = {
    portugues: "#16a34a",
    matematica: "#2563eb",
    historia: "#dc2626",
    geografia: "#ea580c",
    fisica: "#7c3aed",
    quimica: "#0891b2",
    biologia: "#65a30d",
    ingles: "#c026d3",
  };
  return colors[value] || "#6b7280";
};
