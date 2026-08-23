import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { isOnboardingSession, readAuthEmail, roleOnboardingPath } from "@/lib/creatorAuth";

type RequireProfileProps = {
  children: ReactNode;
};

/**
 * Blocks dashboard routes while the session has no profile_id (onboarding in progress).
 */
const RequireProfile = ({ children }: RequireProfileProps) => {
  const navigate = useNavigate();
  const { loading, profileType, sessionToken } = useSimpleAuth();
  const [blocked, setBlocked] = useState(true);

  useEffect(() => {
    if (loading) return;
    const creatorName = localStorage.getItem("creator_name");
    const onboarding = isOnboardingSession(creatorName);
    const missingProfile = Boolean(sessionToken && !profileType && !localStorage.getItem("profile_id"));
    if (onboarding || missingProfile) {
      const email = readAuthEmail();
      navigate(roleOnboardingPath(email), { replace: true });
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
