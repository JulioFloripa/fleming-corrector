import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import { ACAFE_SUBJECTS } from "@/lib/acafe-subjects";

interface TemplateQuestion {
  id: string;
  question_number: number;
  correct_answer: string;
  points: number;
  subject: string | null;
  topic: string | null;
}

const TemplateEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [template, setTemplate] = useState<any>(null);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    if (!id) return;

    const { data: templateData, error: templateError } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (templateError) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar gabarito",
        description: templateError.message,
      });
      navigate("/templates");
      return;
    }

    setTemplate(templateData);

    const { data: questionsData, error: questionsError } = await supabase
      .from("template_questions")
      .select("*")
      .eq("template_id", id)
      .order("question_number");

    if (questionsError) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar questões",
        description: questionsError.message,
      });
    } else if (questionsData && questionsData.length > 0) {
      setQuestions(questionsData);
    } else {
      // Criar questões vazias
      const emptyQuestions: TemplateQuestion[] = Array.from(
        { length: templateData.total_questions },
        (_, i) => ({
          id: `temp-${i}`,
          question_number: i + 1,
          correct_answer: "A",
          points: 1,
          subject: null,
          topic: null,
        })
      );
      setQuestions(emptyQuestions);
    }

    setLoading(false);
  };

  const handleSaveQuestions = async () => {
    if (!id) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Deletar questões existentes
    await supabase.from("template_questions").delete().eq("template_id", id);

    // Inserir novas questões
    const questionsToInsert = questions.map((q) => ({
      template_id: id,
      question_number: q.question_number,
      correct_answer: q.correct_answer,
      points: q.points,
      subject: q.subject,
      topic: q.topic,
    }));

    const { error } = await supabase.from("template_questions").insert(questionsToInsert);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar questões",
        description: error.message,
      });
    } else {
      toast({
        title: "Gabarito salvo com sucesso!",
      });
      navigate("/templates");
    }
  };

  const updateQuestion = (index: number, field: keyof TemplateQuestion, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const isAcafe = template?.exam_type === "ACAFE";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/templates")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{template?.name}</h1>
              <p className="text-sm text-muted-foreground">
                {template?.total_questions} questões • {template?.exam_type}
              </p>
            </div>
          </div>
          <Button onClick={handleSaveQuestions}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Gabarito
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Gabarito das Questões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {questions.map((question, index) => (
                <div key={question.id} className="border rounded-lg p-4 space-y-3">
                  <Label className="font-bold">Questão {question.question_number}</Label>
                  <div className="space-y-2">
                    <Label htmlFor={`answer-${index}`} className="text-sm">
                      Resposta Correta
                    </Label>
                    <Select
                      value={question.correct_answer}
                      onValueChange={(value) => updateQuestion(index, "correct_answer", value)}
                    >
                      <SelectTrigger id={`answer-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                        <SelectItem value="D">D</SelectItem>
                        <SelectItem value="E">E</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isAcafe && (
                    <div className="space-y-2">
                      <Label htmlFor={`subject-${index}`} className="text-sm">
                        Disciplina
                      </Label>
                      <Select
                        value={question.subject || ""}
                        onValueChange={(value) => updateQuestion(index, "subject", value)}
                      >
                        <SelectTrigger id={`subject-${index}`}>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ACAFE_SUBJECTS.map((subject) => (
                            <SelectItem key={subject.value} value={subject.value}>
                              {subject.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`topic-${index}`} className="text-sm">
                      Tema / Conteúdo
                    </Label>
                    <Input
                      id={`topic-${index}`}
                      placeholder="Ex: Revolução Francesa, Cinemática..."
                      value={question.topic || ""}
                      onChange={(e) =>
                        updateQuestion(index, "topic", e.target.value || null)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`points-${index}`} className="text-sm">
                      Pontos
                    </Label>
                    <Input
                      id={`points-${index}`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={question.points}
                      onChange={(e) =>
                        updateQuestion(index, "points", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TemplateEdit;
