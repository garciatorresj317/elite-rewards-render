import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider, LanguageSwitcher, useI18n } from "../i18n";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="error-screen">
      <div>
        <span>404</span>
        <h1>{t("That page wandered off.")}</h1>
        <p>{t("The reward you are looking for may have moved.")}</p>
        <Link to="/" className="button button-dark">
          {t("Return home")}
        </Link>
      </div>
    </div>
  );
}
function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    const reportableError = error instanceof Error ? error : new Error(String(error));
    reportLovableError(reportableError, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="error-screen">
      <div>
        <span>{t("Something went wrong")}</span>
        <h1>{t("This page did not load.")}</h1>
        <button
          className="button button-dark"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          {t("Try again")}
        </button>
      </div>
    </div>
  );
}
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Elite Rewards" },
      { name: "description", content: "A modern rewards program for growing businesses." },
      { name: "author", content: "Elite Rewards" },
      { name: "theme-color", content: "#050505" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <I18nProvider>
      <LanguageSwitcher />
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </I18nProvider>
  );
}
