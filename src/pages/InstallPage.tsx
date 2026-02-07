import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDeviceDetection, DeviceType } from "@/hooks/useDeviceDetection";
import { ArrowLeft, Smartphone, Monitor, ChevronDown, ChevronUp, Share, MoreVertical, Download } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const InstallPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const deviceType = useDeviceDetection();
  const [showOtherDevices, setShowOtherDevices] = useState(false);

  const devices: DeviceType[] = ["ios", "android", "desktop"];
  const otherDevices = devices.filter((d) => d !== deviceType);

  const getDeviceIcon = (device: DeviceType) => {
    switch (device) {
      case "ios":
        return <Smartphone className="w-6 h-6" />;
      case "android":
        return <Smartphone className="w-6 h-6" />;
      case "desktop":
        return <Monitor className="w-6 h-6" />;
    }
  };

  const getDeviceLabel = (device: DeviceType) => {
    switch (device) {
      case "ios":
        return t("forIOS");
      case "android":
        return t("forAndroid");
      case "desktop":
        return t("forDesktop");
    }
  };

  const getSteps = (device: DeviceType): { icon?: React.ReactNode; text: string }[] => {
    switch (device) {
      case "ios":
        return [
          { text: t("step1iOS") },
          { icon: <Share className="w-4 h-4 inline-block mx-1" />, text: t("step2iOS") },
          { text: t("step3iOS") },
          { text: t("step4iOS") },
        ];
      case "android":
        return [
          { text: t("step1Android") },
          { icon: <MoreVertical className="w-4 h-4 inline-block mx-1" />, text: t("step2Android") },
          { text: t("step3Android") },
        ];
      case "desktop":
        return [
          { icon: <Download className="w-4 h-4 inline-block mx-1" />, text: t("step1Desktop") },
          { text: t("step2Desktop") },
        ];
    }
  };

  const renderDeviceInstructions = (device: DeviceType, isCurrentDevice: boolean = false) => {
    const steps = getSteps(device);
    
    return (
      <Card className={`${isCurrentDevice ? "border-primary border-2" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {getDeviceIcon(device)}
            <div>
              <CardTitle className="text-lg">{getDeviceLabel(device)}</CardTitle>
              {isCurrentDevice && (
                <p className="text-sm text-primary font-medium">{t("yourDevice")}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm pt-0.5 flex items-center flex-wrap">
                  {step.icon}
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-14 px-4">
          <Button variant="ghost" size="sm" onClick={() => {
            try {
              navigate("/", { replace: true });
            } catch {
              window.location.href = "/";
            }
          }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("back")}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <Smartphone className="w-12 h-12 mx-auto mb-3 text-primary" />
          <h1 className="text-2xl font-bold">{t("installApp")}</h1>
          <p className="text-muted-foreground mt-2">{t("installInstructions")}</p>
        </div>

        <div className="space-y-4">
          {/* Current device instructions */}
          {renderDeviceInstructions(deviceType, true)}

          {/* Other devices */}
          <Collapsible open={showOtherDevices} onOpenChange={setShowOtherDevices}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>{t("otherDevices")}</span>
                {showOtherDevices ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              {otherDevices.map((device) => (
                <div key={device}>
                  {renderDeviceInstructions(device)}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </main>
    </div>
  );
};

export default InstallPage;
