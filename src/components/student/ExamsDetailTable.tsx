import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface ExamDetail {
  id: string;
  name: string;
  type: string;
  date: string;
  score: string;
  percentage: number;
  trend?: number;
}

interface ExamsDetailTableProps {
  exams: ExamDetail[];
}

const ExamsDetailTable = ({ exams }: ExamsDetailTableProps) => {
  const getTrendIcon = (trend?: number) => {
    if (!trend) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (trend > 0) return <ArrowUp className="h-3 w-3 text-green-500" />;
    if (trend < 0) return <ArrowDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhamento de Provas</CardTitle>
        <CardDescription>
          Lista completa com todas as provas realizadas e suas notas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prova</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Nota</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-center">Tendência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam, index) => {
                const prevPercentage = index > 0 ? exams[index - 1].percentage : null;
                const trend = prevPercentage !== null ? exam.percentage - prevPercentage : undefined;

                return (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{exam.type}</Badge>
                    </TableCell>
                    <TableCell>{exam.date}</TableCell>
                    <TableCell className="text-center font-mono">
                      {exam.score}
                    </TableCell>
                    <TableCell className={`text-center font-bold ${getPerformanceColor(exam.percentage)}`}>
                      {exam.percentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getTrendIcon(trend)}
                        {trend !== undefined && trend !== 0 && (
                          <span className="text-xs text-muted-foreground">
                            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExamsDetailTable;
