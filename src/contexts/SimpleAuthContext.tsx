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
  loginOrRegister: (name: string) => Promise<{ user: SimpleUser | null; error: Error | null; isNewUser: boolean }>;
  login: (phone: string) => Promise<{ user: SimpleUser | null; error: Error | null }>;
  loginById: (userId: string) => Promise<{ user: SimpleUser | null; error: Error | null }>;
  loginByName: (name: string) => Promise<{ user: SimpleUser | null; error: Error | null }>;
  setRole: (role: "student" | "creator") => Promise<{ error: Error | null }>;
  logout: () => void;
  lastUserId: string | null;
  lastUserName: string | null;
  clearLastUser: () => void;
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
const LAST_USER_ID_KEY = "simple_last_user_id";
const LAST_USER_NAME_KEY = "simple_last_user_name";

export const SimpleAuthProvider = ({ children }: SimpleAuthProviderProps) => {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const [lastUserName, setLastUserName] = useState<string | null>(null);

  // Загрузить пользователя из localStorage при старте
  useEffect(() => {
    const loadUser = async () => {
      const storedUserId = localStorage.getItem(USER_STORAGE_KEY);
      
      // Загружаем данные последнего пользователя для кнопки "Войти как"
      const storedLastUserId = localStorage.getItem(LAST_USER_ID_KEY);
      const storedLastUserName = localStorage.getItem(LAST_USER_NAME_KEY);
      if (storedLastUserId && storedLastUserName) {
        setLastUserId(storedLastUserId);
        setLastUserName(storedLastUserName);
      }
      
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
    // Сначала проверяем, существует ли уже пользователь с таким именем
    const { data: existingUsers } = await supabase
      .from("simple_users")
      .select("*")
      .eq("name", name)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      setUser(existingUser as SimpleUser);
      localStorage.setItem(USER_STORAGE_KEY, existingUser.id);
      return { user: existingUser as SimpleUser, error: null };
    }

    // Генерируем уникальный идентификатор вместо телефона
    const uniqueId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Создать нового пользователя
    const { data, error } = await supabase
      .from("simple_users")
      .insert({ name, phone: uniqueId })
      .select()
      .single();

    if (error) {
      // Обработка ошибки уникальности (race condition)
      if (error.code === '23505') {
        const { data: raceUser } = await supabase
          .from("simple_users")
          .select("*")
          .eq("name", name)
          .limit(1)
          .single();
        
        if (raceUser) {
          setUser(raceUser as SimpleUser);
          localStorage.setItem(USER_STORAGE_KEY, raceUser.id);
          return { user: raceUser as SimpleUser, error: null };
        }
      }
      return { user: null, error: new Error(error.message) };
    }

    setUser(data as SimpleUser);
    localStorage.setItem(USER_STORAGE_KEY, data.id);
    return { user: data as SimpleUser, error: null };
  };

  // Найти пользователя по имени или создать нового
  const loginOrRegister = async (name: string) => {
    // Сначала пробуем найти существующих пользователей по имени (может быть несколько)
    const { data: existingUsers, error: searchError } = await supabase
      .from("simple_users")
      .select("*")
      .eq("name", name)
      .order("created_at", { ascending: true })
      .limit(1);

    if (searchError) {
      return { user: null, error: new Error(searchError.message), isNewUser: false };
    }

    // Если пользователь найден - входим в первый (самый старый) аккаунт
    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      setUser(existingUser as SimpleUser);
      localStorage.setItem(USER_STORAGE_KEY, existingUser.id);
      return { user: existingUser as SimpleUser, error: null, isNewUser: false };
    }

    // Если не найден - создаём нового
    const uniqueId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const { data, error } = await supabase
      .from("simple_users")
      .insert({ name, phone: uniqueId })
      .select()
      .single();

    if (error) {
      // Обработка ошибки уникальности (race condition - пользователь создан параллельно)
      if (error.code === '23505') {
        const { data: raceUser } = await supabase
          .from("simple_users")
          .select("*")
          .eq("name", name)
          .limit(1)
          .single();
        
        if (raceUser) {
          setUser(raceUser as SimpleUser);
          localStorage.setItem(USER_STORAGE_KEY, raceUser.id);
          return { user: raceUser as SimpleUser, error: null, isNewUser: false };
        }
      }
      return { user: null, error: new Error(error.message), isNewUser: false };
    }

    setUser(data as SimpleUser);
    localStorage.setItem(USER_STORAGE_KEY, data.id);
    return { user: data as SimpleUser, error: null, isNewUser: true };
  };

  const loginByName = async (name: string) => {
    const { data: users, error } = await supabase
      .from("simple_users")
      .select("*")
      .eq("name", name)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error || !users || users.length === 0) {
      return { user: null, error: new Error("Пользователь не найден") };
    }
    
    const data = users[0];

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

  const loginById = async (userId: string) => {
    const { data, error } = await supabase
      .from("simple_users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return { user: null, error: new Error("Пользователь не найден") };
    }

    setUser(data as SimpleUser);
    localStorage.setItem(USER_STORAGE_KEY, data.id);
    // Очищаем "последний пользователь" после успешного входа
    setLastUserId(null);
    setLastUserName(null);
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
    // Сохраняем ID и имя для возможности повторного входа
    if (user) {
      localStorage.setItem(LAST_USER_ID_KEY, user.id);
      localStorage.setItem(LAST_USER_NAME_KEY, user.name);
      setLastUserId(user.id);
      setLastUserName(user.name);
    }
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  const clearLastUser = () => {
    localStorage.removeItem(LAST_USER_ID_KEY);
    localStorage.removeItem(LAST_USER_NAME_KEY);
    setLastUserId(null);
    setLastUserName(null);
  };

  return (
    <SimpleAuthContext.Provider value={{ 
      user, 
      loading, 
      register,
      loginOrRegister,
      login, 
      loginById,
      loginByName,
      setRole, 
      logout,
      lastUserId,
      lastUserName,
      clearLastUser
    }}>
      {children}
    </SimpleAuthContext.Provider>
  );
};
