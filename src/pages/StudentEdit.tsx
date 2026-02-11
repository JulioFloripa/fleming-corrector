import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FlemingLogo from "@/components/FlemingLogo";
import StudentSearch from "@/components/student/StudentSearch";
import StudentExamsList from "@/components/student/StudentExamsList";
import ExamAnswersEditor from "@/components/student/ExamAnswersEditor";

interface StudentExam {
  id: string;
  student_name: string;
  student_id: string | null;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  created_at: string | null;
  templates: {
    id: string;
    name: string;
    exam_type: string;
    total_questions: number;
  } | null;
}

interface StudentAnswer {
  id: string;
  question_number: number;
  student_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  points_earned: number | null;
  points: number;
}

const StudentEdit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [studentExams, setStudentExams] = useState<StudentExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<StudentExam | null>(null);
  const [examAnswers, setExamAnswers] = useState<StudentAnswer[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState<string>("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSearch = async (studentId: string) => {
    setLoading(true);
    setCurrentStudentId(studentId);
    setSelectedExam(null);
    setExamAnswers([]);

    try {
      const { data, error } = await supabase
        .from("corrections")
        .select(`
          id,
          student_name,
          student_id,
          total_score,
          max_score,
          percentage,
          created_at,
          templates (
            id,
            name,
            exam_type,
            total_questions
          )
        `)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Aluno não encontrado",
          description: `Nenhuma prova encontrada para a matrícula ${studentId}`,
          variant: "destructive",
        });
        setStudentExams([]);
      } else {
        setStudentExams(data as StudentExam[]);
        toast({
          title: "Aluno encontrado!",
          description: `${data.length} prova(s) encontrada(s)`,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar aluno:", error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar os dados do aluno",
        variant: "destructive",
      });
      setStudentExams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditExam = async (examId: string) => {
    setLoading(true);
    const exam = studentExams.find((e) => e.id === examId);
    if (!exam) return;

    try {
      // Buscar respostas do aluno
      const { data: answersData, error: answersError } = await supabase
        .from("student_answers")
        .select("id, question_number, student_answer, correct_answer, is_correct, points_earned")
        .eq("correction_id", examId)
        .order("question_number", { ascending: true });

      if (answersError) throw answersError;

      // Buscar pontuação de cada questão do template
      const { data: questionsData, error: questionsError } = await supabase
        .from("template_questions")
        .select("question_number, points")
        .eq("template_id", exam.templates?.id)
        .order("question_number", { ascending: true });

      if (questionsError) throw questionsError;

      // Combinar dados
      const pointsMap = new Map(
        questionsData?.map((q) => [q.question_number, q.points]) || []
      );

      const answersWithPoints: StudentAnswer[] = (answersData || []).map((a) => ({
        ...a,
        points: pointsMap.get(a.question_number) || 0,
      }));

      setSelectedExam(exam);
      setExamAnswers(answersWithPoints);
    } catch (error) {
      console.error("Erro ao carregar respostas:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar as respostas da prova",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedExam(null);
    setExamAnswers([]);
  };

  const handleSaveSuccess = () => {
    // Recarregar lista de provas para atualizar notas
    if (currentStudentId) {
      handleSearch(currentStudentId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FlemingLogo size="sm" />
          <h1 className="text-xl font-bold">Editar Respostas de Alunos</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {!selectedExam && (
            <>
              <StudentSearch onSearch={handleSearch} loading={loading} />
              
              {studentExams.length > 0 && (
                <StudentExamsList
                  exams={studentExams}
                  studentName={studentExams[0].student_name}
                  studentId={studentExams[0].student_id || ""}
                  onEditExam={handleEditExam}
                />
              )}
            </>
          )}

          {selectedExam && examAnswers.length > 0 && (
            <ExamAnswersEditor
              correctionId={selectedExam.id}
              examName={selectedExam.templates?.name || "Prova"}
              studentName={selectedExam.student_name}
              answers={examAnswers}
              onBack={handleBackToList}
              onSaveSuccess={handleSaveSuccess}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentEdit;
