import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface ExamDetail {
  examName: string;
  date: string;
  percentage: number;
  trend: number;
  trendLabel: string;
}

interface ExamsDetailTableProps {
  exams: ExamDetail[];
}

const ExamsDetailTable = ({ exams }: ExamsDetailTableProps) => {
  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <ArrowUp className="h-3 w-3 text-primary" />;
    if (trend < 0) return <ArrowDown className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 70) return "text-primary";
    if (percentage >= 50) return "text-accent";
    return "text-destructive";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhamento por Prova</CardTitle>
        <CardDescription>
          Comparação entre provas consecutivas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prova</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Nota</TableHead>
                <TableHead className="text-center">Tendência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{exam.examName}</TableCell>
                  <TableCell>{exam.date}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${getPerformanceColor(exam.percentage)}`}>
                      {exam.percentage.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {getTrendIcon(exam.trend)}
                      <span className="text-sm text-muted-foreground">
                        {exam.trendLabel}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExamsDetailTable;
