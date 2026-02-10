"use client";
import React from "react";
import { supabase } from "@/lib/supabase";

type AuthState = {
  userId: string | null;
  email: string | null;
  loading: boolean;
};

const AuthContext = React.createContext<AuthState>({ userId: null, email: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ userId: null, email: null, loading: true });

  React.useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = data.session?.user ?? null;
      setState({ userId: u?.id ?? null, email: u?.email ?? null, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setState({ userId: u?.id ?? null, email: u?.email ?? null, loading: false });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}
