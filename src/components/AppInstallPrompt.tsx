import { Download, MoreVertical, Share, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n";
import { isStandaloneDisplay } from "@/lib/pwa";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

function isAppleMobileDevice() {
  if (typeof window === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}

export function AppInstallPrompt() {
  const { t } = useI18n();
  const titleId = useId();
  const dialog = useRef<HTMLDivElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setAppleMobile(isAppleMobileDevice());
    setReady(true);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showHelp) return;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = trigger.current;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowHelp(false);
      if (event.key === "Tab" && dialog.current) {
        const focusable = Array.from(
          dialog.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => triggerElement?.focus());
    };
  }, [showHelp]);

  const beginInstall = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  if (!ready || installed) return null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="app-install-button"
        onClick={() => void beginInstall()}
        aria-haspopup={installPrompt ? undefined : "dialog"}
      >
        <Download aria-hidden="true" />
        <span>{t("Add Elite Rewards to home screen")}</span>
      </button>

      {showHelp &&
        createPortal(
          <div
            className="modal-backdrop app-install-backdrop"
            onMouseDown={() => setShowHelp(false)}
          >
            <div
              ref={dialog}
              className="app-install-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                ref={closeButton}
                type="button"
                className="modal-close"
                onClick={() => setShowHelp(false)}
                aria-label={t("Close install instructions")}
              >
                <X />
              </button>
              <img src="/pwa/icon-192.png" alt="" className="app-install-icon" />
              <span className="section-kicker">{t("Elite Rewards app")}</span>
              <h2 id={titleId}>{t("Add Elite Rewards to your home screen")}</h2>
              <p>
                {t(
                  "Open the Elite Rewards Dashboard like an app with the official Elite Rewards logo on your phone or tablet.",
                )}
              </p>
              <ol className="app-install-steps">
                {appleMobile ? (
                  <>
                    <li>
                      <Share aria-hidden="true" />
                      <span>{t("In Safari, tap the Share button.")}</span>
                    </li>
                    <li>
                      <Download aria-hidden="true" />
                      <span>{t("Choose Add to Home Screen, then tap Add.")}</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <MoreVertical aria-hidden="true" />
                      <span>{t("Open your browser menu.")}</span>
                    </li>
                    <li>
                      <Download aria-hidden="true" />
                      <span>{t("Choose Install app or Add to Home screen.")}</span>
                    </li>
                  </>
                )}
              </ol>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setShowHelp(false)}
              >
                {t("Got it")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
