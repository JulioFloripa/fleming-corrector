import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileDown, Users, Download } from "lucide-react";
import FlemingLogo from "@/components/FlemingLogo";
import { getSubjectLabel, getSubjectColor } from "@/lib/acafe-subjects";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import jsPDF from "jspdf";
import { buildPDFForStudent, loadLogoBase64 } from "@/lib/pdf-boletim-acafe";

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
  topic: string | null;
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
  studentCorrect: number;
  studentTotal: number;
  classCorrect: number;
  classTotalQuestions: number;
  color: string;
}

interface StudentMeta {
  campus?: string | null;
  foreign_language?: string | null;
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
  const [generatingAll, setGeneratingAll] = useState(false);
  const [studentsMetaMap, setStudentsMetaMap] = useState<Record<string, StudentMeta>>({});

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

  // Load student metadata (campus, foreign_language) for all students in corrections
  useEffect(() => {
    if (allCorrections.length > 0) {
      loadStudentsMeta();
    }
  }, [allCorrections]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
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

  const loadStudentsMeta = async () => {
    const names = [...new Set(allCorrections.map((c) => c.student_name))];
    if (names.length === 0) return;

    const { data } = await supabase
      .from("students")
      .select("name, campus, foreign_language")
      .in("name", names);

    if (data) {
      const map: Record<string, StudentMeta> = {};
      data.forEach((s) => {
        map[s.name] = { campus: s.campus, foreign_language: s.foreign_language };
      });
      setStudentsMetaMap(map);
    }
  };

  const loadAnswersForCorrection = async (correctionId: string): Promise<StudentAnswer[]> => {
    const { data } = await supabase
      .from("student_answers")
      .select("*")
      .eq("correction_id", correctionId)
      .order("question_number");
    return data || [];
  };

  const calculateSubjectStatsFromAnswers = (answers: StudentAnswer[]): SubjectStats[] => {
    const stats: Record<string, { correct: number; total: number }> = {};
    answers.forEach((answer) => {
      const question = templateQuestions.find((q) => q.question_number === answer.question_number);
      const subject = question?.subject || "sem_disciplina";
      if (!stats[subject]) stats[subject] = { correct: 0, total: 0 };
      stats[subject].total++;
      if (answer.is_correct) stats[subject].correct++;
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

  const calculateSubjectStats = (): SubjectStats[] => {
    return calculateSubjectStatsFromAnswers(studentAnswers);
  };

  const calculateClassComparison = (): ClassStats[] => {
    const subjectStats = calculateSubjectStats();
    const classAvg = allCorrections.reduce((sum, c) => sum + (c.percentage || 0), 0) / (allCorrections.length || 1);

    return subjectStats.map((stat) => ({
      subject: stat.subject,
      label: stat.label,
      studentPercentage: stat.percentage,
      classAverage: Math.round(classAvg),
      studentCorrect: stat.correct,
      studentTotal: stat.total,
      classCorrect: Math.round((classAvg / 100) * stat.total),
      classTotalQuestions: stat.total,
      color: stat.color,
    }));
  };

  const getWrongQuestions = () => {
    return studentAnswers
      .filter((a) => !a.is_correct)
      .map((a) => {
        const question = templateQuestions.find((q) => q.question_number === a.question_number);
        return {
          question: a.question_number,
          subject: getSubjectLabel(question?.subject || ""),
          topic: question?.topic || "",
          studentAnswer: a.student_answer || "-",
          correctAnswer: a.correct_answer,
        };
      });
  };

  const calculateRankingFor = (correctionId: string): number => {
    if (allCorrections.length === 0) return 0;
    const sorted = [...allCorrections].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    return sorted.findIndex((c) => c.id === correctionId) + 1;
  };

  const calculateRanking = (): number => {
    if (!selectedCorrection) return 0;
    return calculateRankingFor(selectedCorrection);
  };

  const selectedStudent = corrections.find((c) => c.id === selectedCorrection);
  const subjectStats = calculateSubjectStats();
  const classComparison = calculateClassComparison();
  const wrongQuestions = getWrongQuestions();
  const ranking = calculateRanking();

  const generatePDF = async () => {
    if (!selectedStudent) return;

    const doc = new jsPDF();
    const logoData = await loadLogoBase64();
    const studentRanking = calculateRankingFor(selectedCorrection);

    buildPDFForStudent({
      doc,
      student: selectedStudent,
      answers: studentAnswers,
      templateQuestions,
      allCorrections,
      studentRanking,
      isFirst: true,
      logoData,
      studentMeta: studentsMetaMap[selectedStudent.student_name],
    });

    doc.save(`boletim_${selectedStudent.student_name.replace(/\s+/g, "_")}_ACAFE.pdf`);
    toast({ title: "PDF gerado com sucesso!" });
  };

  const generateAllPDFs = async () => {
    if (allCorrections.length === 0) return;

    setGeneratingAll(true);
    try {
      const doc = new jsPDF();
      const logoData = await loadLogoBase64();
      const sorted = [...allCorrections].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

      for (let i = 0; i < allCorrections.length; i++) {
        const correction = allCorrections[i];
        const answers = await loadAnswersForCorrection(correction.id);
        const studentRanking = sorted.findIndex((c) => c.id === correction.id) + 1;

        buildPDFForStudent({
          doc,
          student: correction,
          answers,
          templateQuestions,
          allCorrections,
          studentRanking,
          isFirst: i === 0,
          logoData,
          studentMeta: studentsMetaMap[correction.student_name],
        });
      }

      doc.save(`boletins_ACAFE_todos.pdf`);
      toast({ title: `PDF gerado com ${allCorrections.length} boletins!` });
    } catch {
      toast({ title: "Erro ao gerar PDFs", variant: "destructive" });
    } finally {
      setGeneratingAll(false);
    }
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
          <div className="flex items-center gap-2">
            {allCorrections.length > 0 && (
              <Button variant="outline" onClick={generateAllPDFs} disabled={generatingAll}>
                <Download className="h-4 w-4 mr-2" />
                {generatingAll ? "Gerando..." : `Gerar Todos (${allCorrections.length})`}
              </Button>
            )}
            {selectedStudent && (
              <Button onClick={generatePDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Gerar PDF
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Seleção */}
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Aluno</CardTitle>
              <CardDescription>
                Escolha o template e o aluno para gerar o boletim, ou gere todos de uma vez
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Escolha um Simulado/Prova:</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o Simulado" />
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
                        {studentAnswers.filter((a) => a.is_correct).length}/{studentAnswers.length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Ranking</p>
                      <p className="text-3xl font-bold">
                        {ranking}º{" "}
                        <span className="text-sm font-normal text-muted-foreground">de {allCorrections.length}</span>
                      </p>
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
                        <Bar dataKey="studentPercentage" name="Seu desempenho" fill="#16a34a">
                          <LabelList
                            formatter={(value: number) => {
                              const item = classComparison.find((c) => c.studentPercentage === value);
                              return item ? `${item.studentCorrect}/${item.studentTotal}` : `${value}%`;
                            }}
                            position="top"
                            style={{ fontSize: 11, fill: "#16a34a", fontWeight: 600 }}
                          />
                        </Bar>
                        <Bar dataKey="classAverage" name="Média da turma" fill="#94a3b8">
                          <LabelList
                            formatter={(value: number) => `${value}%`}
                            position="top"
                            style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                          />
                        </Bar>
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
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
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
                        <TableHead>Conteúdo</TableHead>
                        <TableHead>Sua Resposta</TableHead>
                        <TableHead>Gabarito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wrongQuestions.map((q) => (
                        <TableRow key={q.question}>
                          <TableCell className="font-medium">Q{q.question}</TableCell>
                          <TableCell>{q.subject || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{q.topic || "-"}</TableCell>
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
