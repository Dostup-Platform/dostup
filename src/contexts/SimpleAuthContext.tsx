import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearAppSession,
  parseProfileType,
  profileHomePath,
  storeCreatorSession,
  type AppProfile,
  type ProfileType,
} from "@/lib/creatorAuth";

interface SimpleUser {
  id: string;
  phone: string;
  name: string;
  role: "student" | "creator" | "teacher";
  created_at: string;
}

interface SimpleAuthContextType {
  user: SimpleUser | null;
  loading: boolean;
  sessionToken: string | null;
  profileType: ProfileType | null;
  profiles: AppProfile[];
  refreshSession: () => Promise<void>;
  switchProfile: (opts: {
    profileId?: string;
    createType?: ProfileType;
    displayName?: string;
  }) => Promise<{ path: string } | { error: string }>;
  createProfile: (opts: {
    profileType: ProfileType;
    displayName: string;
  }) => Promise<{ path: string } | { error: string }>;
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

function buyerFromStorage(): SimpleUser | null {
  const profileType = parseProfileType(localStorage.getItem("profile_type"));
  const profileId = localStorage.getItem("profile_id");
  if (profileType !== "buyer" || !profileId) return null;
  return {
    id: profileId,
    phone: "",
    name: localStorage.getItem("profile_display_name") || localStorage.getItem("creator_name") || "",
    role: "student",
    created_at: localStorage.getItem("creator_created_at") || new Date().toISOString(),
  };
}

function readStoredProfiles(): AppProfile[] {
  try {
    const raw = localStorage.getItem("identity_profiles");
    if (!raw) return [];
    return JSON.parse(raw) as AppProfile[];
  } catch {
    return [];
  }
}

export const SimpleAuthProvider = ({ children }: SimpleAuthProviderProps) => {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [profileType, setProfileType] = useState<ProfileType | null>(() =>
    parseProfileType(typeof window === "undefined" ? null : localStorage.getItem("profile_type")),
  );
  const [profiles, setProfiles] = useState<AppProfile[]>(() =>
    typeof window === "undefined" ? [] : readStoredProfiles(),
  );
  const [loading, setLoading] = useState(true);

  const applyBuyer = useCallback((token: string, next: SimpleUser, nextProfiles: AppProfile[]) => {
    setUser(next);
    setSessionToken(token);
    setProfileType("buyer");
    setProfiles(nextProfiles);
  }, []);

  const refreshSession = useCallback(async () => {
    const token = localStorage.getItem("creator_token");
    const storedType = parseProfileType(localStorage.getItem("profile_type"));
    const creatorName = localStorage.getItem("creator_name") || "";

    if (!token) {
      setUser(null);
      setSessionToken(null);
      setProfileType(null);
      setProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-creator-session", {
        body: { token, creatorName },
      });

      if (error) {
        if (storedType === "buyer") {
          const cached = buyerFromStorage();
          if (cached) applyBuyer(token, cached, readStoredProfiles());
        } else {
          setProfileType(storedType);
          setSessionToken(token);
        }
        return;
      }

      if (!data?.valid) {
        clearAppSession();
        setUser(null);
        setSessionToken(null);
        setProfileType(null);
        setProfiles([]);
        return;
      }

      if (data.needsOnboarding) {
        setSessionToken(token);
        setProfileType(null);
        setUser(null);
        setProfiles([]);
        localStorage.removeItem("profile_id");
        localStorage.removeItem("profile_type");
        return;
      }

      const nextType = parseProfileType(data.profileType) || storedType;
      const nextProfiles = (data.profiles as AppProfile[] | undefined) ?? readStoredProfiles();
      setProfiles(nextProfiles);
      setProfileType(nextType);
      setSessionToken(token);
      if (data.profileId) localStorage.setItem("profile_id", data.profileId);
      if (data.displayName) localStorage.setItem("profile_display_name", data.displayName);
      if (data.profileType) localStorage.setItem("profile_type", data.profileType);
      if (typeof data.handle === "string" && data.handle) {
        localStorage.setItem("profile_handle", data.handle);
      } else if (data.handle === null || data.handle === "") {
        localStorage.removeItem("profile_handle");
      }
      if (nextProfiles.length) localStorage.setItem("identity_profiles", JSON.stringify(nextProfiles));

      if (nextType === "buyer") {
        applyBuyer(token, {
          id: data.profileId || localStorage.getItem("profile_id") || "",
          phone: "",
          name: data.displayName || localStorage.getItem("profile_display_name") || "",
          role: "student",
          created_at: data.createdAt || localStorage.getItem("creator_created_at") || new Date().toISOString(),
        }, nextProfiles);
      } else {
        setUser(null);
      }
    } catch {
      if (storedType === "buyer") {
        const cached = buyerFromStorage();
        if (cached) applyBuyer(token, cached, readStoredProfiles());
      } else {
        setProfileType(storedType);
        setSessionToken(token);
      }
    } finally {
      setLoading(false);
    }
  }, [applyBuyer]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const createProfile = async (opts: {
    profileType: ProfileType;
    displayName: string;
  }) => {
    const token = localStorage.getItem("creator_token") || sessionToken || "";
    if (!token) return { error: "Unauthorized" };
    try {
      const { data, error } = await supabase.functions.invoke("create-profile", {
        body: {
          token,
          profileType: opts.profileType,
          displayName: opts.displayName,
        },
      });
      if (error || !data?.success || !data.token || !data.profileType) {
        return { error: String(data?.error || error?.message || "Failed") };
      }
      storeCreatorSession({
        token: data.token,
        creatorName: data.creatorName,
        accountType: data.accountType,
        profileType: data.profileType,
        profileId: data.profileId,
        displayName: data.displayName,
        handle: data.handle ?? null,
        profiles: data.profiles,
      });
      const nextType = parseProfileType(data.profileType) || "buyer";
      setProfileType(nextType);
      setProfiles((data.profiles as AppProfile[]) ?? []);
      if (nextType === "buyer") {
        applyBuyer(data.token, {
          id: data.profileId,
          phone: "",
          name: data.displayName || data.creatorName,
          role: "student",
          created_at: localStorage.getItem("creator_created_at") || new Date().toISOString(),
        }, (data.profiles as AppProfile[]) ?? []);
      } else {
        setUser(null);
        setSessionToken(data.token);
      }
      return { path: profileHomePath(data.profileType, data.accountType) };
    } catch {
      return { error: "network_failure" };
    }
  };

