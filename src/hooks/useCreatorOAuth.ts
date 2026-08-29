import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { authErrorKeyFromUnknown } from "@/lib/authErrors";
import {
  sendCreatorMagicLink,
  startGoogleOAuth,
  type CreatorAccountType,
  type ProfileType,
} from "@/lib/creatorAuth";

export function useCreatorOAuth(accountType?: CreatorAccountType) {
  const profileType: ProfileType | undefined =
    accountType === "online_school" ? "school" : accountType === "course_creator" ? "creator" : undefined;
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await startGoogleOAuth(profileType);
    if (result.path) {
      navigate(result.path, { replace: true });
      return;
    }
    if (result.error) {
      toast.error(t(authErrorKeyFromUnknown(result.error)));
      setGoogleLoading(false);
    }
  };

  const sendMagic = async (address: string) => {
    const trimmed = address.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 3) {
      toast.error(t("invalidEmail"));
      return false;
    }
    setMagicLoading(true);
    const { error } = await sendCreatorMagicLink(trimmed, accountType);
    setMagicLoading(false);
    if (error) {
      toast.error(t(authErrorKeyFromUnknown(error)));
      return false;
    }
    setPendingEmail(trimmed);
    return true;
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMagic(email);
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    await sendMagic(pendingEmail);
  };

  return {
    email,
    setEmail,
    pendingEmail,
    setPendingEmail,
    googleLoading,
    magicLoading,
    busy: googleLoading || magicLoading,
    handleGoogle,
    handleMagicLink,
    handleResend,
  };
}
