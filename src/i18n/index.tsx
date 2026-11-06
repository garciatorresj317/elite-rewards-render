import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "es";
type Parameters = Record<string, string | number>;

type Translation = string | { one: string; other: string };

const STORAGE_KEY = "elite-rewards-locale";

const es: Record<string, Translation> = {
  "A modern rewards program for growing businesses.":
    "Un programa de recompensas moderno para negocios en crecimiento.",
  "Elite Rewards | Loyalty that feels personal": "Elite Rewards | Lealtad que se siente personal",
  "A modern rewards program that helps local businesses turn everyday customers into loyal regulars.":
    "Un programa de recompensas moderno que ayuda a los negocios locales a convertir clientes cotidianos en clientes leales.",
  "Sign in | Elite Rewards": "Iniciar sesión | Elite Rewards",
  "Initial setup | Elite Rewards": "Configuración inicial | Elite Rewards",
  "Activate client account | Elite Rewards": "Activar cuenta de cliente | Elite Rewards",
  "Activate member account | Elite Rewards": "Activar cuenta de miembro | Elite Rewards",
  "Join rewards | Elite Rewards": "Únete a recompensas | Elite Rewards",
  "Rewards program | Elite Rewards": "Programa de recompensas | Elite Rewards",
  "My wallet | Elite Rewards": "Mi billetera | Elite Rewards",
  Language: "Idioma",
  English: "English",
  Spanish: "Español",
  "Primary navigation": "Navegación principal",
  "How it works": "Cómo funciona",
  Features: "Funciones",
  Access: "Acceso",
  "Member sign in": "Acceso de miembros",
  "Business sign in": "Acceso para negocios",
  "Loyalty, made human": "Lealtad con un toque humano",
  "Turn a first visit into a": "Convierte una primera visita en un",
  "favorite habit.": "hábito favorito.",
  "Elite Rewards gives growing businesses a simple way to recognize their best customers, reward real loyalty, and bring people back.":
    "Elite Rewards ofrece a los negocios en crecimiento una forma sencilla de reconocer a sus mejores clientes, premiar la lealtad real y hacer que regresen.",
  "Open Elite Rewards": "Abrir Elite Rewards",
  "No app required": "No requiere aplicación",
  "Secure member access": "Acceso seguro para miembros",
  "Server-backed rewards ledger": "Registro de recompensas respaldado por el servidor",
  "Elite Rewards member wallet preview": "Vista previa de la billetera de miembro de Elite Rewards",
  Member: "Miembro",
  "Good afternoon, Maya": "Buenas tardes, Maya",
  points: "puntos",
  "160 points to go": "Faltan 160 puntos",
  "$15 reward": "Recompensa de $15",
  "Ready to use": "Lista para usar",
  "$5 off your next visit": "$5 de descuento en tu próxima visita",
  "Use reward": "Usar recompensa",
  visits: "visitas",
  rewards: "recompensas",
  "member since": "miembro desde",
  "new members": "miembros nuevos",
  "return rate": "tasa de retorno",
  "Built for the businesses people return to":
    "Creado para los negocios a los que la gente regresa",
  CAFÉS: "CAFETERÍAS",
  BOUTIQUES: "BOUTIQUES",
  SALONS: "SALONES",
  STUDIOS: "ESTUDIOS",
  "LOCAL RETAIL": "COMERCIO LOCAL",
  "Simple by design": "Simple por diseño",
  "Reward loyalty without adding more work.": "Premia la lealtad sin agregar más trabajo.",
  "From sign-up to redemption, every part of Elite Rewards is designed to feel effortless for your team and your customers.":
    "Desde el registro hasta el canje, cada parte de Elite Rewards está diseñada para ser sencilla para tu equipo y tus clientes.",
  "Join in seconds": "Únete en segundos",
  "One scan. No app download. Members start earning before they leave the counter.":
    "Un escaneo. Sin descargar una aplicación. Los miembros empiezan a ganar antes de salir del mostrador.",
  "Rewards they want": "Recompensas que desean",
  "Build flexible offers around visits, points, birthdays, or your best-selling items.":
    "Crea ofertas flexibles basadas en visitas, puntos, cumpleaños o tus artículos más vendidos.",
  "Know what works": "Descubre qué funciona",
  "See member growth, repeat visits, redemptions, and eligible sales in one clear view.":
    "Consulta el crecimiento de miembros, las visitas repetidas, los canjes y las ventas elegibles en una vista clara.",
  "A better reason to return": "Una mejor razón para regresar",
  "Make every customer feel like a regular.":
    "Haz que cada cliente se sienta como un cliente habitual.",
  "Sign in to manage members, post eligible purchases, and redeem rewards from the authoritative Elite Rewards ledger.":
    "Inicia sesión para administrar miembros, registrar compras elegibles y canjear recompensas desde el registro oficial de Elite Rewards.",
  "Sign in to Elite Rewards": "Iniciar sesión en Elite Rewards",
  "Thoughtful loyalty tools for growing businesses.":
    "Herramientas de lealtad bien diseñadas para negocios en crecimiento.",
  "Back to site": "Volver al sitio",
  "Secure access": "Acceso seguro",
  "Use your business or member account. Rewards balances are stored in the production ledger.":
    "Usa tu cuenta de negocio o de miembro. Los saldos de recompensas se guardan en el registro de producción.",
  Email: "Correo electrónico",
  Password: "Contraseña",
  "Signing in…": "Iniciando sesión…",
  "Sign in": "Iniciar sesión",
  "Initial setup is required. Open the private setup page and use the deployment setup token.":
    "Se requiere la configuración inicial. Abre la página privada de configuración y usa el token de configuración de implementación.",
  "One-time production setup": "Configuración única de producción",
  "Setup is complete": "La configuración está completa",
  "Create the first live program": "Crear el primer programa activo",
  "The one-time setup route is closed. Sign in with an existing account.":
    "La ruta de configuración única está cerrada. Inicia sesión con una cuenta existente.",
  "This creates one business, one location, and the owner account. Members are added after setup. This cannot be run twice.":
    "Esto crea un negocio, una ubicación y la cuenta del propietario. Los miembros se agregan después de la configuración. No se puede ejecutar dos veces.",
  "Deployment setup token": "Token de configuración de implementación",
  "Business name": "Nombre del negocio",
  "Location name": "Nombre de la ubicación",
  "Owner name": "Nombre del propietario",
  "Owner email": "Correo electrónico del propietario",
  "Owner password": "Contraseña del propietario",
  "Creating…": "Creando…",
  "Create production program": "Crear programa de producción",
  "Client activation": "Activación de cliente",
  "Activate your rewards program": "Activa tu programa de recompensas",
  "Create owner password": "Crear contraseña del propietario",
  "Confirm password": "Confirmar contraseña",
  "Activating…": "Activando…",
  "Activate owner account": "Activar cuenta del propietario",
  "Member activation": "Activación de miembro",
  "Activate your Elite Rewards wallet": "Activa tu billetera de Elite Rewards",
  "Create member password": "Crear contraseña de miembro",
  "Activate member wallet": "Activar billetera de miembro",
  "Already a member?": "¿Ya eres miembro?",
  "Member referral": "Referido de miembro",
  "Join {businessName}": "Únete a {businessName}",
  "Validating your secure referral link…": "Validando tu enlace seguro de referido…",
  "Referred member enrollment": "Registro de miembro referido",
  "Create your private rewards wallet. Your account starts at zero points; referral bonuses are not enabled unless the business publishes a policy.":
    "Crea tu billetera privada de recompensas. Tu cuenta comienza con cero puntos; los bonos por referidos no están habilitados a menos que el negocio publique una política.",
  "Full name": "Nombre completo",
  "I agree to the business rewards program terms and electronic account access.":
    "Acepto los términos del programa de recompensas del negocio y el acceso electrónico a la cuenta.",
  "Creating wallet…": "Creando billetera…",
  "Join rewards": "Unirme a recompensas",
  "Loyalty rewards": "Recompensas de lealtad",
  "Earn more every time you return.": "Gana más cada vez que regreses.",
  "Join {businessName} rewards, collect points, and unlock offers selected by this business.":
    "Únete a las recompensas de {businessName}, acumula puntos y desbloquea ofertas seleccionadas por este negocio.",
  "Open member wallet": "Abrir billetera de miembro",
  "NFC card destination": "Destino de la tarjeta NFC",
  "Available offers": "Ofertas disponibles",
  "Rewards worth coming back for": "Recompensas por las que vale la pena regresar",
  "No rewards are published right now.": "No hay recompensas publicadas en este momento.",
  pts: "pts",
  "Loading rewards program…": "Cargando programa de recompensas…",
  "Loading secure wallet…": "Cargando billetera segura…",
  "Wallet unavailable.": "La billetera no está disponible.",
  "Sign out": "Cerrar sesión",
  "Welcome back,": "Qué bueno verte de nuevo,",
  "Your balance is authoritative and updates from the live rewards ledger.":
    "Tu saldo es oficial y se actualiza desde el registro de recompensas en vivo.",
  "Available balance": "Saldo disponible",
  "Next milestone": "Próxima meta",
  "Reward catalog": "Catálogo de recompensas",
  "New rewards are coming soon.": "Pronto habrá nuevas recompensas.",
  "A reward is ready.": "Hay una recompensa lista.",
  "{count} points until your next reward": "Faltan {count} puntos para tu próxima recompensa",
  "Reward ready": "Recompensa lista",
  "{count} points": "{count} puntos",
  "Choose your perk": "Elige tu beneficio",
  "Rewards for you": "Recompensas para ti",
  "Reward history": "Historial de recompensas",
  "Keep earning": "Sigue acumulando",
  Redeem: "Canjear",
  "This business has not published an available reward yet. Check back soon.":
    "Este negocio aún no ha publicado una recompensa disponible. Vuelve pronto.",
  "Earn on your next visit": "Gana en tu próxima visita",
  "Show your unique member code at checkout.": "Muestra tu código único de miembro al pagar.",
  "Show member code": "Mostrar código de miembro",
  "Invite friends & family": "Invita a amigos y familiares",
  "Share your rewards link": "Comparte tu enlace de recompensas",
  "Friends can use your secure link to create a wallet for {businessName}.":
    "Tus amigos pueden usar tu enlace seguro para crear una billetera de {businessName}.",
  "Copy link": "Copiar enlace",
  "{count} joined referral": {
    one: "{count} referido se unió",
    other: "{count} referidos se unieron",
  },
  "Create my referral link": "Crear mi enlace de referido",
  "Active reward codes": "Códigos de recompensa activos",
  "No activity yet.": "Aún no hay actividad.",
  "Member code": "Código de miembro",
  "Only show this code to authorized staff at {locationName}.":
    "Muestra este código únicamente al personal autorizado de {locationName}.",
  Close: "Cerrar",
  "Live account": "Cuenta activa",
  "Go to sign in": "Ir a iniciar sesión",
  "{rewardName} redeemed. Code: {code}": "Canjeaste {rewardName}. Código: {code}",
  "Elite Rewards home": "Inicio de Elite Rewards",
  "Powered by Elite Rewards": "Con tecnología de Elite Rewards",
  "{businessName} logo": "Logotipo de {businessName}",
  "Special message": "Mensaje especial",
  "Always available": "Siempre disponible",
  Commemoration: "Conmemoración",
  Holiday: "Festividad",
  Event: "Evento",
  "Something went wrong": "Algo salió mal",
  "This page did not load.": "Esta página no cargó.",
  "Try again": "Intentar de nuevo",
  "That page wandered off.": "Esa página no se encuentra.",
  "The reward you are looking for may have moved.":
    "La recompensa que buscas puede haberse movido.",
  "Return home": "Volver al inicio",
  "Passwords do not match": "Las contraseñas no coinciden",
  "This client invitation is missing its secure token.":
    "A esta invitación de cliente le falta su token seguro.",
  "This member invitation is missing its secure token.":
    "A esta invitación de miembro le falta su token seguro.",
  "This referral link is incomplete.": "Este enlace de referido está incompleto.",
  "Invalid credentials or account temporarily locked":
    "Credenciales inválidas o cuenta bloqueada temporalmente",
  "Password must contain between 12 and 200 characters":
    "La contraseña debe contener entre 12 y 200 caracteres",
  "Cross-origin request rejected": "La solicitud fue rechazada por seguridad",
  "Logo not found": "No se encontró el logotipo",
  "API route not found": "No se encontró el servicio solicitado",
  "Internal server error": "Ocurrió un error interno del servidor",
  "Request failed": "La solicitud falló",
  "Request failed ({status})": "La solicitud falló ({status})",
  "Sign in failed": "No se pudo iniciar sesión",
  "Setup failed": "No se pudo completar la configuración",
  "Activation failed": "No se pudo completar la activación",
  "Referral unavailable": "El referido no está disponible",
  "Enrollment failed": "No se pudo completar el registro",
  "Client rewards page unavailable": "La página de recompensas del cliente no está disponible",
  "Wallet failed to load": "No se pudo cargar la billetera",
  "Redemption failed": "No se pudo canjear la recompensa",
  "Referral link unavailable": "El enlace de referido no está disponible",
  "Unable to complete the request. Please try again.":
    "No se pudo completar la solicitud. Inténtalo de nuevo.",
};

