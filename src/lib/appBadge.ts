/**
 * App Badge API utilities for PWA
 * Shows notification count on the app icon on mobile devices
 */

/**
 * Check if App Badge API is supported
 */
export const isAppBadgeSupported = (): boolean => {
  return "setAppBadge" in navigator;
};

/**
 * Set the app badge count
 * @param count - Number to display on the app icon (0 clears the badge)
 */
export const setAppBadge = async (count: number): Promise<boolean> => {
  if (!isAppBadgeSupported()) {
    console.log("App Badge API not supported");
    return false;
  }

  try {
    if (count > 0) {
      await (navigator as any).setAppBadge(count);
      console.log(`App badge set to ${count}`);
    } else {
      await (navigator as any).clearAppBadge();
      console.log("App badge cleared");
    }
    return true;
  } catch (error) {
    console.error("Error setting app badge:", error);
    return false;
  }
};

/**
 * Clear the app badge
 */
export const clearAppBadge = async (): Promise<boolean> => {
  return setAppBadge(0);
};

/**
 * Increment app badge by 1
 * Note: We can't read current badge, so caller must track count
 */
export const incrementAppBadge = async (currentCount: number): Promise<boolean> => {
  return setAppBadge(currentCount + 1);
};
