import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

import { Loader2, GraduationCap, BookOpen } from "lucide-react";
import { toast } from "sonner";

const RoleSelection = () => {
  const navigate = useNavigate();
  const { user, setRole } = useSimpleAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelect = async (role: "student" | "creator") => {
    setIsLoading(true);
    const { error } = await setRole(role);
    
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (role === "student") {
      navigate("/dashboard");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">



      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">{t("selectRole")}</h1>
            <p className="text-muted-foreground mt-2">{user?.name}</p>
          </div>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors animate-fade-in"
            onClick={() => !isLoading && handleRoleSelect("student")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{t("student")}</h3>
                <p className="text-sm text-muted-foreground">{t("studentDescription")}</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors animate-fade-in"
            style={{ animationDelay: "100ms" }}
            onClick={() => !isLoading && handleRoleSelect("creator")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{t("courseCreator")}</h3>
                <p className="text-sm text-muted-foreground">{t("creatorDescription")}</p>
              </div>
            </CardContent>
          </Card>

          {isLoading && (
            <div className="flex justify-center pt-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RoleSelection;
