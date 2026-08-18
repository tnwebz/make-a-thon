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
  }
}

// Global listener setup to ensure prompt is never lost across route navigations
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    window.__deferredPwaPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
  });

  window.addEventListener("appinstalled", () => {
    window.__deferredPwaPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa-installed"));
  });
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState<boolean>(() => !!window.__deferredPwaPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  });

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

    if (window.__deferredPwaPrompt) {
      setCanInstall(true);
    }

    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
      window.removeEventListener("pwa-installed", handleInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const promptEvent = window.__deferredPwaPrompt;
    if (!promptEvent) {
      return "unavailable";
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        window.__deferredPwaPrompt = null;
        setCanInstall(false);
        setIsInstalled(true);
      }
      return choice.outcome;
    } catch (e) {
      console.error("PWA install trigger error:", e);
      return "unavailable";
    }
  }, []);

  return { canInstall, isInstalled, triggerInstall };
}
