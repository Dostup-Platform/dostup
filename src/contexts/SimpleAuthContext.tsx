import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SimpleUser {
  id: string;
  phone: string;
  name: string;
  role: "student" | "creator";
  created_at: string;
}

interface SimpleAuthContextType {
  user: SimpleUser | null;
  loading: boolean;
  register: (name: string) => Promise<{ user: SimpleUser | null; error: Error | null }>;
  login: (phone: string) => Promise<{ user: SimpleUser | null; error: Error | null }>;
  setRole: (role: "student" | "creator") => Promise<{ error: Error | null }>;
  logout: () => void;
}

const SimpleAuthContext = createContext<SimpleAuthContextType | undefined>(undefined);

export const useSimpleAuth = () => {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error("useSimpleAuth must be used within a SimpleAuthProvider");
  }
  return context;
};

interface SimpleAuthProviderProps {
  children: ReactNode;
}

const USER_STORAGE_KEY = "simple_user_id";

export const SimpleAuthProvider = ({ children }: SimpleAuthProviderProps) => {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Загрузить пользователя из localStorage при старте
  useEffect(() => {
    const loadUser = async () => {
      const storedUserId = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUserId) {
        const { data, error } = await supabase
          .from("simple_users")
          .select("*")
          .eq("id", storedUserId)
          .single();

        if (data && !error) {
          setUser(data as SimpleUser);
        } else {
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const register = async (name: string) => {
    // Создать нового пользователя
    const { data, error } = await supabase
      .from("simple_users")
      .insert({ name, phone: "" })
      .select()
      .single();

    if (error) {
      return { user: null, error: new Error(error.message) };
    }

    setUser(data as SimpleUser);
    localStorage.setItem(USER_STORAGE_KEY, data.id);
    return { user: data as SimpleUser, error: null };
  };

  const login = async (phone: string) => {
    const { data, error } = await supabase
      .from("simple_users")
      .select("*")
      .eq("phone", phone)
      .single();

    if (error || !data) {
      return { user: null, error: new Error("Пользователь не найден") };
    }

    setUser(data as SimpleUser);
    localStorage.setItem(USER_STORAGE_KEY, data.id);
    return { user: data as SimpleUser, error: null };
  };

  const setRole = async (role: "student" | "creator") => {
    if (!user) {
      return { error: new Error("Пользователь не авторизован") };
    }

    const { error } = await supabase
      .from("simple_users")
      .update({ role })
      .eq("id", user.id);

    if (error) {
      return { error: new Error(error.message) };
    }

    setUser({ ...user, role });
    return { error: null };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  return (
    <SimpleAuthContext.Provider value={{ user, loading, register, login, setRole, logout }}>
      {children}
    </SimpleAuthContext.Provider>
  );
};
