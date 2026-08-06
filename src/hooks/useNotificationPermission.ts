import { useEffect, useState, useCallback } from "react";

export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return "denied" as NotificationPermission;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.log("Could not request notification permission:", error);
      return "denied" as NotificationPermission;
    }
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== "granted") return;
    
    try {
      new Notification(title, {
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        ...options,
      });
    } catch (error) {
      console.log("Could not show notification:", error);
    }
  }, [isSupported, permission]);

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
  };
};

// Sound utilities for different notification types
export const playBookingSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Pleasant rising chime - C to E (major third)
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // First note - C5 (523 Hz)
    osc1.frequency.setValueAtTime(523, audioContext.currentTime);
    osc1.type = "sine";
    
    // Second note - E5 (659 Hz), starts slightly after
    osc2.frequency.setValueAtTime(659, audioContext.currentTime + 0.15);
    osc2.type = "sine";
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.25);
    osc2.start(audioContext.currentTime + 0.15);
    osc2.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log("Could not play booking sound:", error);
  }
};

export const playCancellationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Gentle descending tone - E to C (minor feel)
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(659, audioContext.currentTime); // E5
    osc.frequency.exponentialRampToValueAtTime(392, audioContext.currentTime + 0.3); // G4
    osc.type = "sine";
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.4);
  } catch (error) {
    console.log("Could not play cancellation sound:", error);
  }
};

export const playPaymentSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Celebratory arpeggio - C, E, G (major triad)
    const notes = [523, 659, 784]; // C5, E5, G5
    
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      const startTime = audioContext.currentTime + i * 0.1;
      
      osc.frequency.setValueAtTime(freq, startTime);
      osc.type = "sine";
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  } catch (error) {
    console.log("Could not play payment sound:", error);
  }
};

// Browser notification utility
export const showBrowserNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });
  } catch (error) {
    console.log("Could not show browser notification:", error);
  }
};
