import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

type RequireProfileProps = {
  children: ReactNode;
};

/**
 * Blocks dashboard routes until a profile is attached to the session.
 */
const RequireProfile = ({ children }: RequireProfileProps) => {
  const navigate = useNavigate();
  const { loading, profileType, sessionToken } = useSimpleAuth();
  const [blocked, setBlocked] = useState(true);

  useEffect(() => {
    if (loading) return;
    const missingProfile = Boolean(sessionToken && !profileType && !localStorage.getItem("profile_id"));
    if (missingProfile) {
      navigate("/login", { replace: true });
      return;
    }
    setBlocked(false);
  }, [loading, navigate, profileType, sessionToken]);

  if (loading || blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireProfile;
