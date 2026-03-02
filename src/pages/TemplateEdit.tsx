import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, RefreshCw } from "lucide-react";
import { recalculateByTemplate } from "@/lib/recalculate";
import { EXAM_PRESETS, generatePresetQuestions } from "@/lib/exam-presets";

interface TemplateQuestion {
  id: string;
  question_number: number;
  correct_answer: string;
  points: number;
  subject: string | null;
  topic: string | null;
  language_variant: string | null;
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
  const [showRecalcDialog, setShowRecalcDialog] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
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
      setQuestions(questionsData.map(q => ({ ...q, language_variant: (q as any).language_variant ?? null })));
    } else {
      // Use preset if available, otherwise create empty questions
      const preset = EXAM_PRESETS[templateData.exam_type];
      if (preset) {
        const presetQuestions = generatePresetQuestions(preset).map((q, i) => ({
          ...q,
          id: `temp-${i}`,
        }));
        setQuestions(presetQuestions);
      } else {
        const emptyQuestions: TemplateQuestion[] = Array.from(
          { length: templateData.total_questions },
          (_, i) => ({
            id: `temp-${i}`,
            question_number: i + 1,
            correct_answer: "A",
            points: 1,
            subject: null,
            topic: null,
            language_variant: null,
          })
        );
        setQuestions(emptyQuestions);
      }
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
      language_variant: q.language_variant,
    }));

    const { error } = await supabase.from("template_questions").insert(questionsToInsert);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar questões",
        description: error.message,
      });
      return;
    }

    toast({ title: "Gabarito salvo com sucesso!" });

    // Check if there are corrections linked to this template
    const { count } = await supabase
      .from("corrections")
      .select("id", { count: "exact", head: true })
      .eq("template_id", id);

    if (count && count > 0) {
      setShowRecalcDialog(true);
    } else {
      navigate("/templates");
    }
  };

  const handleRecalculate = async () => {
    if (!id) return;
    setRecalculating(true);
    const result = await recalculateByTemplate(id);
    setRecalculating(false);
    setShowRecalcDialog(false);

    if (result.success) {
      toast({ title: `${result.correctionsUpdated} correção(ões) recalculada(s) com sucesso!` });
    } else {
      toast({ variant: "destructive", title: "Erro ao recalcular", description: result.error });
    }
    navigate("/templates");
  };

  const updateQuestion = (index: number, fields: Partial<TemplateQuestion>) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      newQuestions[index] = { ...newQuestions[index], ...fields };
      return newQuestions;
    });
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
                {questions.map((question, index) => {
                  const isVariant = question.language_variant != null;
                  const isSecondVariant = isVariant && question.language_variant === "Espanhol";
                  
                  return (
                    <tr 
                      key={question.id} 
                      className={`border-b last:border-0 hover:bg-muted/50 ${isVariant ? 'bg-accent/20' : ''} ${isSecondVariant ? 'border-b-2 border-b-border' : ''}`}
                    >
                      <td className="py-2 px-2 font-medium">
                        {isSecondVariant ? "" : question.question_number}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          {isVariant && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {question.language_variant === "Inglês" ? "🇬🇧" : "🇪🇸"}
                            </span>
                          )}
                          <Select
                            value={question.correct_answer}
                            onValueChange={(value) => updateQuestion(index, { correct_answer: value })}
                          >
                            <SelectTrigger className="h-8 w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(EXAM_PRESETS[template?.exam_type]?.alternatives || ["A", "B", "C", "D", "E"]).map((alt) => (
                                <SelectItem key={alt} value={alt}>{alt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {isVariant ? (
                          <span className="text-xs text-muted-foreground">
                            Língua Estrangeira ({question.language_variant})
                          </span>
                        ) : (
                          <Select
                            value={question.subject || "__none__"}
                            onValueChange={(value) => {
                              const realValue = value === "__none__" ? null : value;
                              updateQuestion(index, { subject: realValue, topic: null });
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
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isVariant ? null : (
                          getTopicsForDiscipline(question.subject).length > 0 ? (
                            <Select
                              value={question.topic || "__none__"}
                              onValueChange={(value) => updateQuestion(index, { topic: value === "__none__" ? null : value })}
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
                              onChange={(e) => updateQuestion(index, { topic: e.target.value || null })}
                              disabled={!question.subject}
                            />
                          )
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isSecondVariant ? null : (
                          <Input
                            className="h-8 w-20"
                            type="number"
                            step="0.1"
                            min="0"
                            value={question.points}
                            onChange={(e) =>
                              updateQuestion(index, { points: parseFloat(e.target.value) || 0 })
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={showRecalcDialog} onOpenChange={setShowRecalcDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalcular correções?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem correções vinculadas a este gabarito. Deseja recalcular os resultados com base nas novas respostas do gabarito?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => navigate("/templates")} disabled={recalculating}>
              Não, apenas salvar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRecalculate} disabled={recalculating}>
              {recalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Recalculando...
                </>
              ) : (
                "Sim, recalcular"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TemplateEdit;
