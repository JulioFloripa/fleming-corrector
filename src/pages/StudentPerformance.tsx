import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FlemingLogo from "@/components/FlemingLogo";
import StudentSearch from "@/components/student/StudentSearch";
import PerformanceOverview from "@/components/student/PerformanceOverview";
import PerformanceChart from "@/components/student/PerformanceChart";
import ExamsDetailTable from "@/components/student/ExamsDetailTable";
import {
  calculatePerformanceStats,
  prepareChartData,
  prepareTableData,
} from "@/lib/performance-stats";

interface StudentExam {
  id: string;
  student_name: string;
  student_id: string | null;
  total_score: number | null;
  max_score: number | null;
  percentage: number;
  created_at: string;
  templates: {
    id: string;
    name: string;
    exam_type: string;
    total_questions: number;
  } | null;
}

const StudentPerformance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [studentExams, setStudentExams] = useState<StudentExam[]>([]);
  const [studentName, setStudentName] = useState("");

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
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Aluno não encontrado",
          description: `Nenhuma prova encontrada para a matrícula ${studentId}`,
          variant: "destructive",
        });
        setStudentExams([]);
        setStudentName("");
      } else {
        // Filtrar apenas provas com percentual válido
        const validExams = data.filter((e) => e.percentage != null) as StudentExam[];
        
        if (validExams.length === 0) {
          toast({
            title: "Dados insuficientes",
            description: "Não há provas com notas válidas para análise",
            variant: "destructive",
          });
          setStudentExams([]);
          setStudentName("");
        } else {
          setStudentExams(validExams);
          setStudentName(validExams[0].student_name);
          toast({
            title: "Análise carregada!",
            description: `${validExams.length} prova(s) encontrada(s)`,
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar aluno:", error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar os dados do aluno",
        variant: "destructive",
      });
      setStudentExams([]);
      setStudentName("");
    } finally {
      setLoading(false);
    }
  };

  const stats = calculatePerformanceStats(studentExams);
  const chartData = prepareChartData(studentExams);
  const tableData = prepareTableData(studentExams);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FlemingLogo size="sm" />
          <h1 className="text-xl font-bold">Análise de Desempenho</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <StudentSearch onSearch={handleSearch} loading={loading} />

          {studentExams.length > 0 && (
            <>
              <PerformanceOverview stats={stats} studentName={studentName} />

              <div className="grid gap-6 lg:grid-cols-2">
                <PerformanceChart data={chartData} type="bar" />
                <PerformanceChart data={chartData} type="line" />
              </div>

              <ExamsDetailTable exams={tableData} />
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentPerformance;
