import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Package, ArrowRight } from "lucide-react";

const Index = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("welcome")}</h1>
        </div>

        <div className="space-y-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <Link to="/product/demo" className="flex items-center justify-between p-5">
                <div>
                  <h3 className="font-semibold text-foreground">{t("viewDemoProduct")}</h3>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <Link to="/dashboard" className="flex items-center justify-between p-5">
                <div>
                  <h3 className="font-semibold text-foreground">{t("goToDashboard")}</h3>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-primary/20">
            <CardContent className="p-0">
              <Link to="/creator" className="flex items-center justify-between p-5">
                <div>
                  <h3 className="font-semibold text-foreground">{t("creatorPanel")}</h3>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
