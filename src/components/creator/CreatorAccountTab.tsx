import { useState, useEffect } from "react";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import AccountSettingsView from "@/components/account/AccountSettingsView";

interface CreatorAccountTabProps {
  creatorName: string;
}

const CreatorAccountTab = ({ creatorName }: CreatorAccountTabProps) => {
  const { profiles } = useSimpleAuth();
  const [createdAt, setCreatedAt] = useState<Date | null>(null);

  const activeProfileId = typeof window !== "undefined" ? localStorage.getItem("profile_id") : null;
  const currentUserId = typeof window !== "undefined" ? localStorage.getItem("simple_user_id") || "" : "";
  const shownName =
    profiles.find((profile) => profile.id === activeProfileId)?.displayName?.trim() ||
    creatorName;

  useEffect(() => {
    const storedDate = localStorage.getItem("creator_created_at");
    if (storedDate) {
      setCreatedAt(new Date(storedDate));
    } else {
      const now = new Date();
      localStorage.setItem("creator_created_at", now.toISOString());
      setCreatedAt(now);
    }
  }, []);

  return (
    <AccountSettingsView
      role="creator"
      displayName={shownName}
      createdAt={createdAt}
      userId={currentUserId || creatorName}
    />
  );
};

export default CreatorAccountTab;
