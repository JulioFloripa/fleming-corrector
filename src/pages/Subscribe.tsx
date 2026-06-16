import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccess } from "@/hooks/useAccess";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import FlemingLogo from "@/components/FlemingLogo";
import { Check } from "lucide-react";

export default function Subscribe() {
  const navigate = useNavigate();
  const { loading, session, reason } = useAccess();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();

  useEffect(() => {
    if (loading) return;
    if (reason === "no-session") navigate("/auth", { replace: true });
    if (reason === "subscribed" || reason === "free-domain") navigate("/dashboard", { replace: true });
  }, [loading, reason, navigate]);

  const handleSubscribe = async () => {
    if (!session?.user) return;
    await openCheckout({
      priceId: "fleming_monthly",
      customerEmail: session.user.email,
      customData: { userId: session.user.id },
      successUrl: `${window.location.origin}/dashboard?checkout=success`,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <PaymentTestModeBanner />
      <div className="flex flex-col items-center justify-center p-6 pt-12">
        <div className="mb-6"><FlemingLogo size="lg" /></div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Assine para continuar</CardTitle>
            <CardDescription>
              Para usar a plataforma, é necessário ter uma assinatura ativa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">R$ 99,90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Fleming Mensal</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> Correção automática de provas</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> Gabaritos e turmas ilimitados</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> Boletins e relatórios completos</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> Cancele quando quiser</li>
              </ul>
            </div>
            <Button onClick={handleSubscribe} disabled={checkoutLoading} className="w-full">
              {checkoutLoading ? "Abrindo checkout..." : "Assinar agora"}
            </Button>
            <button
              onClick={handleLogout}
              className="w-full text-sm text-muted-foreground hover:text-foreground underline"
            >
              Sair
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
