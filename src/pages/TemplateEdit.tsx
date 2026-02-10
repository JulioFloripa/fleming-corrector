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

interface TemplateQuestion {
  id: string;
  question_number: number;
  correct_answer: string;
  points: number;
  subject: string | null;
  topic: string | null;
}

interface DisciplineOption {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

const TemplateEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [template, setTemplate] = useState<any>(null);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
    loadDisciplines();
  }, [id]);

  const loadDisciplines = async () => {
    const { data: discData } = await supabase.from("disciplines").select("*").order("name");
    const { data: topicsData } = await supabase.from("discipline_topics").select("*").order("name");
    
    const mapped: DisciplineOption[] = (discData || []).map((d) => ({
      id: d.id,
      name: d.name,
      topics: (topicsData || []).filter((t) => t.discipline_id === d.id),
    }));
    setDisciplines(mapped);
  };

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

  const getTopicsForDiscipline = (disciplineName: string | null) => {
    if (!disciplineName) return [];
    const disc = disciplines.find((d) => d.name === disciplineName);
    return disc?.topics || [];
  };

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
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground w-16">#</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground w-24">Resposta</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Disciplina</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Conteúdo</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground w-20">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => (
                  <tr key={question.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{question.question_number}</td>
                    <td className="py-2 px-2">
                      <Select
                        value={question.correct_answer}
                        onValueChange={(value) => updateQuestion(index, "correct_answer", value)}
                      >
                        <SelectTrigger className="h-8 w-20">
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
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={question.subject || "__none__"}
                        onValueChange={(value) => {
                          const realValue = value === "__none__" ? null : value;
                          updateQuestion(index, "subject", realValue);
                          updateQuestion(index, "topic", null);
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Selecione...</SelectItem>
                          {disciplines.map((disc) => (
                            <SelectItem key={disc.id} value={disc.name}>
                              {disc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2">
                      {getTopicsForDiscipline(question.subject).length > 0 ? (
                        <Select
                          value={question.topic || "__none__"}
                          onValueChange={(value) => updateQuestion(index, "topic", value === "__none__" ? null : value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Selecione...</SelectItem>
                            {getTopicsForDiscipline(question.subject).map((t) => (
                              <SelectItem key={t.id} value={t.name}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="h-8"
                          placeholder={question.subject ? "Nenhum conteúdo cadastrado" : "Selecione a disciplina"}
                          value={question.topic || ""}
                          onChange={(e) => updateQuestion(index, "topic", e.target.value || null)}
                          disabled={!question.subject}
                        />
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        className="h-8 w-20"
                        type="number"
                        step="0.1"
                        min="0"
                        value={question.points}
                        onChange={(e) =>
                          updateQuestion(index, "points", parseFloat(e.target.value) || 0)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TemplateEdit;
