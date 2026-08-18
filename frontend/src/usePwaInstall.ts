import { useState, useEffect, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
    deferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

// Global listener setup to ensure prompt is never lost across route navigations
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    window.__deferredPwaPrompt = e as BeforeInstallPromptEvent;
    window.deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
  });

  window.addEventListener("appinstalled", () => {
    window.__deferredPwaPrompt = null;
    window.deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa-installed"));
  });
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!(window.__deferredPwaPrompt || window.deferredPrompt);
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  });

  const isIOS = typeof window !== "undefined" && (
    (/iPad|iPhone|iPod/.test(navigator.userAgent)) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) && !(window as any).MSStream;

  useEffect(() => {
    const handlePromptReady = () => {
      setCanInstall(true);
    };

    const handleInstalled = () => {
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener("pwa-prompt-ready", handlePromptReady);
    window.addEventListener("pwa-installed", handleInstalled);

    const checkInstall = () => {
      if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true) {
        setIsInstalled(true);
      }
      if (window.__deferredPwaPrompt || window.deferredPrompt) {
        setCanInstall(true);
      }
    };

    checkInstall();
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener?.("change", checkInstall);

    return () => {
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
      window.removeEventListener("pwa-installed", handleInstalled);
      media.removeEventListener?.("change", checkInstall);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const promptEvent = window.__deferredPwaPrompt || window.deferredPrompt;
    if (!promptEvent) {
      return "unavailable";
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        window.__deferredPwaPrompt = null;
        window.deferredPrompt = null;
        setCanInstall(false);
        setIsInstalled(true);
      }
      return choice.outcome;
    } catch (e) {
      console.error("PWA install trigger error:", e);
      return "unavailable";
    }
  }, []);

  return { canInstall, isInstalled, isIOS, triggerInstall };
}
