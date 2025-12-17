import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileDown, Printer, Users } from "lucide-react";
import FlemingLogo from "@/components/FlemingLogo";
import { ACAFE_SUBJECTS, getSubjectLabel, getSubjectColor } from "@/lib/acafe-subjects";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Correction {
  id: string;
  student_name: string;
  student_id: string | null;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  template_id: string;
  created_at: string;
}

interface StudentAnswer {
  question_number: number;
  student_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  points_earned: number | null;
}

interface TemplateQuestion {
  question_number: number;
  correct_answer: string;
  points: number;
  subject: string | null;
}

interface Template {
  id: string;
  name: string;
  exam_type: string;
  total_questions: number;
}

interface SubjectStats {
  subject: string;
  label: string;
  correct: number;
  total: number;
  percentage: number;
  color: string;
}

interface ClassStats {
  subject: string;
  label: string;
  studentPercentage: number;
  classAverage: number;
  color: string;
}

const BoletimAcafe = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [selectedCorrection, setSelectedCorrection] = useState<string>("");
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [templateQuestions, setTemplateQuestions] = useState<TemplateQuestion[]>([]);
  const [allCorrections, setAllCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuth();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadCorrections();
      loadTemplateQuestions();
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if (selectedCorrection) {
      loadStudentAnswers();
    }
  }, [selectedCorrection]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("exam_type", "ACAFE")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar templates", variant: "destructive" });
      return;
    }
    setTemplates(data || []);
  };

  const loadCorrections = async () => {
    const { data, error } = await supabase
      .from("corrections")
      .select("*")
      .eq("template_id", selectedTemplate)
      .eq("status", "completed")
      .order("student_name");

    if (error) {
      toast({ title: "Erro ao carregar correções", variant: "destructive" });
      return;
    }
    setCorrections(data || []);
    setAllCorrections(data || []);
  };

  const loadTemplateQuestions = async () => {
    const { data, error } = await supabase
      .from("template_questions")
      .select("*")
      .eq("template_id", selectedTemplate)
      .order("question_number");

    if (error) {
      toast({ title: "Erro ao carregar questões", variant: "destructive" });
      return;
    }
    setTemplateQuestions(data || []);
  };

  const loadStudentAnswers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_answers")
      .select("*")
      .eq("correction_id", selectedCorrection)
      .order("question_number");

    if (error) {
      toast({ title: "Erro ao carregar respostas", variant: "destructive" });
    }
    setStudentAnswers(data || []);
    setLoading(false);
  };

  const calculateSubjectStats = (): SubjectStats[] => {
    const stats: Record<string, { correct: number; total: number }> = {};

    studentAnswers.forEach((answer) => {
      const question = templateQuestions.find(q => q.question_number === answer.question_number);
      const subject = question?.subject || "sem_disciplina";

      if (!stats[subject]) {
        stats[subject] = { correct: 0, total: 0 };
      }
      stats[subject].total++;
      if (answer.is_correct) {
        stats[subject].correct++;
      }
    });

    return Object.entries(stats)
      .filter(([subject]) => subject !== "sem_disciplina")
      .map(([subject, data]) => ({
        subject,
        label: getSubjectLabel(subject),
        correct: data.correct,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        color: getSubjectColor(subject),
      }));
  };

  const calculateClassComparison = (): ClassStats[] => {
    const subjectStats = calculateSubjectStats();
    
    // Calculate class average per subject
    const classAverages: Record<string, { sum: number; count: number }> = {};

    allCorrections.forEach(async (correction) => {
      // This is simplified - in production, we'd fetch all answers
      // For now, we'll show student vs overall average
    });

    // Use overall class average as approximation
    const classAvg = allCorrections.reduce((sum, c) => sum + (c.percentage || 0), 0) / (allCorrections.length || 1);

    return subjectStats.map(stat => ({
      subject: stat.subject,
      label: stat.label,
      studentPercentage: stat.percentage,
      classAverage: Math.round(classAvg),
      color: stat.color,
    }));
  };

  const getWrongQuestions = (): { question: number; subject: string; studentAnswer: string; correctAnswer: string }[] => {
    return studentAnswers
      .filter(a => !a.is_correct)
      .map(a => {
        const question = templateQuestions.find(q => q.question_number === a.question_number);
        return {
          question: a.question_number,
          subject: getSubjectLabel(question?.subject || ""),
          studentAnswer: a.student_answer || "-",
          correctAnswer: a.correct_answer,
        };
      });
  };

  const calculateRanking = (): number => {
    if (!selectedCorrection || allCorrections.length === 0) return 0;
    const currentCorrection = allCorrections.find(c => c.id === selectedCorrection);
    if (!currentCorrection) return 0;

    const sorted = [...allCorrections].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    return sorted.findIndex(c => c.id === selectedCorrection) + 1;
  };

  const selectedStudent = corrections.find(c => c.id === selectedCorrection);
  const subjectStats = calculateSubjectStats();
  const classComparison = calculateClassComparison();
  const wrongQuestions = getWrongQuestions();
  const ranking = calculateRanking();

  const generatePDF = () => {
    if (!selectedStudent) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header with Fleming green
    doc.setFillColor(22, 163, 74); // Fleming green
    doc.rect(0, 0, pageWidth, 40, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("BOLETIM DE DESEMPENHO - ACAFE", pageWidth / 2, 18, { align: "center" });
    doc.setFontSize(12);
    doc.text("Fleming Medicina", pageWidth / 2, 28, { align: "center" });

    // Student info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`Aluno: ${selectedStudent.student_name}`, 14, 55);
    doc.setFontSize(11);
    doc.text(`Matrícula: ${selectedStudent.student_id || "-"}`, 14, 63);
    doc.text(`Data: ${new Date(selectedStudent.created_at).toLocaleDateString("pt-BR")}`, 14, 71);

    // Overall score box
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(pageWidth - 70, 48, 56, 30, 3, 3, "F");
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74);
    doc.text("NOTA GERAL", pageWidth - 42, 56, { align: "center" });
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(`${selectedStudent.percentage?.toFixed(1)}%`, pageWidth - 42, 72, { align: "center" });
    doc.setFont("helvetica", "normal");

    // Ranking
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`Ranking na turma: ${ranking}º de ${allCorrections.length} alunos`, 14, 85);

    // Subject performance table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Desempenho por Disciplina", 14, 100);
    doc.setFont("helvetica", "normal");

    const tableData = subjectStats.map(stat => [
      stat.label,
      `${stat.correct}/${stat.total}`,
      `${stat.percentage}%`,
    ]);

    (doc as any).autoTable({
      startY: 105,
      head: [["Disciplina", "Acertos", "Aproveitamento"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [22, 163, 74] },
      margin: { left: 14, right: 14 },
    });

    // Wrong questions
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Questões a Revisar", 14, finalY);
    doc.setFont("helvetica", "normal");

    const wrongData = wrongQuestions.slice(0, 15).map(q => [
      `Q${q.question}`,
      q.subject,
      q.studentAnswer,
      q.correctAnswer,
    ]);

    (doc as any).autoTable({
      startY: finalY + 5,
      head: [["Questão", "Disciplina", "Sua Resposta", "Gabarito"]],
      body: wrongData,
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38] },
      margin: { left: 14, right: 14 },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text("Fleming Medicina - Sistema de Correção de Provas", pageWidth / 2, pageHeight - 10, { align: "center" });

    doc.save(`boletim_${selectedStudent.student_name.replace(/\s+/g, "_")}_ACAFE.pdf`);

    toast({ title: "PDF gerado com sucesso!" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/boletins")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <FlemingLogo size="sm" />
            <h1 className="text-xl font-bold">Boletim de Desempenho ACAFE</h1>
          </div>
          {selectedStudent && (
            <Button onClick={generatePDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Gerar PDF
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Seleção */}
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Aluno</CardTitle>
              <CardDescription>Escolha o template e o aluno para gerar o boletim</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template ACAFE</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.total_questions} questões)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Aluno</label>
                <Select value={selectedCorrection} onValueChange={setSelectedCorrection} disabled={!selectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {corrections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.student_name} - {c.percentage?.toFixed(1)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {templates.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum template ACAFE encontrado. Crie um template com tipo "ACAFE" primeiro.
                </p>
                <Button onClick={() => navigate("/templates")}>Criar Template</Button>
              </CardContent>
            </Card>
          )}

          {selectedStudent && !loading && (
            <>
              {/* Resumo */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Nota Geral</p>
                      <p className="text-4xl font-bold text-primary">{selectedStudent.percentage?.toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Acertos</p>
                      <p className="text-3xl font-bold">
                        {studentAnswers.filter(a => a.is_correct).length}/{studentAnswers.length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Ranking</p>
                      <p className="text-3xl font-bold">{ranking}º <span className="text-sm font-normal text-muted-foreground">de {allCorrections.length}</span></p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Erros</p>
                      <p className="text-3xl font-bold text-destructive">{wrongQuestions.length}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico comparativo */}
              <Card>
                <CardHeader>
                  <CardTitle>Desempenho por Disciplina vs Turma</CardTitle>
                  <CardDescription>Comparação do seu desempenho com a média da turma</CardDescription>
                </CardHeader>
                <CardContent>
                  {subjectStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={classComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value: number) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="studentPercentage" name="Seu desempenho" fill="#16a34a" />
                        <Bar dataKey="classAverage" name="Média da turma" fill="#94a3b8" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Defina as disciplinas das questões no template para ver o gráfico.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Tabela de disciplinas */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento por Disciplina</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Disciplina</TableHead>
                        <TableHead className="text-center">Acertos</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Aproveitamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectStats.map((stat) => (
                        <TableRow key={stat.subject}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stat.color }}
                              />
                              {stat.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{stat.correct}</TableCell>
                          <TableCell className="text-center">{stat.total}</TableCell>
                          <TableCell className="text-center font-medium">{stat.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Questões erradas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Questões para Revisar</CardTitle>
                  <CardDescription>Lista de questões que o aluno errou</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Questão</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead>Sua Resposta</TableHead>
                        <TableHead>Gabarito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wrongQuestions.map((q) => (
                        <TableRow key={q.question}>
                          <TableCell className="font-medium">Q{q.question}</TableCell>
                          <TableCell>{q.subject || "-"}</TableCell>
                          <TableCell className="text-destructive font-medium">{q.studentAnswer}</TableCell>
                          <TableCell className="text-primary font-medium">{q.correctAnswer}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default BoletimAcafe;