  const switchProfile = async (opts: {
    profileId?: string;
    createType?: ProfileType;
    displayName?: string;
  }) => {
    const token = localStorage.getItem("creator_token") || sessionToken || "";
    if (!token) return { error: "Unauthorized" };
    try {
      const { data, error } = await supabase.functions.invoke("switch-profile", {
        body: {
          token,
          profileId: opts.profileId,
          createType: opts.createType,
          displayName: opts.displayName,
        },
      });
      if (error || !data?.success || !data.token || !data.profileType) {
        return { error: String(data?.error || error?.message || "Failed") };
      }
      storeCreatorSession({
        token: data.token,
        creatorName: data.creatorName,
        accountType: data.accountType,
        profileType: data.profileType,
        profileId: data.profileId,
        displayName: data.displayName,
        handle: data.handle ?? null,
        profiles: data.profiles,
      });
      const nextType = parseProfileType(data.profileType) || "buyer";
      setProfileType(nextType);
      setProfiles((data.profiles as AppProfile[]) ?? []);
      if (nextType === "buyer") {
        applyBuyer(data.token, {
          id: data.profileId,
          phone: "",
          name: data.displayName || data.creatorName,
          role: "student",
          created_at: localStorage.getItem("creator_created_at") || new Date().toISOString(),
        }, (data.profiles as AppProfile[]) ?? []);
      } else {
        setUser(null);
        setSessionToken(data.token);
      }
      return { path: profileHomePath(data.profileType, data.accountType) };
    } catch {
      return { error: "network_failure" };
    }
  };

  const logout = () => {
    clearAppSession();
    setUser(null);
    setSessionToken(null);
    setProfileType(null);
    setProfiles([]);
    void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  };

  return (
    <SimpleAuthContext.Provider value={{
      user,
      loading,
      sessionToken,
      profileType,
      profiles,
      refreshSession,
      switchProfile,
      createProfile,
      logout,
    }}>
      {children}
    </SimpleAuthContext.Provider>
  );
};
