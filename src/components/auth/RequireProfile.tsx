import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthSplash from "@/components/auth/AuthSplash";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

type RequireProfileProps = {
  children: ReactNode;
};

/**
 * Blocks dashboard routes until a profile is attached to the session.
 */
const RequireProfile = ({ children }: RequireProfileProps) => {
  const navigate = useNavigate();
  const { status, profileType, sessionToken } = useSimpleAuth();
  const [blocked, setBlocked] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "guest" || !sessionToken) {
      navigate("/login", { replace: true });
      return;
    }
    const missingProfile = Boolean(sessionToken && !profileType && !localStorage.getItem("profile_id"));
    if (missingProfile) {
      navigate("/login", { replace: true });
      return;
    }
    setBlocked(false);
  }, [navigate, profileType, sessionToken, status]);

  if (status === "loading" || blocked) {
    return <AuthSplash />;
  }

  return <>{children}</>;
};

export default RequireProfile;
