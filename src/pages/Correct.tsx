import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const Correct = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkAuth();
    loadTemplates();
  }, []);

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
      .order("created_at", { ascending: false });
    
    if (error) {
      toast({
        title: "Erro ao carregar gabaritos",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    setTemplates(data || []);
  };

  const downloadTemplate = async () => {
    if (!selectedTemplate) return;
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    const headers = ["nome", "matricula"];
    for (let i = 1; i <= template.total_questions; i++) {
      headers.push(`q${i}`);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Respostas");
    XLSX.writeFile(wb, `modelo_${template.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isCSV = selectedFile.name.endsWith('.csv');
      const isXLSX = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      
      if (!isCSV && !isXLSX) {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie um arquivo CSV ou XLSX",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const processCorrection = async () => {
    if (!selectedTemplate || !file) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um gabarito e envie um arquivo",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // Carregar questões do template
      const { data: questions, error: questionsError } = await supabase
        .from("template_questions")
        .select("*")
        .eq("template_id", selectedTemplate)
        .order("question_number");

      if (questionsError) throw questionsError;

      // Função para processar dados
      const processData = async (data: any[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        
        for (const row of data) {
          const studentName = row.nome || row.Nome || row.NOME;
          const studentId = row.matricula || row.Matricula || row.MATRICULA;
          
          if (!studentName) continue;

          // Criar correção
          const { data: correction, error: correctionError } = await supabase
            .from("corrections")
            .insert({
              user_id: user?.id,
              template_id: selectedTemplate,
              student_name: studentName,
              student_id: studentId,
              status: "processing",
            })
            .select()
            .single();

          if (correctionError) continue;

          let totalScore = 0;
          let maxScore = 0;

          // Processar respostas
          for (const question of questions || []) {
            const studentAnswer = row[`q${question.question_number}`] || row[`Q${question.question_number}`];
            const isCorrect = studentAnswer?.toString().toUpperCase() === question.correct_answer.toUpperCase();
            const pointsEarned = isCorrect ? Number(question.points) : 0;

            totalScore += pointsEarned;
            maxScore += Number(question.points);

            await supabase.from("student_answers").insert({
              correction_id: correction.id,
              question_number: question.question_number,
              student_answer: studentAnswer?.toString(),
              correct_answer: question.correct_answer,
              is_correct: isCorrect,
              points_earned: pointsEarned,
            });
          }

          // Atualizar correção com pontuação
          await supabase
            .from("corrections")
            .update({
              total_score: totalScore,
              max_score: maxScore,
              percentage: (totalScore / maxScore) * 100,
              status: "completed",
            })
            .eq("id", correction.id);
        }

        toast({
          title: "Correção concluída!",
          description: `${data.length} provas corrigidas com sucesso`,
        });

        navigate("/history");
      };

      // Detectar tipo de arquivo e processar
      const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      
      if (isXLSX) {
        // Parse XLSX
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          await processData(jsonData);
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Parse CSV
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            await processData(results.data as any[]);
          },
          error: (error) => {
            throw error;
          },
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Corrigir Prova</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Corrigir Provas</CardTitle>
            <CardDescription>
              Envie um arquivo CSV ou Excel com as respostas dos alunos para correção automática
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Gabarito</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gabarito" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.total_questions} questões)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-2">
                  <FileText className="h-4 w-4 mr-1" />
                  Baixar modelo Excel
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Arquivo de Respostas</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  {file ? (
                    <>
                      <FileText className="h-12 w-12 text-primary" />
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Clique para trocar o arquivo
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-muted-foreground" />
                      <p className="font-medium">Clique para enviar CSV ou Excel</p>
                      <p className="text-sm text-muted-foreground">
                        Formato: CSV/XLSX com colunas nome, matricula, q1, q2, q3...
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={processCorrection}
                disabled={!selectedTemplate || !file || processing}
                className="flex-1"
              >
                {processing ? "Processando..." : "Corrigir Provas"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/templates")}>
                Gerenciar Gabaritos
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Correct;
