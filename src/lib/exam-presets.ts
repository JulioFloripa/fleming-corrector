export interface SubjectBlock {
  subject: string;
  count: number;
}

export interface ExamPreset {
  totalQuestions: number;
  alternatives: string[]; // e.g. ["A","B","C","D"] for ACAFE
  subjects: SubjectBlock[];
}

export const EXAM_PRESETS: Record<string, ExamPreset> = {
  acafe: {
    totalQuestions: 63,
    alternatives: ["A", "B", "C", "D"],
    subjects: [
      { subject: "Português", count: 14 },
      { subject: "Língua Estrangeira", count: 7 },
      { subject: "Matemática", count: 7 },
      { subject: "Física", count: 7 },
      { subject: "Química", count: 7 },
      { subject: "Biologia", count: 7 },
      { subject: "História", count: 7 },
      { subject: "Geografia", count: 7 },
    ],
  },
  enem: {
    totalQuestions: 180,
    alternatives: ["A", "B", "C", "D", "E"],
    subjects: [
      { subject: "Linguagens", count: 45 },
      { subject: "Ciências Humanas", count: 45 },
      { subject: "Ciências da Natureza", count: 45 },
      { subject: "Matemática", count: 45 },
    ],
  },
};

/**
 * Generate pre-populated questions array from an exam preset.
 */
export function generatePresetQuestions(preset: ExamPreset) {
  const questions: { question_number: number; correct_answer: string; points: number; subject: string | null; topic: string | null; language_variant: string | null }[] = [];
  let questionNum = 1;

  for (const block of preset.subjects) {
    const isForeignLanguage = block.subject === "Língua Estrangeira";
    for (let i = 0; i < block.count; i++) {
      if (isForeignLanguage) {
        // Generate two rows per question: one for each language variant
        questions.push({
          question_number: questionNum,
          correct_answer: "A",
          points: 1,
          subject: "Língua Estrangeira",
          topic: null,
          language_variant: "Inglês",
        });
        questions.push({
          question_number: questionNum,
          correct_answer: "A",
          points: 1,
          subject: "Língua Estrangeira",
          topic: null,
          language_variant: "Espanhol",
        });
      } else {
        questions.push({
          question_number: questionNum,
          correct_answer: "A",
          points: 1,
          subject: block.subject,
          topic: null,
          language_variant: null,
        });
      }
      questionNum++;
    }
  }

  return questions;
}
