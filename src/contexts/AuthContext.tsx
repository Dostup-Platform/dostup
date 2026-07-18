import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export type AppRole = "student" | "creator" | "school_admin" | "teacher" | "moderator" | "admin" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  activeRole: AppRole | null;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  switchRole: (role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);

  const loadRoles = useCallback(async (uid: string) => {
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const rs = (roleRows ?? []).map((r) => r.role as AppRole);
    setRoles(rs);
    const { data: prof } = await supabase.from("profiles").select("active_role").eq("user_id", uid).maybeSingle();
    const active = (prof?.active_role as AppRole | null) ?? rs[0] ?? null;
    setActiveRole(active);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => { void loadRoles(sess.user.id); }, 0);
      } else {
        setRoles([]);
        setActiveRole(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) void loadRoles(sess.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadRoles]);

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name },
      },
    });
    return { error: (error as Error | null) ?? null };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: (error as Error | null) ?? null };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return { error: result.error as Error };
    return { error: null };
  };

  const signInWithApple = async () => {
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return { error: result.error as Error };
    return { error: null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: (error as Error | null) ?? null };
  };

  const switchRole = async (role: AppRole) => {
    if (!user) return;
    if (!roles.includes(role)) return;
    setActiveRole(role);
    await supabase.from("profiles").update({ active_role: role as never }).eq("user_id", user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user, session, loading, roles, activeRole,
        signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithApple,
        resetPassword, switchRole, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};