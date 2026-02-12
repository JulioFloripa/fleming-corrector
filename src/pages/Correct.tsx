import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileText, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import ExcelJS from "exceljs";

const Correct = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Estados do dialog de progresso
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStudent, setCurrentStudent] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

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

    const headers = ["ID", "E-mail", "Nome", "Sede", "Idioma escolhido"];
    for (let i = 1; i <= template.total_questions; i++) {
      headers.push(`Questão ${String(i).padStart(2, '0')}`);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Respostas");
    ws.addRow(headers);
    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = Math.max(h.length + 2, 12);
    });
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo_${template.name.replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_ROWS = 2000;

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
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 10MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleCloseDialog = () => {
    setShowProgressDialog(false);
    setIsCompleted(false);
    setProgressPercent(0);
    setCurrentStudent(0);
    setTotalStudents(0);
    navigate("/history");
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
    setShowProgressDialog(true);
    setIsCompleted(false);
    setProgressPercent(0);

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
        console.log('🚀 Iniciando processamento de', data.length, 'alunos');
        const { data: { user } } = await supabase.auth.getUser();
        setTotalStudents(data.length);
        
        const UPDATE_INTERVAL = 5; // Atualizar progresso a cada 5 alunos (reduzido para melhor feedback)
        let processedCount = 0;
        let errorCount = 0;
        
        for (let index = 0; index < data.length; index++) {
          try {
            const row = data[index];
            console.log(`📝 Processando aluno ${index + 1}/${data.length}`);
            
            // Atualizar progresso a cada UPDATE_INTERVAL alunos ou no último
            if (index % UPDATE_INTERVAL === 0 || index === data.length - 1) {
              setCurrentStudent(index + 1);
              setProgressPercent(Math.round(((index + 1) / data.length) * 100));
              console.log(`📊 Progresso: ${Math.round(((index + 1) / data.length) * 100)}%`);
            }
          
            const studentName = (row.Nome || row.nome || row.NOME || "").toString().trim();
            const studentId = (row.ID || row.id || row.matricula || row.Matricula || row.MATRICULA || "").toString().trim();
            
            if (!studentName || studentName.length > 255) {
              console.warn(`⚠️ Aluno ${index + 1}: nome inválido, pulando`);
              continue;
            }
            if (studentId && studentId.length > 100) {
              console.warn(`⚠️ Aluno ${index + 1}: ID muito longo, pulando`);
              continue;
            }
            
            console.log(`👤 Processando: ${studentName} (ID: ${studentId || 'sem ID'})`);

            // Verificar se já existe correção para este aluno + template
            console.log(`🔍 Verificando correção existente para ${studentName}`);
            const { data: existingCorrections, error: checkError } = await supabase
              .from("corrections")
              .select("id")
              .eq("template_id", selectedTemplate)
              .eq("student_name", studentName)
              .eq("user_id", user?.id ?? "");

            if (checkError) {
              console.error(`❌ Erro ao verificar correção existente:`, checkError);
              throw checkError;
            }

            let correctionId: string;

            if (existingCorrections && existingCorrections.length > 0) {
              // Atualizar correção existente
              console.log(`♻️ Atualizando correção existente`);
              correctionId = existingCorrections[0].id;
              const { error: updateError } = await supabase
                .from("corrections")
                .update({ status: "processing", student_id: studentId?.toString() })
                .eq("id", correctionId);

              if (updateError) {
                console.error(`❌ Erro ao atualizar correção:`, updateError);
                throw updateError;
              }

              // Deletar respostas antigas
              console.log(`🗑️ Deletando respostas antigas`);
              const { error: deleteError } = await supabase
                .from("student_answers")
                .delete()
                .eq("correction_id", correctionId);

              if (deleteError) {
                console.error(`❌ Erro ao deletar respostas antigas:`, deleteError);
                throw deleteError;
              }
            } else {
              // Criar nova correção
              console.log(`✨ Criando nova correção`);
              const { data: correction, error: correctionError } = await supabase
                .from("corrections")
                .insert({
                  user_id: user?.id,
                  template_id: selectedTemplate,
                  student_name: studentName,
                  student_id: studentId?.toString(),
                  status: "processing",
                })
                .select()
                .single();

              if (correctionError) {
                console.error(`❌ Erro ao criar correção:`, correctionError);
                throw correctionError;
              }
              correctionId = correction.id;
            }

            let totalScore = 0;
            let maxScore = 0;

            // Processar respostas
            console.log(`📋 Processando ${questions?.length || 0} questões`);
            for (const question of questions || []) {
              const qNum = question.question_number;
              const paddedNum = String(qNum).padStart(2, '0');
              const rawAnswer = row[`Questão ${paddedNum}`] || row[`questão ${paddedNum}`] || row[`q${qNum}`] || row[`Q${qNum}`];
              const studentAnswer = rawAnswer?.toString().trim().substring(0, 50) || null;
              const isCorrect = studentAnswer?.toUpperCase() === question.correct_answer.toUpperCase();
              const pointsEarned = isCorrect ? Number(question.points) : 0;

              totalScore += pointsEarned;
              maxScore += Number(question.points);

              const { error: answerError } = await supabase.from("student_answers").insert({
                correction_id: correctionId,
                question_number: question.question_number,
                student_answer: studentAnswer,
                correct_answer: question.correct_answer,
                is_correct: isCorrect,
                points_earned: pointsEarned,
              });

              if (answerError) {
                console.error(`❌ Erro ao inserir resposta da questão ${qNum}:`, answerError);
                throw answerError;
              }
            }

            // Atualizar correção com pontuação
            console.log(`💯 Finalizando: ${totalScore}/${maxScore} pontos (${((totalScore / maxScore) * 100).toFixed(1)}%)`);
            const { error: finalError } = await supabase
              .from("corrections")
              .update({
                total_score: totalScore,
                max_score: maxScore,
                percentage: (totalScore / maxScore) * 100,
                status: "completed",
              })
              .eq("id", correctionId);

            if (finalError) {
              console.error(`❌ Erro ao finalizar correção:`, finalError);
              throw finalError;
            }

            processedCount++;
            console.log(`✅ Aluno ${index + 1} processado com sucesso`);
          } catch (error: any) {
            errorCount++;
            console.error(`❌ Erro ao processar aluno ${index + 1}:`, error);
            // Continua processando os próximos alunos mesmo com erro
          }
        }

        // Marcar como concluído
        console.log(`🎉 Processamento concluído! ${processedCount} alunos processados, ${errorCount} erros`);
        setIsCompleted(true);
      };

      // Detectar tipo de arquivo e processar
      const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      
      const parseFile = async (): Promise<any[]> => {
        if (isXLSX) {
          const buffer = await file.arrayBuffer();
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buffer);
          const sheet = wb.worksheets[0];
          if (!sheet || sheet.rowCount < 2) return [];
          const headers = (sheet.getRow(1).values as any[]).slice(1); // ExcelJS is 1-indexed
          const rows: any[] = [];
          sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const obj: any = {};
            (row.values as any[]).slice(1).forEach((val, i) => {
              obj[headers[i]] = val;
            });
            rows.push(obj);
          });
          return rows;
        } else {
          return new Promise((resolve, reject) => {
            Papa.parse(file, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => resolve(results.data as any[]),
              error: (error) => reject(error),
            });
          });
        }
      };

      const parsedData = await parseFile();

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error("Arquivo vazio ou formato inválido");
      }
      if (parsedData.length > MAX_ROWS) {
        throw new Error(`Máximo de ${MAX_ROWS} registros por arquivo. O arquivo contém ${parsedData.length} registros.`);
      }

      await processData(parsedData);
    } catch (error: any) {
      setShowProgressDialog(false);
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

      {/* Dialog de Progresso e Conclusão */}
      <Dialog open={showProgressDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCompleted ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Processo Concluído
                </>
              ) : (
                "Processando Correções"
              )}
            </DialogTitle>
            <DialogDescription>
              {isCompleted ? (
                `${totalStudents} ${totalStudents === 1 ? 'estudante foi encontrado' : 'estudantes foram encontrados'} e corrigido${totalStudents === 1 ? '' : 's'} com sucesso!`
              ) : (
                `Processando aluno ${currentStudent} de ${totalStudents}...`
              )}
            </DialogDescription>
          </DialogHeader>

          {!isCompleted && (
            <div className="space-y-4 py-4">
              <Progress value={progressPercent} className="w-full" />
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
                <p className="text-sm text-muted-foreground">
                  Aguarde enquanto processamos as correções...
                </p>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="py-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">
                Todas as provas foram corrigidas!
              </p>
              <p className="text-sm text-muted-foreground">
                Você pode visualizar os resultados no histórico de correções.
              </p>
            </div>
          )}

          {isCompleted && (
            <DialogFooter>
              <Button onClick={handleCloseDialog} className="w-full">
                OK
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Correct;
