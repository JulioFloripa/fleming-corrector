import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

const FREE_DOMAIN = "flemingeducacao.com.br";

export type AccessState = {
  loading: boolean;
  session: any | null;
  hasAccess: boolean;
  reason: "loading" | "no-session" | "free-domain" | "subscribed" | "needs-subscription";
};

function emailIsFreeDomain(email?: string | null) {
  if (!email) return false;
  return email.toLowerCase().endsWith("@" + FREE_DOMAIN);
}

export function useAccess(): AccessState {
  const [state, setState] = useState<AccessState>({
    loading: true, session: null, hasAccess: false, reason: "loading",
  });

  useEffect(() => {
    let mounted = true;

    const evaluate = async (session: any | null) => {
      if (!session) {
        if (mounted) setState({ loading: false, session: null, hasAccess: false, reason: "no-session" });
        return;
      }
      const email = session.user?.email as string | undefined;
      if (emailIsFreeDomain(email)) {
        if (mounted) setState({ loading: false, session, hasAccess: true, reason: "free-domain" });
        return;
      }
      const env = getPaddleEnvironment();
      const { data } = await supabase
        .from("subscriptions")
        .select("status,current_period_end")
        .eq("user_id", session.user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = Date.now();
      const endsAt = data?.current_period_end ? new Date(data.current_period_end).getTime() : null;
      const active =
        !!data &&
        (
          (["active", "trialing", "past_due"].includes(data.status) && (!endsAt || endsAt > now)) ||
          (data.status === "canceled" && endsAt && endsAt > now)
        );

      if (mounted) setState({
        loading: false, session, hasAccess: !!active,
        reason: active ? "subscribed" : "needs-subscription",
      });
    };

    supabase.auth.getSession().then(({ data: { session } }) => evaluate(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => evaluate(session));
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return state;
}
