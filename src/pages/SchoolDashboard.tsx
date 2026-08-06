import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  School, Users, GraduationCap, Layers, Calendar, BookOpen,
  ClipboardList, ListChecks, BarChart3, Lock, Bell, LogOut,
} from "lucide-react";

const SchoolDashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [creatorName, setCreatorName] = useState<string>("");

  useEffect(() => {
    const name = localStorage.getItem("creator_name");
    const type = localStorage.getItem("creator_account_type");
    if (!name || type !== "online_school") {
      navigate("/");
      return;
    }
    setCreatorName(name);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.setItem("creator_last_name", creatorName);
    localStorage.removeItem("creator_name");
    localStorage.removeItem("creator_token");
    localStorage.removeItem("creator_account_type");
    localStorage.removeItem("creator_created_at");
    navigate("/");
  };

  const features = [
    { icon: Users, label: t("schoolFeatureStudents") },
    { icon: GraduationCap, label: t("schoolFeatureTeachers") },
    { icon: Layers, label: t("schoolFeatureGroups") },
    { icon: Calendar, label: t("schoolFeatureSchedule") },
    { icon: BookOpen, label: t("schoolFeatureMaterials") },
    { icon: ClipboardList, label: t("schoolFeatureHomework") },
    { icon: ListChecks, label: t("schoolFeatureTests") },
    { icon: BarChart3, label: t("schoolFeatureAnalytics") },
    { icon: Lock, label: t("schoolFeatureAccess") },
    { icon: Bell, label: t("schoolFeatureNotifications") },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <School className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t("onlineSchoolMode")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{creatorName}</p>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-lg font-medium">{t("schoolComingSoonTitle")}</p>
            <p className="text-sm text-muted-foreground">
              {t("schoolComingSoonDescription")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("schoolFeaturesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
};

export default SchoolDashboard;