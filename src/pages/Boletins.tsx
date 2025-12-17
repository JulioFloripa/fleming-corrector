import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Users } from "lucide-react";
import FlemingLogo from "@/components/FlemingLogo";

const Boletins = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const boletimTypes = [
    {
      id: "acafe",
      title: "Boletim ACAFE",
      description: "Boletim de desempenho para provas no formato ACAFE",
      icon: FileText,
      path: "/boletins/acafe",
      subjects: ["Português", "Matemática", "História", "Geografia", "Física", "Química", "Biologia", "Inglês"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FlemingLogo size="sm" />
          <h1 className="text-xl font-bold">Boletins de Desempenho</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Selecione o Tipo de Boletim</h2>
            <p className="text-muted-foreground">
              Cada tipo de prova possui um formato de boletim específico com as disciplinas correspondentes.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {boletimTypes.map((boletim) => (
              <Card
                key={boletim.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                onClick={() => navigate(boletim.path)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <boletim.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{boletim.title}</CardTitle>
                      <CardDescription>{boletim.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {boletim.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-muted-foreground">Em breve</CardTitle>
                    <CardDescription>
                      Outros formatos de boletim serão adicionados
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  ENEM, UFSC, provas internas e mais...
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Boletins;
