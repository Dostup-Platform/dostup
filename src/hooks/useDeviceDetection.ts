export type DeviceType = "ios" | "android" | "desktop";

export function useDeviceDetection(): DeviceType {
  if (typeof navigator === "undefined") {
    return "desktop";
  }
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for iOS devices
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "ios";
  }
  
  // Check for Android devices
  if (/android/.test(userAgent)) {
    return "android";
  }
  
  return "desktop";
}