function interpolate(value: string, parameters?: Parameters) {
  if (!parameters) return value;
  return value.replace(/\{(\w+)\}/g, (match, key: string) => String(parameters[key] ?? match));
}

function translate(locale: Locale, key: string, parameters?: Parameters & { count?: number }) {
  if (locale === "en") return interpolate(key, parameters);
  const entry = es[key];
  if (!entry) return interpolate(key, parameters);
  const value =
    typeof entry === "string"
      ? entry
      : new Intl.PluralRules(locale).select(parameters?.count ?? 0) === "one"
        ? entry.one
        : entry.other;
  return interpolate(value, parameters);
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

function localizeDocument(locale: Locale) {
  document.documentElement.lang = locale;
  const candidates = [
    document.title,
    ...Array.from(
      document.querySelectorAll<HTMLMetaElement>(
        "meta[name='description'], meta[property='og:title'], meta[property='og:description']",
      ),
    ).map((node) => node.content),
  ];
  const englishKeyFor = (value: string) =>
    Object.keys(es).find(
      (key) => key === value || (typeof es[key] === "string" && es[key] === value),
    );
  const localized = candidates.map((value) => {
    const key = englishKeyFor(value);
    return key ? translate(locale, key) : value;
  });
  document.title = localized[0] ?? document.title;
  document
    .querySelectorAll<HTMLMetaElement>(
      "meta[name='description'], meta[property='og:title'], meta[property='og:description']",
    )
    .forEach((node, index) => {
      node.content = localized[index + 1] ?? node.content;
    });
}

const knownErrorPatterns: Array<[RegExp, string]> = [
  [/^Request failed \((\d{3})\)$/i, "Request failed ({status})"],
  [/passwords do not match/i, "Passwords do not match"],
  [
    /invalid credentials or account temporarily locked/i,
    "Invalid credentials or account temporarily locked",
  ],
  [
    /password must contain between 12 and 200 characters/i,
    "Password must contain between 12 and 200 characters",
  ],
  [/cross-origin request rejected/i, "Cross-origin request rejected"],
  [/logo not found/i, "Logo not found"],
  [/api route not found/i, "API route not found"],
  [/internal server error/i, "Internal server error"],
  [/request failed/i, "Request failed"],
];

function localizeError(locale: Locale, cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message.trim() : "";
  if (!message) return translate(locale, fallback);
  if (es[message]) return translate(locale, message);
  for (const [pattern, key] of knownErrorPatterns) {
    const match = message.match(pattern);
    if (match) return translate(locale, key, match[1] ? { status: match[1] } : undefined);
  }
  return translate(locale, fallback || "Unable to complete the request. Please try again.");
}

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, parameters?: Parameters & { count?: number }) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  errorMessage: (cause: unknown, fallback: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => setLocaleState(getStoredLocale()), []);
  useEffect(() => localizeDocument(locale), [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The language still changes for this page when storage is unavailable.
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (key: string, parameters?: Parameters & { count?: number }) =>
      translate(locale, key, parameters);
    const formatNumber = (number: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(number);
    const formatDateTime = (date: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(
        locale,
        options ?? { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(date));
    const errorMessage = (cause: unknown, fallback: string) =>
      localizeError(locale, cause, fallback);
    return { locale, setLocale, t, formatNumber, formatDateTime, errorMessage };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-switcher" role="group" aria-label={t("Language")}>
      <button
        type="button"
        lang="en"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        English
      </button>
      <button
        type="button"
        lang="es"
        aria-pressed={locale === "es"}
        onClick={() => setLocale("es")}
      >
        Español
      </button>
    </div>
  );
}
