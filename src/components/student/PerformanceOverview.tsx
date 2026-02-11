import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Award, Target, FileText, BarChart3 } from "lucide-react";

interface PerformanceStats {
  totalExams: number;
  averagePercentage: number;
  bestScore: number;
  worstScore: number;
  trend: number;
  improvementRate: number;
}

interface PerformanceOverviewProps {
  stats: PerformanceStats;
  studentName: string;
}

const PerformanceOverview = ({ stats, studentName }: PerformanceOverviewProps) => {
  const getTrendIcon = () => {
    if (stats.trend > 5) return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (stats.trend < -5) return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <BarChart3 className="h-5 w-5 text-yellow-500" />;
  };

  const getTrendText = () => {
    if (stats.trend > 5) return "Melhorando";
    if (stats.trend < -5) return "Piorando";
    return "Estável";
  };

  const getTrendColor = () => {
    if (stats.trend > 5) return "text-green-600 dark:text-green-400";
    if (stats.trend < -5) return "text-red-600 dark:text-red-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{studentName}</h2>
        <p className="text-muted-foreground">Análise de Desempenho Geral</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Provas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExams}</div>
            <p className="text-xs text-muted-foreground">
              Provas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averagePercentage.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Desempenho médio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Nota</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.bestScore.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Maior desempenho
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pior Nota</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.worstScore.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Menor desempenho
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendência</CardTitle>
            {getTrendIcon()}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getTrendColor()}`}>
              {getTrendText()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.trend > 0 ? "+" : ""}{stats.trend.toFixed(1)}% de variação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Melhoria</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.improvementRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Evolução ao longo do tempo
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformanceOverview;
