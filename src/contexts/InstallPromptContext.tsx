import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  dismissInstallBanner,
  isAppInstalled,
  isInstallBannerDevPreview,
  isInstallBannerDismissed,
  isIosSafari,
  type BeforeInstallPromptEvent,
} from "@/lib/installPrompt";

type InstallPromptContextValue = {
  visible: boolean;
  devPreview: boolean;
  iosSheetOpen: boolean;
  setIosSheetOpen: (open: boolean) => void;
  handleInstall: () => Promise<void>;
  handleDismiss: () => void;
};

const InstallPromptContext = createContext<InstallPromptContextValue | undefined>(undefined);

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const devPreview = isInstallBannerDevPreview();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosSafari, setIosSafari] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    devPreview ? false : isInstallBannerDismissed(),
  );
  const [installed, setInstalled] = useState(isAppInstalled);
  const [isMobile, setIsMobile] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  useEffect(() => {
    setIosSafari(isIosSafari());

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const updateMobile = () => setIsMobile(mobileQuery.matches);
    updateMobile();
    mobileQuery.addEventListener("change", updateMobile);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(isAppInstalled());
    updateInstalled();
    standaloneQuery.addEventListener("change", updateInstalled);

    return () => {
      mobileQuery.removeEventListener("change", updateMobile);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      standaloneQuery.removeEventListener("change", updateInstalled);
    };
  }, []);

  const canOffer = deferredPrompt !== null || iosSafari;
  const visible =
    (devPreview && !dismissed) || (isMobile && !installed && !dismissed && canOffer);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    if (iosSafari || devPreview) {
      setIosSheetOpen(true);
    }
  }, [deferredPrompt, devPreview, iosSafari]);

  const handleDismiss = useCallback(() => {
    if (!devPreview) {
      dismissInstallBanner();
    }
    setDismissed(true);
  }, [devPreview]);

  const value = useMemo(
    () => ({
      visible,
      devPreview,
      iosSheetOpen,
      setIosSheetOpen,
      handleInstall,
      handleDismiss,
    }),
    [visible, devPreview, iosSheetOpen, handleInstall, handleDismiss],
  );

  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>;
}

export function useInstallPrompt() {
  const context = useContext(InstallPromptContext);
  if (!context) {
    throw new Error("useInstallPrompt must be used within InstallPromptProvider");
  }
  return context;
}
