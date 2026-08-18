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

export interface PwaDiagnostics {
  isSecureContext: boolean;
  isLocalhost: boolean;
  isHttps: boolean;
  origin: string;
  hostname: string;
  swRegistered: boolean;
  swControlling: boolean;
  manifestLoaded: boolean;
  manifestError: string | null;
  promptReceived: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  isIOS: boolean;
}

// Global listener setup to ensure prompt is never lost across route navigations
if (typeof window !== "undefined") {
  console.log(`PWA: [Diagnostics Init] isSecureContext: ${window.isSecureContext}, Protocol: ${window.location.protocol}, Host: ${window.location.hostname}`);
  
  if (!window.isSecureContext) {
    console.warn(`PWA Warning: Application is running in an INSECURE context (${window.location.origin}). Chromium browsers strictly require HTTPS or localhost (127.0.0.1) for 'beforeinstallprompt' to fire.`);
  }

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    console.log("PWA: beforeinstallprompt fired");
    window.__deferredPwaPrompt = e as BeforeInstallPromptEvent;
    window.deferredPrompt = e as BeforeInstallPromptEvent;
    console.log("PWA: install prompt stored");
    window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
  });

  window.addEventListener("appinstalled", () => {
    console.log("PWA: appinstalled fired");
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

  const [promptReceived, setPromptReceived] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!(window.__deferredPwaPrompt || window.deferredPrompt);
  });

  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [swControlling, setSwControlling] = useState<boolean>(false);
  const [manifestLoaded, setManifestLoaded] = useState<boolean>(false);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const isIOS = typeof window !== "undefined" && (
    (/iPad|iPhone|iPod/.test(navigator.userAgent)) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) && !(window as any).MSStream;

  const isSecureContext = typeof window !== "undefined" ? !!window.isSecureContext : false;
  const isLocalhost = typeof window !== "undefined" ? ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) : false;
  const isHttps = typeof window !== "undefined" ? window.location.protocol === "https:" : false;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  // Diagnostic checks
  useEffect(() => {
    // 1. Check Service Worker status
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          setSwRegistered(true);
          console.log("PWA: Service Worker registration active:", reg.scope);
        } else {
          setSwRegistered(false);
          console.log("PWA: No active Service Worker registration yet.");
        }
      }).catch((err) => {
        console.error("PWA: Service Worker check error:", err);
      });

      setSwControlling(!!navigator.serviceWorker.controller);

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setSwControlling(!!navigator.serviceWorker.controller);
        console.log("PWA: Service Worker controller changed, controlling:", !!navigator.serviceWorker.controller);
      });
    }

    // 2. Check Manifest
    fetch("/manifest.webmanifest")
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error(`Manifest HTTP status ${res.status}`);
      })
      .then((data) => {
        setManifestLoaded(true);
        console.log("PWA: Web App Manifest loaded successfully:", data.name);
      })
      .catch((err) => {
        setManifestLoaded(false);
        setManifestError(err.message);
        console.warn("PWA: Manifest fetch warning:", err.message);
      });

    // 3. Event listeners
    const handlePromptReady = () => {
      setPromptReceived(true);
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
        setPromptReceived(true);
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
    console.log("PWA: install button clicked");
    const promptEvent = window.__deferredPwaPrompt || window.deferredPrompt;

    if (!promptEvent) {
      if (!isSecureContext) {
        console.warn("PWA: no deferred install prompt available - Reason: Insecure Context (HTTP on LAN IP). Must use HTTPS or localhost.");
      } else if (isInstalled) {
        console.log("PWA: no deferred install prompt available - Reason: App is already installed.");
      } else {
        console.warn("PWA: no deferred install prompt available - Reason: Event has not fired yet from browser.");
      }
      return "unavailable";
    }

    try {
      console.log("PWA: native prompt opened");
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      console.log(`PWA: installation ${choice.outcome}`);
      
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
  }, [isSecureContext, isInstalled]);

  const diagnostics: PwaDiagnostics = {
    isSecureContext,
    isLocalhost,
    isHttps,
    origin,
    hostname,
    swRegistered,
    swControlling,
    manifestLoaded,
    manifestError,
    promptReceived,
    isInstalled,
    canInstall,
    isIOS
  };

  return { canInstall, isInstalled, isIOS, triggerInstall, diagnostics };
}
