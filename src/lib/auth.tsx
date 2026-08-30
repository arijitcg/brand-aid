import * as React from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

interface AuthUser {
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

const MOCK_SESSION_KEY = "designscope.mock-session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user?.email ? { email: data.session.user.email } : null);
        setLoading(false);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user?.email ? { email: session.user.email } : null);
      });
      return () => sub.subscription.unsubscribe();
    }

    const stored = localStorage.getItem(MOCK_SESSION_KEY);
    setUser(stored ? { email: stored } : null);
    setLoading(false);
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return;

      // Only treat "no such account / wrong password" as "maybe this is a new
      // user" — any other error (e.g. unconfirmed email) should surface as-is
      // instead of silently attempting a signup that goes nowhere.
      if (!/invalid login credentials/i.test(error.message)) {
        throw error;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (!signUpData.session) {
        throw new Error("Account created — check your email to confirm it before signing in.");
      }
      return;
    }
    localStorage.setItem(MOCK_SESSION_KEY, email);
    setUser({ email });
  }, []);

  const signOut = React.useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      return;
    }
    localStorage.removeItem(MOCK_SESSION_KEY);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
