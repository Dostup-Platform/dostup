import { useState, useEffect } from "react";

export function usePWADetection(): boolean {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    const checkPWA = () => {
      // Check display-mode media query
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // Check iOS standalone mode
      const isIOSStandalone = (navigator as any).standalone === true;
      
      // Check if launched from home screen on Android
      const isAndroidTWA = document.referrer.includes('android-app://');
      
      setIsInstalled(isStandalone || isIOSStandalone || isAndroidTWA);
    };

    checkPWA();

    // Listen for changes (in case user installs while on page)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isInstalled;
}
