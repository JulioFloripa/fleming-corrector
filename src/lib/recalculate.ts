import { supabase } from "@/integrations/supabase/client";

export async function recalculateByTemplate(templateId: string): Promise<{ success: boolean; correctionsUpdated: number; error?: string }> {
  // 1. Fetch updated template questions
  const { data: questions, error: qError } = await supabase
    .from("template_questions")
    .select("*")
    .eq("template_id", templateId);

  if (qError || !questions) {
    return { success: false, correctionsUpdated: 0, error: qError?.message || "Erro ao buscar questões do gabarito" };
  }

  // 2. Fetch all corrections for this template
  const { data: corrections, error: cError } = await supabase
    .from("corrections")
    .select("id")
    .eq("template_id", templateId);

  if (cError || !corrections) {
    return { success: false, correctionsUpdated: 0, error: cError?.message || "Erro ao buscar correções" };
  }

  if (corrections.length === 0) {
    return { success: true, correctionsUpdated: 0 };
  }

  // Build a map of question_number -> question for quick lookup
  const questionMap = new Map(questions.map(q => [q.question_number, q]));

  let correctionsUpdated = 0;

  for (const correction of corrections) {
    // 3. Fetch student answers for this correction
    const { data: answers, error: aError } = await supabase
      .from("student_answers")
      .select("*")
      .eq("correction_id", correction.id);

    if (aError || !answers) continue;

    let totalScore = 0;
    let maxScore = 0;

    for (const answer of answers) {
      const question = questionMap.get(answer.question_number);
      if (!question) continue;

      const isCorrect = answer.student_answer?.toUpperCase() === question.correct_answer.toUpperCase();
      const pointsEarned = isCorrect ? (question.points ?? 1) : 0;
      maxScore += question.points ?? 1;
      totalScore += pointsEarned;

      // Update student_answer record
      await supabase
        .from("student_answers")
        .update({
          correct_answer: question.correct_answer,
          is_correct: isCorrect,
          points_earned: pointsEarned,
        })
        .eq("id", answer.id);
    }

    // Update correction totals
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    await supabase
      .from("corrections")
      .update({
        total_score: totalScore,
        max_score: maxScore,
        percentage,
      })
      .eq("id", correction.id);

    correctionsUpdated++;
  }

  return { success: true, correctionsUpdated };
}
