import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Award,
  Building2,
  CalendarClock,
  Check,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  Palette,
  Pencil,
  Plus,
  KeyRound,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Trophy,
  Users,
  UserPlus,
  Upload,
  X,
} from "lucide-react";
import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BusinessBrand } from "@/components/BusinessBrand";
import { ExperienceBackdrop } from "@/components/ExperienceTheme";
import { useI18n } from "@/i18n";
import { themeCatalog } from "@/lib/theme-catalog";
import { CLIENT_LOGO_MAX_BYTES, CLIENT_LOGO_MAX_MEGABYTES } from "@/lib/upload-limits";
import {
  api,
  type ClientBrandingDraft,
  type ClientSummary,
  type DashboardData,
  type ManagedProduct,
  type ManagedReward,
  type MemberSummary,
  type PasswordResetRequest,
  type ProductDraft,
  type RewardDraft,
  type SessionUser,
  type ThemeKey,
  type VisualSettings,
} from "@/lib/api-client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Business dashboard | Elite Rewards" }] }),
  component: Admin,
});
const sections = [
  { id: "Dashboard", en: "Dashboard", es: "Panel", icon: LayoutDashboard, platformOnly: false },
  { id: "Clients", en: "Clients", es: "Clientes", icon: Building2, platformOnly: true },
  {
    id: "Password resets",
    en: "Password resets",
    es: "Contraseñas",
    icon: KeyRound,
    platformOnly: true,
  },
  { id: "Members", en: "Members", es: "Miembros", icon: Users, platformOnly: false },
  {
    id: "Transactions",
    en: "Transactions",
    es: "Transacciones",
    icon: ReceiptText,
    platformOnly: false,
  },
  { id: "Rewards", en: "Rewards", es: "Recompensas", icon: Trophy, platformOnly: false },
  { id: "Products", en: "Products", es: "Productos", icon: PackageOpen, platformOnly: false },
  {
    id: "Appearance",
    en: "Appearance",
    es: "Apariencia",
    icon: Palette,
    platformOnly: false,
  },
] as const;

type SectionId = (typeof sections)[number]["id"];

type TranslatePair = (english: string, spanish: string) => string;

function localizeStatus(status: string, tr: TranslatePair) {
  const labels: Record<string, [string, string]> = {
    active: ["Active", "Activo"],
    invited: ["Invited", "Invitado"],
    suspended: ["Suspended", "Suspendido"],
    hidden: ["Hidden", "Oculta"],
    archived: ["Archived", "Archivada"],
  };
  const label = labels[status];
  return label ? tr(label[0], label[1]) : status;
}

function themeSpanish(key: ThemeKey) {
  const translations: Record<ThemeKey, { name: string; category: string; description: string }> = {
    "elite-signature": {
      name: "Firma Elite",
      category: "Siempre disponible",
      description: "La experiencia base negra y dorada de Elite Rewards.",
    },
    "mlk-day": {
      name: "Día de Martin Luther King Jr.",
      category: "Conmemoración",
      description: "Un tema digno centrado en la unidad, la esperanza y el progreso.",
    },
    "remembrance-911": {
      name: "Conmemoración del 11 de septiembre",
      category: "Conmemoración",
      description: "Un homenaje sobrio y respetuoso con dos luces conmemorativas.",
    },
    "winter-holiday": {
      name: "Festividad de invierno",
      category: "Festividad",
      description: "Una celebración invernal inclusiva en verde perenne y dorado.",
    },
    "spring-celebration": {
      name: "Celebración de primavera",
      category: "Festividad",
      description: "Un fondo de temporada refinado con flores marfil y luz dorada.",
    },
    "community-event": {
      name: "Evento comunitario",
      category: "Evento",
      description: "Una escena flexible para eventos locales y fechas especiales.",
    },
  };
  return translations[key];
}

function Admin() {
  const navigate = useNavigate();
  const { locale, formatDateTime, formatNumber } = useI18n();
  const tr = useCallback(
    (english: string, spanish: string) => (locale === "es" ? spanish : english),
    [locale],
  );
  const localeCode = locale === "es" ? "es-US" : "en-US";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);
  const [passwordResetBusyId, setPasswordResetBusyId] = useState<string | null>(null);
  const [passwordResetLink, setPasswordResetLink] = useState("");
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [active, setActive] = useState<SectionId>("Dashboard");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [clientEditor, setClientEditor] = useState<ClientSummary | null>(null);
  const [clientRewards, setClientRewards] = useState<ManagedReward[]>([]);
  const [clientRewardEditingId, setClientRewardEditingId] = useState<string | null>(null);
  const [clientProducts, setClientProducts] = useState<ManagedProduct[]>([]);
  const [clientProductEditingId, setClientProductEditingId] = useState<string | null>(null);
  const [clientProductDraft, setClientProductDraft] = useState<ProductDraft>({
    name: "",
    description: "",
    category: "",
    priceCents: 0,
    pointsCost: 100,
    visitsCost: 10,
    imageUrl: null,
    purchaseUrl: null,
    active: true,
  });
  const [clientProductImage, setClientProductImage] = useState<File | null>(null);
  const [clientRewardDraft, setClientRewardDraft] = useState<RewardDraft>({
    name: "",
    description: "",
    points: 100,
    visits: 10,
    active: true,
    inventoryRemaining: null,
  });
  const [clientBranding, setClientBranding] = useState<ClientBrandingDraft>({
    name: "",
    locationName: "",
    logoUrl: null,
    primaryColor: "#F6B900",
    secondaryColor: "#FFE27A",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandingResetting, setBrandingResetting] = useState(false);
  const [clientVisualSettings, setClientVisualSettings] = useState<VisualSettings | null>(null);
  const [clientVisualDraft, setClientVisualDraft] = useState({
    themeKey: "elite-signature" as ThemeKey,
    occasionTitle: "",
    occasionMessage: "",
    automaticHolidayThemes: false,
    timeZone: "UTC",
  });
  const [clientStatusBusyId, setClientStatusBusyId] = useState<string | null>(null);
  const [loyaltyModeBusy, setLoyaltyModeBusy] = useState(false);
  const [activationPath, setActivationPath] = useState("");
  const [memberModal, setMemberModal] = useState(false);
  const [memberActivationPath, setMemberActivationPath] = useState("");
  const [managedRewards, setManagedRewards] = useState<ManagedReward[]>([]);
  const [managedProducts, setManagedProducts] = useState<ManagedProduct[]>([]);
  const [productModal, setProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductDraft>({
    name: "",
    description: "",
    category: "",
    priceCents: 0,
    pointsCost: 100,
    visitsCost: 10,
    imageUrl: null,
    purchaseUrl: null,
    active: true,
  });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [rewardModal, setRewardModal] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [visualSettings, setVisualSettings] = useState<VisualSettings | null>(null);
  const [visualDraft, setVisualDraft] = useState({
    themeKey: "elite-signature" as ThemeKey,
    occasionTitle: "",
    occasionMessage: "",
    automaticHolidayThemes: false,
    timeZone: "UTC",
  });
  const [award, setAward] = useState({
    memberId: "",
    amount: "",
    points: "",
    note: locale === "es" ? "Compra elegible" : "Eligible purchase",
  });
  const [clientForm, setClientForm] = useState({
    businessName: "",
    locationName: "",
    ownerName: "",
    ownerEmail: "",
  });
  const [memberForm, setMemberForm] = useState({ name: "", email: "" });
  const [rewardForm, setRewardForm] = useState<RewardDraft>({
    name: "",
    description: "",
    points: 100,
    visits: 10,
    active: true,
    inventoryRemaining: null,
  });
  const load = useCallback(async () => {
    setBusy(true);
    setInitialLoadFailed(false);
    try {
      const session = await api.session();
      if (!session.user || session.user.role === "member") {
        await navigate({ to: "/login" });
        return;
      }
      setUser(session.user);
      const [
        dashboard,
        clientResult,
        passwordResetResult,
        memberResult,
        visualResult,
        rewardResult,
        productResult,
      ] = await Promise.all([
        api.dashboard(),
        session.user.platformAdmin ? api.clients() : Promise.resolve({ clients: [] }),
        session.user.platformAdmin
          ? api.passwordResetRequests()
          : Promise.resolve({ requests: [] as PasswordResetRequest[] }),
        api.members(),
        api.visualSettings(),
        session.user.role === "owner"
          ? api.managedRewards()
          : Promise.resolve({ rewards: [] as ManagedReward[] }),
        api.managedProducts(),
      ]);
      setData(dashboard);
      setClients(clientResult.clients);
      setPasswordResetRequests(passwordResetResult.requests);
      setMembers(memberResult.members);
      setVisualSettings(visualResult);
      setManagedRewards(rewardResult.rewards);
      setManagedProducts(productResult.products);
      setVisualDraft({
        themeKey: visualResult.configuredThemeKey,
        occasionTitle: visualResult.configuredOccasionTitle,
        occasionMessage: visualResult.configuredOccasionMessage,
        automaticHolidayThemes: visualResult.automaticHolidayThemes,
        timeZone: visualResult.timeZone,
      });
      const firstMember = dashboard.members[0];
      if (!award.memberId && firstMember)
        setAward((current) => ({ ...current, memberId: firstMember.id }));
    } catch (cause) {
      setError(tr("Dashboard failed to load", "No se pudo cargar el panel"));
      setInitialLoadFailed(true);
    } finally {
      setBusy(false);
    }
  }, [award.memberId, navigate, tr]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    document.title = tr("Business dashboard | Elite Rewards", "Panel del negocio | Elite Rewards");
  }, [tr]);
  const submitAward = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await api.award({
        memberId: award.memberId,
        amountCents: Math.round(Number(award.amount) * 100),
        units: Number(award.points),
        note: award.note,
      });
      setModal(false);
      setNotice(
        tr(
          data?.business.loyalty_mode === "visits"
            ? "Visits were added to the production ledger."
            : "Points were added to the production ledger.",
          data?.business.loyalty_mode === "visits"
            ? "Las visitas se agregaron al registro de producción."
            : "Los puntos se agregaron al registro de producción.",
        ),
      );
      await load();
    } catch (cause) {
      setError(tr("Award failed", "No se pudo registrar la recompensa"));
    }
  };
  const submitClient = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api.createClient(clientForm);
      setClients((current) => [...current, result.client]);
      setActivationPath(result.activationPath);
      setNotice(tr(`${result.client.name} was added.`, `Se agregó ${result.client.name}.`));
      setClientForm({ businessName: "", locationName: "", ownerName: "", ownerEmail: "" });
    } catch (cause) {
      setError(tr("Client creation failed", "No se pudo crear el cliente"));
    }
  };
  const issuePasswordReset = async (request: PasswordResetRequest) => {
    setError("");
    setPasswordResetLink("");
    try {
      setPasswordResetBusyId(request.id);
      const result = await api.issuePasswordReset(request.id);
      setPasswordResetLink(`${window.location.origin}${result.resetPath}`);
      setPasswordResetRequests((current) => current.filter((item) => item.id !== request.id));
      setNotice(
        tr(
          `A private password reset link was created for ${request.userName}.`,
          `Se creó un enlace privado para restablecer la contraseña de ${request.userName}.`,
        ),
      );
    } catch {
      setError(
        tr(
          "Password reset link could not be created.",
          "No se pudo crear el enlace para restablecer la contraseña.",
        ),
      );
    } finally {
      setPasswordResetBusyId(null);
    }
  };
  const toggleClientActive = async (client: ClientSummary) => {
    const activate = client.status === "suspended";
    const confirmed = window.confirm(
      activate
        ? tr(
            `Activate ${client.name}? Its owners, staff, members, public page, and enrollment links will work again.`,
            `¿Activar ${client.name}? Sus propietarios, personal, miembros, página pública y enlaces de inscripción volverán a funcionar.`,
          )
        : tr(
            `Suspend ${client.name}? Access and enrollment will stop immediately, but all client data will be preserved.`,
            `¿Suspender ${client.name}? El acceso y la inscripción se detendrán de inmediato, pero se conservarán todos los datos del cliente.`,
          ),
    );
    if (!confirmed) return;
    setError("");
    try {
      setClientStatusBusyId(client.id);
      const result = await api.setClientActive(client.id, activate);
      setClients((current) =>
        current.map((item) => (item.id === result.client.id ? result.client : item)),
      );
      setNotice(
        activate
          ? tr(`${client.name} was activated.`, `Se activó ${client.name}.`)
          : tr(`${client.name} was suspended.`, `Se suspendió ${client.name}.`),
      );
    } catch {
      setError(
        activate
          ? tr("Client activation failed", "No se pudo activar el cliente")
          : tr("Client suspension failed", "No se pudo suspender el cliente"),
      );
    } finally {
      setClientStatusBusyId(null);
    }
  };
  const openClientEditor = async (client: ClientSummary) => {
    setError("");
    // Open from the already-authorized client summary first. Optional catalog or
    // appearance failures must not make the entire branding editor unusable.
    setClientEditor(client);
    setClientBranding({
      name: client.name,
      locationName: client.locationName,
      logoUrl: client.logoUrl,
      primaryColor: client.primaryColor,
      secondaryColor: client.secondaryColor,
    });
    setClientRewards([]);
    setClientProducts([]);
    setClientVisualSettings(null);
    setClientRewardEditingId(null);
    setClientProductEditingId(null);
    setClientProductDraft(emptyProductForm());
    setClientRewardDraft({
      name: "",
      description: "",
      points: 100,
      active: true,
      inventoryRemaining: null,
    });

    const [brandingResult, rewardsResult, productsResult, appearanceResult, loyaltyResult] =
      await Promise.allSettled([
        api.clientBranding(client.id),
        api.clientRewards(client.id),
        api.clientProducts(client.id),
        api.clientVisualSettings(client.id),
        api.clientLoyaltySettings(client.id),
      ]);

    if (brandingResult.status === "fulfilled") {
      const { branding } = brandingResult.value;
      setClientBranding({
        name: branding.name,
        locationName: branding.locationName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      });
    }
    if (rewardsResult.status === "fulfilled") setClientRewards(rewardsResult.value.rewards);
    if (productsResult.status === "fulfilled") setClientProducts(productsResult.value.products);
    if (appearanceResult.status === "fulfilled") {
      const clientAppearance = appearanceResult.value;
      setClientVisualSettings(clientAppearance);
      setClientVisualDraft({
        themeKey: clientAppearance.configuredThemeKey,
        occasionTitle: clientAppearance.configuredOccasionTitle,
        occasionMessage: clientAppearance.configuredOccasionMessage,
        automaticHolidayThemes: clientAppearance.automaticHolidayThemes,
        timeZone: clientAppearance.timeZone,
      });
    }
    if (loyaltyResult.status === "fulfilled") {
      setClientEditor((current) =>
        current ? { ...current, loyaltyMode: loyaltyResult.value.loyaltyMode } : current,
      );
    }

    const failedSections = [
      brandingResult.status === "rejected" ? tr("branding", "marca") : null,
      rewardsResult.status === "rejected" ? tr("rewards", "recompensas") : null,
      productsResult.status === "rejected" ? tr("products", "productos") : null,
      appearanceResult.status === "rejected" ? tr("appearance", "apariencia") : null,
      loyaltyResult.status === "rejected" ? tr("loyalty model", "modelo de lealtad") : null,
    ].filter((section): section is string => Boolean(section));
    if (failedSections.length) {
      setError(
        tr(
          `The client editor opened, but these sections could not load: ${failedSections.join(", ")}. Refresh and try again.`,
          `El editor del cliente se abrió, pero no se pudieron cargar estas secciones: ${failedSections.join(", ")}. Actualiza la página e inténtalo de nuevo.`,
        ),
      );
    }
  };
  const saveClientBranding = async () => {
    if (!clientEditor) return;
    setError("");
    try {
      const result = await api.updateClientBranding(clientEditor.id, clientBranding);
      setClients((current) =>
        current.map((client) =>
          client.id === clientEditor.id
            ? {
                ...client,
                name: result.branding.name,
                locationName: result.branding.locationName,
                logoUrl: result.branding.logoUrl,
                primaryColor: result.branding.primaryColor,
                secondaryColor: result.branding.secondaryColor,
              }
            : client,
        ),
      );
      setNotice(
        tr(
          `${result.branding.name} branding was published.`,
          `Se publicó la marca de ${result.branding.name}.`,
        ),
      );
      setClientEditor(null);
    } catch (cause) {
      setError(tr("Client customization failed", "No se pudo personalizar el cliente"));
    }
  };
  const saveClientAppearance = async () => {
    if (!clientEditor) return;
    setError("");
    try {
      const saved = await api.updateClientVisualSettings(clientEditor.id, clientVisualDraft);
      setClientVisualSettings(saved);
      setClientVisualDraft({
        themeKey: saved.configuredThemeKey,
        occasionTitle: saved.configuredOccasionTitle,
        occasionMessage: saved.configuredOccasionMessage,
        automaticHolidayThemes: saved.automaticHolidayThemes,
        timeZone: saved.timeZone,
      });
      setNotice(
        tr(
          `${clientEditor.name} holiday theme settings were published.`,
          `Se publicaron los ajustes de temas festivos de ${clientEditor.name}.`,
        ),
      );
    } catch {
      setError(
        tr("Client appearance update failed", "No se pudo actualizar la apariencia del cliente"),
      );
    }
  };
  const saveLoyaltyMode = async (loyaltyMode: "points" | "visits") => {
    setError("");
    setLoyaltyModeBusy(true);
    try {
      if (clientEditor) {
        const saved = await api.updateClientLoyaltySettings(clientEditor.id, loyaltyMode);
        setClientEditor({ ...clientEditor, loyaltyMode: saved.loyaltyMode });
        setClients((current) =>
          current.map((client) =>
            client.id === clientEditor.id ? { ...client, loyaltyMode: saved.loyaltyMode } : client,
          ),
        );
      } else {
        const saved = await api.updateLoyaltySettings(loyaltyMode);
        setData((current) =>
          current
            ? { ...current, business: { ...current.business, loyalty_mode: saved.loyaltyMode } }
            : current,
        );
      }
      setNotice(
        loyaltyMode === "visits"
          ? tr("The rewards program now runs on visits.", "El programa ahora funciona con visitas.")
          : tr("The rewards program now runs on points.", "El programa ahora funciona con puntos."),
      );
    } catch {
      setError(tr("Loyalty model update failed", "No se pudo actualizar el modelo de lealtad"));
    } finally {
      setLoyaltyModeBusy(false);
    }
  };
  const uploadClientLogo = async (file: File) => {
    if (!clientEditor) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(tr("Choose a PNG, JPEG, or WebP logo.", "Elige un logotipo PNG, JPEG o WebP."));
      return;
    }
    if (file.size > CLIENT_LOGO_MAX_BYTES) {
      setError(
        tr(
          `Logo must be ${CLIENT_LOGO_MAX_MEGABYTES} MB or smaller.`,
          `El logotipo debe medir ${CLIENT_LOGO_MAX_MEGABYTES} MB o menos.`,
        ),
      );
      return;
    }
    try {
      setLogoUploading(true);
      const result = await api.uploadClientLogo(clientEditor.id, file);
      setClientBranding((current) => ({ ...current, logoUrl: result.branding.logoUrl }));
      setClients((current) =>
        current.map((client) =>
          client.id === clientEditor.id ? { ...client, logoUrl: result.branding.logoUrl } : client,
        ),
      );
      setNotice(
        tr(
          `${clientEditor.name} logo was uploaded.`,
          `Se cargó el logotipo de ${clientEditor.name}.`,
        ),
      );
    } catch (cause) {
      setError(tr("Logo upload failed", "No se pudo cargar el logotipo"));
    } finally {
      setLogoUploading(false);
    }
  };
  const resetClientBranding = async () => {
    if (!clientEditor) return;
    const confirmed = window.confirm(
      tr(
        `Return ${clientEditor.name} to the default Elite Rewards logo and colors? The business name, location, rewards, products, and members will not change.`,
        `¿Restablecer ${clientEditor.name} al logotipo y los colores predeterminados de Elite Rewards? El nombre del negocio, la ubicación, las recompensas, los productos y los miembros no cambiarán.`,
      ),
    );
    if (!confirmed) return;
    setError("");
    try {
      setBrandingResetting(true);
      const result = await api.resetClientBranding(clientEditor.id);
      setClientBranding({
        name: result.branding.name,
        locationName: result.branding.locationName,
        logoUrl: result.branding.logoUrl,
        primaryColor: result.branding.primaryColor,
        secondaryColor: result.branding.secondaryColor,
      });
      setClients((current) =>
        current.map((client) =>
          client.id === clientEditor.id
            ? {
                ...client,
                logoUrl: result.branding.logoUrl,
                primaryColor: result.branding.primaryColor,
                secondaryColor: result.branding.secondaryColor,
              }
            : client,
        ),
      );
      setNotice(
        tr(
          `${clientEditor.name} branding returned to the Elite Rewards default.`,
          `La marca de ${clientEditor.name} volvió a los valores predeterminados de Elite Rewards.`,
        ),
      );
    } catch {
      setError(
        tr(
          "Branding could not be returned to default.",
          "No se pudo restablecer la marca a los valores predeterminados.",
        ),
      );
    } finally {
      setBrandingResetting(false);
    }
  };
  const copyClientLink = async (path: string, label: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setNotice(tr(`${label} link copied.`, `Se copió el enlace de ${label}.`));
    } catch {
      setError(
        tr(
          "The link could not be copied. Open it and copy the browser address instead.",
          "No se pudo copiar el enlace. Ábrelo y copia la dirección del navegador.",
        ),
      );
    }
  };
  const submitMember = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api.createMember(memberForm);
      setMembers((current) => [result.member, ...current]);
      setMemberActivationPath(result.activationPath);
      setNotice(tr(`${result.member.name} was enrolled.`, `Se inscribió a ${result.member.name}.`));
      setMemberForm({ name: "", email: "" });
    } catch (cause) {
      setError(tr("Member enrollment failed", "No se pudo inscribir al miembro"));
    }
  };
  const emptyProductForm = (): ProductDraft => ({
    name: "",
    description: "",
    category: "",
    priceCents: 0,
    pointsCost: 100,
    visitsCost: 10,
    imageUrl: null,
    purchaseUrl: null,
    active: true,
  });
  const saveClientProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientEditor) return;
    setError("");
    try {
      const saved = clientProductEditingId
        ? await api.updateClientProduct(clientEditor.id, clientProductEditingId, clientProductDraft)
        : await api.createClientProduct(clientEditor.id, clientProductDraft);
      if (clientProductImage)
        await api.uploadClientProductImage(clientEditor.id, saved.product.id, clientProductImage);
      setClientProducts((await api.clientProducts(clientEditor.id)).products);
      setClientProductEditingId(null);
      setClientProductImage(null);
      setClientProductDraft(emptyProductForm());
      setNotice(
        tr("Client product catalog updated.", "Se actualizó el catálogo de productos del cliente."),
      );
    } catch {
      setError(tr("Client product update failed", "No se pudo actualizar el producto del cliente"));
    }
  };
  const editClientProduct = (product: ManagedProduct) => {
    setClientProductEditingId(product.id);
    setClientProductDraft({
      name: product.name,
      description: product.description,
      category: product.category,
      priceCents: product.priceCents,
      pointsCost: product.pointsCost,
      visitsCost: product.visitsCost ?? Math.max(1, Math.ceil(product.pointsCost / 100)),
      imageUrl: product.imageUrl,
      purchaseUrl: product.purchaseUrl,
      active: product.active,
    });
    setClientProductImage(null);
  };
  const archiveSelectedClientProduct = async () => {
    if (!clientEditor || !clientProductEditingId) return;
    await api.archiveClientProduct(clientEditor.id, clientProductEditingId);
    setClientProducts((await api.clientProducts(clientEditor.id)).products);
    setClientProductEditingId(null);
    setClientProductImage(null);
    setClientProductDraft(emptyProductForm());
    setNotice(tr("Client product archived.", "Se archivó el producto del cliente."));
  };
  const openNewProduct = () => {
    setEditingProductId(null);
    setProductImage(null);
    setProductForm(emptyProductForm());
    setProductModal(true);
  };
  const openProduct = (product: ManagedProduct) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      description: product.description,
      category: product.category,
      priceCents: product.priceCents,
      pointsCost: product.pointsCost,
      visitsCost: product.visitsCost ?? Math.max(1, Math.ceil(product.pointsCost / 100)),
      imageUrl: product.imageUrl,
      purchaseUrl: product.purchaseUrl,
      active: product.active,
    });
    setProductImage(null);
    setProductModal(true);
  };
  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const saved = editingProductId
        ? await api.updateProduct(editingProductId, productForm)
        : await api.createProduct(productForm);
      if (productImage) await api.uploadProductImage(saved.product.id, productImage);
      setProductModal(false);
      setNotice(
        tr(
          "Business product catalog updated.",
          "Se actualizó el catálogo de productos del negocio.",
        ),
      );
      await load();
    } catch {
      setError(tr("Product update failed", "No se pudo actualizar el producto"));
    }
  };
  const archiveCurrentProduct = async () => {
    if (!editingProductId) return;
    await api.archiveProduct(editingProductId);
    setProductModal(false);
    setNotice(tr("Product archived.", "Se archivó el producto."));
    await load();
  };
  const emptyRewardForm = (): RewardDraft => ({
    name: "",
    description: "",
    points: 100,
    visits: 10,
    active: true,
    inventoryRemaining: null,
  });
  const saveClientReward = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientEditor) return;
    setError("");
    try {
      const wasEditing = Boolean(clientRewardEditingId);
      if (clientRewardEditingId)
        await api.updateClientReward(clientEditor.id, clientRewardEditingId, clientRewardDraft);
      else await api.createClientReward(clientEditor.id, clientRewardDraft);
      setClientRewards((await api.clientRewards(clientEditor.id)).rewards);
      setClientRewardEditingId(null);
      setClientRewardDraft(emptyRewardForm());
      setNotice(
        wasEditing
          ? tr("Client reward updated.", "Se actualizó la recompensa del cliente.")
          : tr("Client reward created.", "Se creó la recompensa del cliente."),
      );
    } catch (cause) {
      setError(
        tr("Client reward update failed", "No se pudo actualizar la recompensa del cliente"),
      );
    }
  };
  const editClientReward = (reward: ManagedReward) => {
    setClientRewardEditingId(reward.id);
    setClientRewardDraft({
      name: reward.name,
      description: reward.description,
      points: reward.points,
      visits: reward.visits ?? Math.max(1, Math.ceil(reward.points / 100)),
      active: reward.active,
      inventoryRemaining: reward.inventoryRemaining,
    });
  };
  const archiveSelectedClientReward = async () => {
    if (!clientEditor || !clientRewardEditingId) return;
    await api.archiveClientReward(clientEditor.id, clientRewardEditingId);
    setClientRewards((await api.clientRewards(clientEditor.id)).rewards);
    setClientRewardEditingId(null);
    setClientRewardDraft(emptyRewardForm());
    setNotice(tr("Client reward archived.", "Se archivó la recompensa del cliente."));
  };
  const openNewReward = () => {
    setEditingRewardId(null);
    setRewardForm(emptyRewardForm());
    setRewardModal(true);
  };
  const openReward = (reward: ManagedReward) => {
    setEditingRewardId(reward.id);
    setRewardForm({
      name: reward.name,
      description: reward.description,
      points: reward.points,
      visits: reward.visits ?? Math.max(1, Math.ceil(reward.points / 100)),
      active: reward.active,
      inventoryRemaining: reward.inventoryRemaining,
    });
    setRewardModal(true);
  };
  const submitReward = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (editingRewardId) await api.updateReward(editingRewardId, rewardForm);
      else await api.createReward(rewardForm);
      setRewardModal(false);
      setNotice(
        editingRewardId
          ? tr("Reward offer updated.", "Se actualizó la oferta de recompensa.")
          : tr("Reward offer created.", "Se creó la oferta de recompensa."),
      );
      await load();
    } catch (cause) {
      setError(tr("Reward update failed", "No se pudo actualizar la recompensa"));
    }
  };
  const archiveCurrentReward = async () => {
    if (
      !editingRewardId ||
      !window.confirm(
        tr(
          "Archive this reward? Members will no longer see it.",
          "¿Archivar esta recompensa? Los miembros dejarán de verla.",
        ),
      )
    )
      return;
    setError("");
    try {
      await api.archiveReward(editingRewardId);
      setRewardModal(false);
      setNotice(tr("Reward offer archived.", "Se archivó la oferta de recompensa."));
      await load();
    } catch (cause) {
      setError(tr("Reward archive failed", "No se pudo archivar la recompensa"));
    }
  };
  const logout = async () => {
    await api.logout();
    await navigate({ to: "/login" });
  };
  const saveVisuals = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api.updateVisualSettings(visualDraft);
      setVisualSettings(result);
      setNotice(
        tr(
          "Business pages and dashboards were updated.",
          "Se actualizaron las páginas y los paneles del negocio.",
        ),
      );
    } catch (cause) {
      setError(tr("Appearance update failed", "No se pudo actualizar la apariencia"));
    }
  };
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.transactions ?? []).filter(
      (item) =>
        !term ||
        [item.member, item.rewardName, item.type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data, search]);
  if (busy) return <Loading label={tr("Loading secure dashboard…", "Cargando el panel seguro…")} />;
  if (!data || !user)
    return (
      <Loading
        label={error || tr("Dashboard is unavailable.", "El panel no está disponible.")}
        failed={initialLoadFailed}
        retryLabel={tr("Try again", "Intentar de nuevo")}
        onRetry={() => void load()}
        signInLabel={tr("Go to sign in", "Ir a iniciar sesión")}
      />
    );
  return (
    <div className={`admin-shell theme-${visualSettings?.themeKey ?? "elite-signature"}`}>
      <ExperienceBackdrop settings={visualSettings} audience="admin" />
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      <aside className={`admin-sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-top">
          {user.platformAdmin ? (
            <BrandMark compact />
          ) : (
            <BusinessBrand business={data.business} compact />
          )}
          <button
            onClick={() => setMobile(false)}
            className="mobile-close"
            aria-label={tr("Close menu", "Cerrar menú")}
          >
            <X />
          </button>
        </div>
        <div className="store-chip">
          <span>
            <Store />
          </span>
          <div>
            <small>{tr("Current location", "Ubicación actual")}</small>
            <strong>{data.business.location_name}</strong>
          </div>
        </div>
        <nav>
          {sections
            .filter((section) => !section.platformOnly || user.platformAdmin)
            .map(({ id, en, es, icon: Icon }) => (
              <button
                className={active === id ? "active" : ""}
                key={id}
                onClick={() => {
                  setActive(id);
                  setMobile(false);
                }}
              >
                <Icon />
                {tr(en, es)}
              </button>
            ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={logout}>
            <LogOut /> {tr("Sign out", "Cerrar sesión")}
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <button
            className="menu-trigger"
            onClick={() => setMobile(true)}
            aria-label={tr("Open menu", "Abrir menú")}
          >
            <Menu />
          </button>
          <div>
            <span className="admin-eyebrow">{data.business.business_name}</span>
            <h1>{sections.find((section) => section.id === active)?.[locale] ?? active}</h1>
          </div>
          <div className="admin-header-actions">
            {(active === "Dashboard" || active === "Transactions") && (
              <label className="search-box">
                <Search />
                <input
                  aria-label={tr("Search transactions", "Buscar transacciones")}
                  placeholder={tr("Search transactions…", "Buscar transacciones…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            )}
            <div className="owner-chip">
              <span>{initials(user.name)}</span>
              <div>
                <strong>{user.name}</strong>
                <small>
                  {user.role === "owner"
                    ? tr("owner", "propietario")
                    : user.role === "staff"
                      ? tr("staff", "personal")
                      : user.role}
                </small>
              </div>
            </div>
          </div>
        </header>
        <main className="dashboard-content">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {active === "Dashboard" && (
            <>
              <section className="dashboard-welcome">
                <div>
                  <span className="demo-badge">
                    {tr("Live production ledger", "Registro de producción en vivo")}
                  </span>
                  <h2>
                    {tr(
                      "Rewards activity you can trust.",
                      "Actividad de recompensas en la que puedes confiar.",
                    )}
                  </h2>
                  <p>
                    {tr(
                      "Balances and transactions are stored server-side for",
                      "Los saldos y las transacciones se guardan en el servidor para",
                    )}{" "}
                    {data.business.business_name}.
                  </p>
                </div>
                <button
                  className="admin-primary"
                  onClick={() => (data.members.length ? setModal(true) : setActive("Members"))}
                >
                  <Plus />{" "}
                  {data.members.length
                    ? data.business.loyalty_mode === "visits"
                      ? tr("Record visits", "Registrar visitas")
                      : tr("Award points", "Otorgar puntos")
                    : tr("Enroll your first member", "Inscribe a tu primer miembro")}
                </button>
              </section>
              <section className="metrics-grid">
                <Metric
                  icon={Users}
                  label={tr("Total members", "Total de miembros")}
                  value={formatNumber(data.metrics.members)}
                  tr={tr}
                />
                <Metric
                  icon={Award}
                  label={
                    data.business.loyalty_mode === "visits"
                      ? tr("Visits recorded", "Visitas registradas")
                      : tr("Points awarded", "Puntos otorgados")
                  }
                  value={formatNumber(data.metrics.unitsAwarded)}
                  tr={tr}
                />
                <Metric
                  icon={Gift}
                  label={tr("Rewards redeemed", "Recompensas canjeadas")}
                  value={formatNumber(data.metrics.rewardsRedeemed)}
                  tr={tr}
                />
                <Metric
                  icon={CircleDollarSign}
                  label={tr("Eligible sales", "Ventas elegibles")}
                  value={new Intl.NumberFormat(localeCode, {
                    style: "currency",
                    currency: "USD",
                  }).format(data.metrics.eligibleSalesCents / 100)}
                  tr={tr}
                />
              </section>
              <section
                className="quick-actions"
                aria-label={tr("Quick actions", "Acciones rápidas")}
              >
                <button type="button" onClick={() => setActive("Members")}>
                  <UserPlus />
                  <span>
                    <strong>{tr("Add a member", "Agregar un miembro")}</strong>
                    <small>
                      {tr(
                        "Enroll a customer or award points",
                        "Inscribe a un cliente u otorga puntos",
                      )}
                    </small>
                  </span>
                </button>
                <button type="button" onClick={() => setActive("Rewards")}>
                  <Gift />
                  <span>
                    <strong>{tr("Manage rewards", "Administrar recompensas")}</strong>
                    <small>
                      {tr(
                        "Create and publish member offers",
                        "Crea y publica ofertas para miembros",
                      )}
                    </small>
                  </span>
                </button>
                <button type="button" onClick={() => setActive("Products")}>
                  <PackageOpen />
                  <span>
                    <strong>{tr("Manage products", "Administrar productos")}</strong>
                    <small>
                      {tr("Update the customer catalog", "Actualiza el catálogo para clientes")}
                    </small>
                  </span>
                </button>
                <button type="button" onClick={() => setActive("Appearance")}>
                  <Palette />
                  <span>
                    <strong>{tr("Customize appearance", "Personalizar apariencia")}</strong>
                    <small>
                      {tr("Change themes and live messages", "Cambia temas y mensajes en vivo")}
                    </small>
                  </span>
                </button>
              </section>
              <TransactionTable
                transactions={visible}
                loyaltyMode={data.business.loyalty_mode}
                tr={tr}
                formatDateTime={formatDateTime}
                formatNumber={formatNumber}
                localeCode={localeCode}
              />
              <section className="panel health-panel">
                <div>
                  <span className="health-icon">
                    <ShieldCheck />
                  </span>
                  <p>
                    <strong>
                      {tr("Production ledger active", "Registro de producción activo")}
                    </strong>
                    <small>
                      {tr(
                        "Authentication, authorization, PostgreSQL persistence, and idempotent mutations are connected.",
                        "La autenticación, la autorización, la persistencia de PostgreSQL y las mutaciones idempotentes están conectadas.",
                      )}
                    </small>
                  </p>
                </div>
                <span className="uptime">
                  {tr("Database connected", "Base de datos conectada")}
                </span>
              </section>
            </>
          )}
          {active === "Clients" && user.platformAdmin && (
            <section className="panel client-panel">
              <div className="panel-title client-panel-title">
                <div>
                  <span>
                    <Building2 />
                  </span>
                  <div>
                    <h3>{tr("Business clients", "Clientes comerciales")}</h3>
                    <small>
                      {tr(
                        "Create and track each rewards program from one place.",
                        "Crea y supervisa cada programa de recompensas desde un solo lugar.",
                      )}
                    </small>
                  </div>
                </div>
                <button
                  className="admin-primary"
                  onClick={() => {
                    setClientModal(true);
                    setActivationPath("");
                  }}
                >
                  <Plus /> {tr("Add client", "Agregar cliente")}
                </button>
              </div>
              <div className="client-grid">
                {clients.map((client) => (
                  <article className="client-card" key={client.id}>
                    <div className="client-card-top">
                      {client.logoUrl ? (
                        <img className="client-logo" src={client.logoUrl} alt="" />
                      ) : (
                        <span
                          className="client-avatar"
                          style={{
                            background: `linear-gradient(135deg, ${client.secondaryColor}, ${client.primaryColor})`,
                          }}
                        >
                          {initials(client.name)}
                        </span>
                      )}
                      <span className={`client-status ${client.status}`}>
                        {localizeStatus(client.status, tr)}
                      </span>
                    </div>
                    <h3>{client.name}</h3>
                    <p>{client.locationName}</p>
                    <dl>
                      <div>
                        <dt>{tr("Owner", "Propietario")}</dt>
                        <dd>{client.ownerName}</dd>
                      </div>
                      <div>
                        <dt>{tr("Email", "Correo electrónico")}</dt>
                        <dd>{client.ownerEmail}</dd>
                      </div>
                      <div>
                        <dt>{tr("Members", "Miembros")}</dt>
                        <dd>{formatNumber(client.members)}</dd>
                      </div>
                    </dl>
                    <div className="client-card-actions">
                      <a
                        className="client-customize"
                        href={client.previewPath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={16} />{" "}
                        {tr("Open client page", "Abrir página del cliente")}
                      </a>
                      <button
                        className="client-customize"
                        onClick={() =>
                          void copyClientLink(
                            client.joinPath,
                            tr("Join Rewards", "Únete a Recompensas"),
                          )
                        }
                      >
                        <Copy size={16} />{" "}
                        {tr("Copy Join Rewards link", "Copiar enlace para unirse")}
                      </button>
                      <button
                        className="client-customize"
                        onClick={() => void openClientEditor(client)}
                      >
                        <Palette size={16} /> {tr("Customize client", "Personalizar cliente")}
                      </button>
                      <button
                        className={`client-customize client-status-action ${client.status === "suspended" ? "activate" : "suspend"}`}
                        onClick={() => void toggleClientActive(client)}
                        disabled={clientStatusBusyId === client.id}
                      >
                        {clientStatusBusyId === client.id ? (
                          tr("Updating…", "Actualizando…")
                        ) : client.status === "suspended" ? (
                          <>
                            <Check size={16} /> {tr("Activate client", "Activar cliente")}
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={16} /> {tr("Suspend client", "Suspender cliente")}
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {active === "Password resets" && user.platformAdmin && (
            <section className="panel client-panel password-reset-panel">
              <div className="panel-title client-panel-title">
                <div>
                  <span>
                    <KeyRound />
                  </span>
                  <div>
                    <h3>{tr("Password reset requests", "Solicitudes de contraseña")}</h3>
                    <small>
                      {tr(
                        "Verify the requester, then create a private single-use link that expires in 30 minutes.",
                        "Verifica a la persona y luego crea un enlace privado de un solo uso que vence en 30 minutos.",
                      )}
                    </small>
                  </div>
                </div>
              </div>
              {passwordResetLink && (
                <div className="activation-result password-reset-result" role="status">
                  <strong>{tr("Private reset link", "Enlace privado de restablecimiento")}</strong>
                  <p>
                    {tr(
                      "Send this only to the verified account holder. It works once and expires in 30 minutes.",
                      "Envíalo solo al titular verificado de la cuenta. Funciona una sola vez y vence en 30 minutos.",
                    )}
                  </p>
                  <code>{passwordResetLink}</code>
                  <button
                    type="button"
                    className="admin-primary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(passwordResetLink)
                        .then(() =>
                          setNotice(
                            tr("Reset link copied.", "Se copió el enlace de restablecimiento."),
                          ),
                        )
                    }
                  >
                    <Copy size={16} /> {tr("Copy reset link", "Copiar enlace")}
                  </button>
                </div>
              )}
              <div className="password-reset-list">
                {passwordResetRequests.map((request) => (
                  <article key={request.id} className="password-reset-card">
                    <span className="client-avatar">
                      <KeyRound size={18} />
                    </span>
                    <div>
                      <h3>{request.userName}</h3>
                      <p>{request.email}</p>
                      <small>
                        {request.businessName} · {request.role} ·{" "}
                        {formatDateTime(request.requestedAt)}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="admin-primary"
                      disabled={passwordResetBusyId === request.id}
                      onClick={() => void issuePasswordReset(request)}
                    >
                      {passwordResetBusyId === request.id
                        ? tr("Creating…", "Creando…")
                        : tr("Create reset link", "Crear enlace")}
                    </button>
                  </article>
                ))}
                {!passwordResetRequests.length && (
                  <p className="empty-table">
                    {tr(
                      "No pending password reset requests.",
                      "No hay solicitudes pendientes para restablecer contraseñas.",
                    )}
                  </p>
                )}
              </div>
            </section>
          )}
          {active === "Members" && (
            <section className="panel">
              <div className="panel-title client-panel-title">
                <div>
                  <span>
                    <Users />
                  </span>
                  <div>
                    <h3>{tr("Members", "Miembros")}</h3>
                    <small>
                      {tr(
                        "Enroll customers and track wallet activation.",
                        "Inscribe clientes y supervisa la activación de sus billeteras.",
                      )}
                    </small>
                  </div>
                </div>
                <button
                  className="admin-primary"
                  onClick={() => {
                    setMemberModal(true);
                    setMemberActivationPath("");
                  }}
                >
                  <UserPlus /> {tr("Enroll member", "Inscribir miembro")}
                </button>
              </div>
              <div className="member-list">
                {members.map((member) => (
                  <button
                    key={member.id}
                    disabled={member.status !== "active"}
                    onClick={() => {
                      if (member.status === "active") {
                        setAward({ ...award, memberId: member.id });
                        setModal(true);
                      }
                    }}
                  >
                    <span className="member-avatar">{initials(member.name)}</span>
                    <span>
                      <strong>{member.name}</strong>
                      <small>
                        {member.email} · {formatNumber(member.units)}{" "}
                        {data.business.loyalty_mode === "visits"
                          ? tr("visits", "visitas")
                          : tr("points", "puntos")}
                      </small>
                    </span>
                    <span className={`client-status ${member.status}`}>
                      {localizeStatus(member.status, tr)}
                    </span>
                  </button>
                ))}
                {!members.length && (
                  <p className="empty-table">
                    {tr(
                      "No members yet. Use Enroll member to create the first secure wallet invitation.",
                      "Aún no hay miembros. Usa Inscribir miembro para crear la primera invitación segura a una billetera.",
                    )}
                  </p>
                )}
              </div>
            </section>
          )}
          {active === "Transactions" && (
            <TransactionTable
              transactions={visible}
              loyaltyMode={data.business.loyalty_mode}
              tr={tr}
              formatDateTime={formatDateTime}
              formatNumber={formatNumber}
              localeCode={localeCode}
            />
          )}
          {active === "Rewards" && (
            <section className="reward-management">
              <div className="panel reward-management-heading">
                <div>
                  <span className="modal-icon">
                    <Trophy />
                  </span>
                  <div>
                    <span className="section-kicker">
                      {tr("Business reward catalog", "Catálogo de recompensas del negocio")}
                    </span>
                    <h2>
                      {tr(
                        "Choose exactly what members can earn.",
                        "Elige exactamente lo que pueden ganar los miembros.",
                      )}
                    </h2>
                    <p>
                      {data.business.loyalty_mode === "visits"
                        ? tr(
                            "Set the offer, visits cost, availability, and optional quantity. Wallets update from the live catalog automatically.",
                            "Configura la oferta, el costo en visitas, la disponibilidad y una cantidad opcional. Las billeteras se actualizan automáticamente desde el catálogo en vivo.",
                          )
                        : tr(
                            "Set the offer, points cost, availability, and optional quantity. Wallets update from the live catalog automatically.",
                            "Configura la oferta, el costo en puntos, la disponibilidad y una cantidad opcional. Las billeteras se actualizan automáticamente desde el catálogo en vivo.",
                          )}
                    </p>
                  </div>
                </div>
                <button
                  className="admin-primary"
                  onClick={openNewReward}
                  disabled={user.role !== "owner"}
                >
                  <Plus />{" "}
                  {user.role === "owner"
                    ? tr("Create reward", "Crear recompensa")
                    : tr("Owner access required", "Se requiere acceso de propietario")}
                </button>
              </div>
              <div className="reward-grid">
                {managedRewards.map((reward, index) => (
                  <article
                    className={`reward-card ${["champagne", "gold", "amber"][index % 3]} ${reward.archivedAt ? "archived" : ""}`}
                    key={reward.id}
                  >
                    <span className="reward-card-icon">
                      <Gift />
                    </span>
                    <span className="reward-cost">
                      {formatNumber(
                        data.business.loyalty_mode === "visits"
                          ? (reward.visits ?? Math.max(1, Math.ceil(reward.points / 100)))
                          : reward.points,
                      )}{" "}
                      {data.business.loyalty_mode === "visits"
                        ? tr("visits", "visitas")
                        : tr("pts", "pts")}
                    </span>
                    <h3>{reward.name}</h3>
                    <p>
                      {reward.description ||
                        tr("No description added.", "No se agregó una descripción.")}
                    </p>
                    <div className="reward-meta">
                      <span className={`client-status ${reward.active ? "active" : "invited"}`}>
                        {localizeStatus(
                          reward.archivedAt ? "archived" : reward.active ? "active" : "hidden",
                          tr,
                        )}
                      </span>
                      <small>
                        {reward.inventoryRemaining === null
                          ? tr("Unlimited", "Sin límite")
                          : `${formatNumber(reward.inventoryRemaining)} ${tr("remaining", "restantes")}`}{" "}
                        · {formatNumber(reward.redemptionCount)} {tr("redeemed", "canjeadas")}
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => openReward(reward)}
                      disabled={Boolean(reward.archivedAt)}
                    >
                      <span>
                        {reward.archivedAt
                          ? tr("Archived", "Archivada")
                          : tr("Edit reward", "Editar recompensa")}
                      </span>
                      <Pencil size={17} />
                    </button>
                  </article>
                ))}
                {!managedRewards.length && (
                  <p className="empty-table">
                    {tr(
                      "No rewards yet. Create the first offer for members.",
                      "Aún no hay recompensas. Crea la primera oferta para los miembros.",
                    )}
                  </p>
                )}
              </div>
            </section>
          )}
          {active === "Products" && (
            <section className="reward-management">
              <div className="panel reward-management-heading">
                <div>
                  <span className="modal-icon">
                    <PackageOpen />
                  </span>
                  <div>
                    <span className="section-kicker">
                      {tr("Business products", "Productos del negocio")}
                    </span>
                    <h2>
                      {tr(
                        "Show members what your business offers.",
                        "Muestra a los miembros lo que ofrece tu negocio.",
                      )}
                    </h2>
                    <p>
                      {tr(
                        "Publish products to the member wallet and public customer page.",
                        "Publica productos en la billetera de miembros y en la página pública para clientes.",
                      )}
                    </p>
                  </div>
                </div>
                <button
                  className="admin-primary"
                  onClick={openNewProduct}
                  disabled={user.role !== "owner"}
                >
                  <Plus /> {tr("Add product", "Agregar producto")}
                </button>
              </div>
              <div className="product-grid admin-product-grid">
                {managedProducts.map((product) => (
                  <article
                    className={`product-card ${product.archivedAt ? "archived" : ""}`}
                    key={product.id}
                  >
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} />
                    ) : (
                      <span className="product-placeholder">
                        <PackageOpen />
                      </span>
                    )}
                    <div>
                      {product.category && <small>{product.category}</small>}
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <strong>
                        {new Intl.NumberFormat(localeCode, {
                          style: "currency",
                          currency: "USD",
                        }).format(product.priceCents / 100)}
                      </strong>
                      {(data.business.loyalty_mode === "visits"
                        ? (product.visitsCost ?? 0)
                        : product.pointsCost) > 0 ? (
                        <span className="product-points">
                          {formatNumber(
                            data.business.loyalty_mode === "visits"
                              ? (product.visitsCost ?? 0)
                              : product.pointsCost,
                          )}{" "}
                          {data.business.loyalty_mode === "visits"
                            ? tr("visits", "visitas")
                            : tr("points", "puntos")}
                        </span>
                      ) : (
                        <small>
                          {tr("Reward value not set", "Valor de recompensa sin configurar")}
                        </small>
                      )}
                      <button
                        type="button"
                        onClick={() => openProduct(product)}
                        disabled={Boolean(product.archivedAt)}
                      >
                        <Pencil size={16} /> {tr("Edit product", "Editar producto")}
                      </button>
                    </div>
                  </article>
                ))}
                {!managedProducts.length && (
                  <p className="empty-table">{tr("No products yet.", "Aún no hay productos.")}</p>
                )}
              </div>
            </section>
          )}
          {active === "Appearance" && (
            <section className="appearance-layout">
              <section className="panel automatic-theme-editor">
                <div className="automatic-theme-heading">
                  <span className="modal-icon">
                    <Award />
                  </span>
                  <div>
                    <span className="section-kicker">
                      {tr("Loyalty model", "Modelo de lealtad")}
                    </span>
                    <h3>{tr("Choose points or visits", "Elige puntos o visitas")}</h3>
                    <p>
                      {tr(
                        "This controls balances, earning, reward costs, customer pages, and member wallets for this business.",
                        "Esto controla los saldos, la acumulación, los costos de recompensas, las páginas para clientes y las billeteras de miembros de este negocio.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="client-color-fields">
                  <button
                    type="button"
                    className={
                      data.business.loyalty_mode === "points" ? "admin-primary" : "client-customize"
                    }
                    disabled={user.role !== "owner" || loyaltyModeBusy}
                    onClick={() => void saveLoyaltyMode("points")}
                  >
                    {tr("Use points", "Usar puntos")}
                  </button>
                  <button
                    type="button"
                    className={
                      data.business.loyalty_mode === "visits" ? "admin-primary" : "client-customize"
                    }
                    disabled={user.role !== "owner" || loyaltyModeBusy}
                    onClick={() => void saveLoyaltyMode("visits")}
                  >
                    {tr("Use visits", "Usar visitas")}
                  </button>
                </div>
              </section>
              <div className="panel appearance-intro">
                <span className="modal-icon">
                  <Palette />
                </span>
                <div>
                  <span className="section-kicker">
                    {tr("Business customization", "Personalización del negocio")}
                  </span>
                  <h2>
                    {tr("Live backgrounds & event themes", "Fondos en vivo y temas de eventos")}
                  </h2>
                  <p>
                    {tr(
                      "Select a high-resolution animated visual for this business’s admin dashboard and member wallets. Motion automatically reduces when a visitor requests it.",
                      "Selecciona una imagen animada de alta resolución para el panel administrativo y las billeteras de miembros de este negocio. El movimiento se reduce automáticamente cuando un visitante lo solicita.",
                    )}
                  </p>
                </div>
              </div>
              <form className="appearance-form" onSubmit={saveVisuals}>
                <section className="panel automatic-theme-editor">
                  <div className="automatic-theme-heading">
                    <span className="modal-icon">
                      <CalendarClock />
                    </span>
                    <div>
                      <span className="section-kicker">
                        {tr("Automatic schedule", "Programación automática")}
                      </span>
                      <h3>{tr("Switch themes on holidays", "Cambiar temas en días festivos")}</h3>
                      <p>
                        {tr(
                          "When enabled, Elite Rewards temporarily publishes the matching holiday theme on its scheduled date, then restores your selected theme automatically.",
                          "Cuando está activado, Elite Rewards publica temporalmente el tema festivo correspondiente en la fecha programada y luego restaura automáticamente el tema seleccionado.",
                        )}
                      </p>
                    </div>
                  </div>
                  <label className="theme-toggle">
                    <input
                      type="checkbox"
                      checked={visualDraft.automaticHolidayThemes}
                      onChange={(event) =>
                        setVisualDraft({
                          ...visualDraft,
                          automaticHolidayThemes: event.target.checked,
                        })
                      }
                      disabled={user.role !== "owner"}
                    />
                    <span aria-hidden="true" />
                    <strong>
                      {visualDraft.automaticHolidayThemes
                        ? tr("Automatic holiday themes on", "Temas festivos automáticos activados")
                        : tr(
                            "Automatic holiday themes off",
                            "Temas festivos automáticos desactivados",
                          )}
                    </strong>
                  </label>
                  <label className="timezone-field">
                    {tr("Business time zone", "Zona horaria del negocio")}
                    <select
                      value={visualDraft.timeZone}
                      onChange={(event) =>
                        setVisualDraft({ ...visualDraft, timeZone: event.target.value })
                      }
                      disabled={user.role !== "owner"}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">
                        {tr("Eastern Time", "Hora del Este")}
                      </option>
                      <option value="America/Chicago">{tr("Central Time", "Hora Central")}</option>
                      <option value="America/Denver">
                        {tr("Mountain Time", "Hora de la Montaña")}
                      </option>
                      <option value="America/Los_Angeles">
                        {tr("Pacific Time", "Hora del Pacífico")}
                      </option>
                      <option value="America/Anchorage">
                        {tr("Alaska Time", "Hora de Alaska")}
                      </option>
                      <option value="Pacific/Honolulu">{tr("Hawaii Time", "Hora de Hawái")}</option>
                    </select>
                  </label>
                  <div className="automatic-theme-status" role="status">
                    {!visualSettings?.automaticHolidayThemes ? (
                      <>
                        <strong>
                          {tr(
                            "Automatic switching is currently off.",
                            "El cambio automático está desactivado.",
                          )}
                        </strong>
                        <span>
                          {tr(
                            "Enable the toggle and publish the appearance to start the schedule.",
                            "Activa el interruptor y publica la apariencia para iniciar la programación.",
                          )}
                        </span>
                      </>
                    ) : visualSettings.automaticThemeActive ? (
                      <>
                        <strong>
                          {tr(
                            `${visualSettings.automaticThemeName} is active today.`,
                            `${themeSpanish(visualSettings.themeKey).name} está activo hoy.`,
                          )}
                        </strong>
                        <span>
                          {tr(
                            "Your manual theme remains saved and will return afterward.",
                            "Tu tema manual permanece guardado y volverá después.",
                          )}
                        </span>
                      </>
                    ) : visualSettings.nextAutomaticTheme ? (
                      <>
                        <strong>
                          {tr("Next", "Próximo")}: {visualSettings.nextAutomaticTheme.name}{" "}
                          {tr("on", "el")} {visualSettings.nextAutomaticTheme.localDate}
                        </strong>
                        <span>{visualSettings.nextAutomaticTheme.dateLabel}</span>
                      </>
                    ) : null}
                  </div>
                  <ul
                    className="automatic-theme-schedule"
                    aria-label={tr(
                      "Automatic holiday schedule",
                      "Programación automática de días festivos",
                    )}
                  >
                    <li>
                      <strong>{tr("MLK Day", "Día de Martin Luther King Jr.")}</strong>
                      <span>{tr("Third Monday in January", "Tercer lunes de enero")}</span>
                    </li>
                    <li>
                      <strong>{tr("Spring Celebration", "Celebración de primavera")}</strong>
                      <span>{tr("Easter Sunday", "Domingo de Pascua")}</span>
                    </li>
                    <li>
                      <strong>
                        {tr("September 11 Remembrance", "Conmemoración del 11 de septiembre")}
                      </strong>
                      <span>{tr("September 11", "11 de septiembre")}</span>
                    </li>
                    <li>
                      <strong>{tr("Winter Holiday", "Festividad de invierno")}</strong>
                      <span>{tr("December 24–26", "24–26 de diciembre")}</span>
                    </li>
                  </ul>
                  <div className="automatic-live-message">
                    <div>
                      <span className="section-kicker">
                        {tr("Optional live message", "Mensaje en vivo opcional")}
                      </span>
                      <h3>{tr("Holiday or event announcement", "Anuncio festivo o de evento")}</h3>
                      <p>
                        {tr(
                          "Add a respectful observance, store event, or seasonal message. Leave both fields empty for wallpaper only.",
                          "Agrega una conmemoración respetuosa, un evento de la tienda o un mensaje de temporada. Deja ambos campos vacíos para mostrar solo el fondo.",
                        )}
                      </p>
                    </div>
                    <label>
                      {tr("Headline", "Título")}
                      <input
                        maxLength={80}
                        value={visualDraft.occasionTitle}
                        onChange={(event) =>
                          setVisualDraft({ ...visualDraft, occasionTitle: event.target.value })
                        }
                        placeholder={tr(
                          "Example: Honoring Dr. Martin Luther King Jr.",
                          "Ejemplo: En honor al Dr. Martin Luther King Jr.",
                        )}
                      />
                    </label>
                    <label>
                      {tr("Message", "Mensaje")}
                      <textarea
                        maxLength={220}
                        value={visualDraft.occasionMessage}
                        onChange={(event) =>
                          setVisualDraft({ ...visualDraft, occasionMessage: event.target.value })
                        }
                        placeholder={tr(
                          "Add a short message for members and staff.",
                          "Agrega un mensaje breve para los miembros y el personal.",
                        )}
                      />
                    </label>
                    <button className="admin-primary" disabled={user.role !== "owner"}>
                      {user.role === "owner"
                        ? tr("Publish appearance", "Publicar apariencia")
                        : tr("Owner access required", "Se requiere acceso de propietario")}
                    </button>
                  </div>
                </section>
                <div
                  className="theme-grid"
                  role="radiogroup"
                  aria-label={tr("Business page theme", "Tema de la página del negocio")}
                >
                  {themeCatalog.map((theme) => (
                    <label
                      className={`theme-card ${visualDraft.themeKey === theme.key ? "selected" : ""}`}
                      key={theme.key}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={theme.key}
                        checked={visualDraft.themeKey === theme.key}
                        onChange={() => setVisualDraft({ ...visualDraft, themeKey: theme.key })}
                      />
                      <img src={theme.image} alt="" loading="lazy" width="320" height="180" />
                      <span>
                        <small>{tr(theme.category, themeSpanish(theme.key).category)}</small>
                        <strong>{tr(theme.name, themeSpanish(theme.key).name)}</strong>
                        <em>{tr(theme.description, themeSpanish(theme.key).description)}</em>
                      </span>
                    </label>
                  ))}
                </div>
              </form>
            </section>
          )}
        </main>
      </div>
      {clientEditor && (
        <div className="modal-backdrop" onMouseDown={() => setClientEditor(null)}>
          <div
            className="award-modal client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customize-client-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setClientEditor(null)}
              aria-label={tr("Close", "Cerrar")}
            >
              <X />
            </button>
            <span className="modal-icon">
              <Palette />
            </span>
            <span className="section-kicker">
              {tr("Elite platform control", "Control de la plataforma Elite")}
            </span>
            <h2 id="customize-client-title">
              {tr("Customize", "Personalizar")} {clientEditor.name}
            </h2>
            <p>
              {tr(
                "Publish the identity used by this client’s business dashboard and member wallets. Rewards remain managed in that client’s isolated catalog.",
                "Publica la identidad que utiliza el panel del negocio y las billeteras de miembros de este cliente. Las recompensas siguen administrándose en el catálogo aislado del cliente.",
              )}
            </p>
            <div className="client-brand-preview" style={clientBrandStyle(clientBranding)}>
              {clientBranding.logoUrl ? (
                <img src={clientBranding.logoUrl} alt="" />
              ) : (
                <span>{initials(clientBranding.name || clientEditor.name)}</span>
              )}
              <strong>{clientBranding.name || clientEditor.name}</strong>
              <small>{clientBranding.locationName || clientEditor.locationName}</small>
            </div>
            <fieldset className="loyalty-mode-control">
              <legend>{tr("Loyalty model", "Modelo de lealtad")}</legend>
              <p>
                {tr(
                  "Choose what this business awards and what members spend on rewards.",
                  "Elige lo que este negocio otorga y lo que los miembros usan para recompensas.",
                )}
              </p>
              <div className="client-color-fields">
                <button
                  type="button"
                  className={
                    clientEditor.loyaltyMode === "points" ? "admin-primary" : "client-customize"
                  }
                  disabled={loyaltyModeBusy}
                  onClick={() => void saveLoyaltyMode("points")}
                >
                  {tr("Use points", "Usar puntos")}
                </button>
                <button
                  type="button"
                  className={
                    clientEditor.loyaltyMode === "visits" ? "admin-primary" : "client-customize"
                  }
                  disabled={loyaltyModeBusy}
                  onClick={() => void saveLoyaltyMode("visits")}
                >
                  {tr("Use visits", "Usar visitas")}
                </button>
              </div>
            </fieldset>
            <label>
              {tr("Business name", "Nombre del negocio")}
              <input
                required
                minLength={2}
                maxLength={120}
                value={clientBranding.name}
                onChange={(event) =>
                  setClientBranding({ ...clientBranding, name: event.target.value })
                }
              />
            </label>
            <label>
              {tr("Primary location", "Ubicación principal")}
              <input
                required
                minLength={2}
                maxLength={120}
                value={clientBranding.locationName}
                onChange={(event) =>
                  setClientBranding({ ...clientBranding, locationName: event.target.value })
                }
              />
            </label>
            <label className="client-logo-upload">
              {tr("Company logo", "Logotipo de la empresa")}
              <span>
                <Upload size={18} />{" "}
                {tr("Choose logo from files", "Elegir logotipo de los archivos")}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={logoUploading || brandingResetting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadClientLogo(file);
                  event.target.value = "";
                }}
              />
              <small>
                {logoUploading
                  ? tr("Uploading logo…", "Cargando logotipo…")
                  : tr(
                      `PNG, JPEG, or WebP · maximum ${CLIENT_LOGO_MAX_MEGABYTES} MB`,
                      `PNG, JPEG o WebP · máximo ${CLIENT_LOGO_MAX_MEGABYTES} MB`,
                    )}
              </small>
            </label>
            <div className="client-color-fields">
              <label>
                {tr("Primary color", "Color principal")}
                <input
                  type="color"
                  value={clientBranding.primaryColor}
                  onChange={(event) =>
                    setClientBranding({ ...clientBranding, primaryColor: event.target.value })
                  }
                />
              </label>
              <label>
                {tr("Accent color", "Color de acento")}
                <input
                  type="color"
                  value={clientBranding.secondaryColor}
                  onChange={(event) =>
                    setClientBranding({ ...clientBranding, secondaryColor: event.target.value })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="admin-primary full"
              disabled={brandingResetting || logoUploading}
              onClick={() => void saveClientBranding()}
            >
              {tr("Publish client branding", "Publicar marca del cliente")}
            </button>
            <button
              type="button"
              className="client-customize branding-default-action"
              disabled={brandingResetting || logoUploading}
              onClick={() => void resetClientBranding()}
            >
              <RotateCcw size={17} />
              {brandingResetting
                ? tr("Returning to default…", "Restableciendo valores…")
                : tr("Return to default", "Restablecer valores predeterminados")}
            </button>
            <section className="client-appearance-manager">
              <div>
                <span className="section-kicker">
                  {tr("Client holiday experience", "Experiencia festiva del cliente")}
                </span>
                <h3>{tr("Automatic live themes", "Temas en vivo automáticos")}</h3>
                <p>
                  {tr(
                    "Turn holiday themes on or off for this business. When enabled, the selected holiday appears across its dashboard, wallet, customer page, and Join Rewards experience.",
                    "Activa o desactiva los temas festivos para este negocio. Cuando están activos, el día festivo aparece en su panel, billetera, página del cliente y experiencia Únete a Recompensas.",
                  )}
                </p>
              </div>
              <label className="automatic-theme-toggle">
                <input
                  type="checkbox"
                  checked={clientVisualDraft.automaticHolidayThemes}
                  onChange={(event) =>
                    setClientVisualDraft({
                      ...clientVisualDraft,
                      automaticHolidayThemes: event.target.checked,
                    })
                  }
                />
                <span>
                  {clientVisualDraft.automaticHolidayThemes
                    ? tr("Automatic themes on", "Temas automáticos activos")
                    : tr("Automatic themes off", "Temas automáticos desactivados")}
                </span>
              </label>
              <label>
                {tr("Business time zone", "Zona horaria del negocio")}
                <select
                  value={clientVisualDraft.timeZone}
                  onChange={(event) =>
                    setClientVisualDraft({ ...clientVisualDraft, timeZone: event.target.value })
                  }
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">{tr("Eastern Time", "Hora del Este")}</option>
                  <option value="America/Chicago">{tr("Central Time", "Hora Central")}</option>
                  <option value="America/Denver">
                    {tr("Mountain Time", "Hora de la Montaña")}
                  </option>
                  <option value="America/Los_Angeles">
                    {tr("Pacific Time", "Hora del Pacífico")}
                  </option>
                  <option value="America/Anchorage">{tr("Alaska Time", "Hora de Alaska")}</option>
                  <option value="Pacific/Honolulu">{tr("Hawaii Time", "Hora de Hawái")}</option>
                </select>
              </label>
              <div className="automatic-theme-status" role="status">
                <strong>
                  {clientVisualSettings?.automaticThemeActive
                    ? tr(
                        `${clientVisualSettings.automaticThemeName} is live now.`,
                        `${themeSpanish(clientVisualSettings.themeKey).name} está activo ahora.`,
                      )
                    : clientVisualDraft.automaticHolidayThemes
                      ? tr(
                          "The automatic schedule is enabled.",
                          "La programación automática está activa.",
                        )
                      : tr(
                          "This business uses its manual theme.",
                          "Este negocio usa su tema manual.",
                        )}
                </strong>
                <span>
                  {tr(
                    "Manual appearance settings remain saved and return after each holiday.",
                    "Los ajustes manuales permanecen guardados y vuelven después de cada día festivo.",
                  )}
                </span>
              </div>
              <button
                type="button"
                className="admin-primary full"
                onClick={() => void saveClientAppearance()}
              >
                {tr("Publish holiday settings", "Publicar ajustes festivos")}
              </button>
            </section>
            <section className="client-links">
              <div>
                <span className="section-kicker">
                  {tr("Client page & NFC", "Página del cliente y NFC")}
                </span>
                <h3>{tr("Customer-facing destination", "Destino para clientes")}</h3>
                <p>
                  {tr(
                    "Open this page to verify branding and rewards. Program the same URL into this client’s NFC cards.",
                    "Abre esta página para verificar la marca y las recompensas. Programa la misma URL en las tarjetas NFC de este cliente.",
                  )}
                </p>
              </div>
              <a
                className="client-customize"
                href={clientEditor.previewPath}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} /> {tr("Open client page", "Abrir página del cliente")}
              </a>
              <button
                type="button"
                className="client-customize"
                onClick={() =>
                  void copyClientLink(clientEditor.nfcPath, tr("NFC card", "tarjeta NFC"))
                }
              >
                <Copy size={16} /> {tr("Copy NFC card link", "Copiar enlace de la tarjeta NFC")}
              </button>
              <code>{clientEditor.nfcPath}</code>
            </section>
            <div className="client-reward-manager">
              <div>
                <span className="section-kicker">
                  {tr("Join Rewards link", "Enlace Únete a Recompensas")}
                </span>
                <h3>{tr("Customer self-enrollment", "Autoinscripción de clientes")}</h3>
                <p>
                  {tr(
                    "Share this permanent link so customers can create their own secure member wallet.",
                    "Comparte este enlace permanente para que los clientes creen su propia billetera segura.",
                  )}
                </p>
              </div>
              <div className="client-links compact-client-links">
                <a
                  className="client-customize"
                  href={clientEditor.joinPath}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} /> {tr("Open Join Rewards", "Abrir Únete a Recompensas")}
                </a>
                <button
                  type="button"
                  className="client-customize"
                  onClick={() =>
                    void copyClientLink(
                      clientEditor.joinPath,
                      tr("Join Rewards", "Únete a Recompensas"),
                    )
                  }
                >
                  <Copy size={16} /> {tr("Copy Join Rewards link", "Copiar enlace para unirse")}
                </button>
                <code>{clientEditor.joinPath}</code>
              </div>
            </div>
            <div className="client-reward-manager">
              <div>
                <span className="section-kicker">
                  {tr("Client products", "Productos del cliente")}
                </span>
                <h3>
                  {tr("Member-facing product catalog", "Catálogo de productos para miembros")}
                </h3>
              </div>
              <div className="client-reward-list">
                {clientProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => editClientProduct(product)}
                    disabled={Boolean(product.archivedAt)}
                  >
                    <span>
                      <strong>{product.name}</strong>
                      <small>
                        {(clientEditor.loyaltyMode === "visits"
                          ? (product.visitsCost ?? 0)
                          : product.pointsCost) > 0
                          ? `${formatNumber(clientEditor.loyaltyMode === "visits" ? (product.visitsCost ?? 0) : product.pointsCost)} ${clientEditor.loyaltyMode === "visits" ? tr("visits", "visitas") : tr("points", "puntos")}`
                          : tr("Reward value not set", "Valor de recompensa sin configurar")}
                      </small>
                    </span>
                    <span className={`client-status ${product.active ? "active" : "invited"}`}>
                      {localizeStatus(
                        product.archivedAt ? "archived" : product.active ? "active" : "hidden",
                        tr,
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="client-customize"
                onClick={() => {
                  setClientProductEditingId(null);
                  setClientProductDraft(emptyProductForm());
                }}
              >
                <Plus size={16} /> {tr("New client product", "Nuevo producto del cliente")}
              </button>
              <ProductEditorFields
                draft={clientProductDraft}
                setDraft={setClientProductDraft}
                imageFile={clientProductImage}
                setImageFile={setClientProductImage}
                tr={tr}
                onSubmit={saveClientProduct}
                editing={Boolean(clientProductEditingId)}
                onArchive={archiveSelectedClientProduct}
                loyaltyMode={clientEditor.loyaltyMode}
              />
            </div>
            <div className="client-reward-manager">
              <div>
                <span className="section-kicker">
                  {tr("Client rewards", "Recompensas del cliente")}
                </span>
                <h3>{tr("Customer-facing offer catalog", "Catálogo de ofertas para clientes")}</h3>
              </div>
              <div className="client-reward-list">
                {clientRewards.map((reward) => (
                  <button
                    type="button"
                    key={reward.id}
                    onClick={() => editClientReward(reward)}
                    disabled={Boolean(reward.archivedAt)}
                  >
                    <span>
                      <strong>{reward.name}</strong>
                      <small>
                        {formatNumber(
                          clientEditor.loyaltyMode === "visits"
                            ? (reward.visits ?? Math.max(1, Math.ceil(reward.points / 100)))
                            : reward.points,
                        )}{" "}
                        {clientEditor.loyaltyMode === "visits"
                          ? tr("visits", "visitas")
                          : tr("points", "puntos")}
                      </small>
                    </span>
                    <span className={`client-status ${reward.active ? "active" : "invited"}`}>
                      {localizeStatus(
                        reward.archivedAt ? "archived" : reward.active ? "active" : "hidden",
                        tr,
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <div className="client-reward-actions">
                <button
                  type="button"
                  className="client-customize"
                  onClick={() => {
                    setClientRewardEditingId(null);
                    setClientRewardDraft(emptyRewardForm());
                  }}
                >
                  <Plus size={16} /> {tr("New client reward", "Nueva recompensa del cliente")}
                </button>
              </div>
              <form className="client-reward-form" onSubmit={saveClientReward}>
                <label>
                  {tr("Reward name", "Nombre de la recompensa")}
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientRewardDraft.name}
                    onChange={(event) =>
                      setClientRewardDraft({ ...clientRewardDraft, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  {tr("Description", "Descripción")}
                  <textarea
                    maxLength={500}
                    value={clientRewardDraft.description}
                    onChange={(event) =>
                      setClientRewardDraft({
                        ...clientRewardDraft,
                        description: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="client-color-fields">
                  <label>
                    {clientEditor.loyaltyMode === "visits"
                      ? tr("Visits", "Visitas")
                      : tr("Points", "Puntos")}
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      value={
                        clientEditor.loyaltyMode === "visits"
                          ? clientRewardDraft.visits
                          : clientRewardDraft.points
                      }
                      onChange={(event) =>
                        setClientRewardDraft({
                          ...clientRewardDraft,
                          ...(clientEditor.loyaltyMode === "visits"
                            ? { visits: Number(event.target.value) }
                            : { points: Number(event.target.value) }),
                        })
                      }
                    />
                  </label>
                  <label>
                    {tr("Inventory", "Inventario")}
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      placeholder={tr("Unlimited", "Sin límite")}
                      value={clientRewardDraft.inventoryRemaining ?? ""}
                      onChange={(event) =>
                        setClientRewardDraft({
                          ...clientRewardDraft,
                          inventoryRemaining:
                            event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="reward-active-check">
                  <input
                    type="checkbox"
                    checked={clientRewardDraft.active}
                    onChange={(event) =>
                      setClientRewardDraft({ ...clientRewardDraft, active: event.target.checked })
                    }
                  />
                  <span>
                    <strong>
                      {tr(
                        "Visible to this client’s members",
                        "Visible para los miembros de este cliente",
                      )}
                    </strong>
                  </span>
                </label>
                <div className="reward-editor-actions">
                  {clientRewardEditingId && (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void archiveSelectedClientReward()}
                    >
                      {tr("Archive", "Archivar")}
                    </button>
                  )}
                  <button className="admin-primary">
                    {clientRewardEditingId
                      ? tr("Save client reward", "Guardar recompensa del cliente")
                      : tr("Create client reward", "Crear recompensa del cliente")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {clientModal && (
        <div className="modal-backdrop" onMouseDown={() => setClientModal(false)}>
          <form
            className="award-modal client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-client-title"
            onSubmit={submitClient}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setClientModal(false)}
              aria-label={tr("Close", "Cerrar")}
            >
              <X />
            </button>
            <span className="modal-icon">
              <Building2 />
            </span>
            <span className="section-kicker">
              {tr("Platform client", "Cliente de la plataforma")}
            </span>
            <h2 id="add-client-title">
              {tr("Add a business client", "Agregar un cliente comercial")}
            </h2>
            <p>
              {tr(
                "Create an isolated rewards program and a secure owner activation invitation.",
                "Crea un programa de recompensas aislado y una invitación segura de activación para el propietario.",
              )}
            </p>
            {activationPath ? (
              <div className="activation-result" role="status">
                <strong>{tr("Client created", "Cliente creado")}</strong>
                <p>
                  {tr(
                    "Copy this private activation link and send it to the client owner:",
                    "Copia este enlace privado de activación y envíalo al propietario del cliente:",
                  )}
                </p>
                <code>{`${window.location.origin}${activationPath}`}</code>
                <button
                  type="button"
                  className="admin-primary full"
                  onClick={() =>
                    void navigator.clipboard.writeText(`${window.location.origin}${activationPath}`)
                  }
                >
                  {tr("Copy activation link", "Copiar enlace de activación")}
                </button>
              </div>
            ) : (
              <>
                <label>
                  {tr("Business name", "Nombre del negocio")}
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientForm.businessName}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, businessName: event.target.value })
                    }
                  />
                </label>
                <label>
                  {tr("First location", "Primera ubicación")}
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientForm.locationName}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, locationName: event.target.value })
                    }
                  />
                </label>
                <label>
                  {tr("Client owner name", "Nombre del propietario del cliente")}
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={clientForm.ownerName}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, ownerName: event.target.value })
                    }
                  />
                </label>
                <label>
                  {tr("Client owner email", "Correo del propietario del cliente")}
                  <input
                    required
                    type="email"
                    maxLength={254}
                    value={clientForm.ownerEmail}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, ownerEmail: event.target.value })
                    }
                  />
                </label>
                <button className="admin-primary full">
                  {tr("Create client", "Crear cliente")}
                </button>
              </>
            )}
          </form>
        </div>
      )}
      {memberModal && (
        <div className="modal-backdrop" onMouseDown={() => setMemberModal(false)}>
          <form
            className="award-modal client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-member-title"
            onSubmit={submitMember}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setMemberModal(false)}
              aria-label={tr("Close", "Cerrar")}
            >
              <X />
            </button>
            <span className="modal-icon">
              <UserPlus />
            </span>
            <span className="section-kicker">
              {tr("Member enrollment", "Inscripción de miembros")}
            </span>
            <h2 id="enroll-member-title">
              {tr("Enroll a rewards member", "Inscribir a un miembro de recompensas")}
            </h2>
            <p>
              {tr(
                "Create a secure, single-use wallet activation invitation.",
                "Crea una invitación segura y de un solo uso para activar la billetera.",
              )}
            </p>
            {memberActivationPath ? (
              <div className="activation-result" role="status">
                <strong>{tr("Member enrolled", "Miembro inscrito")}</strong>
                <p>
                  {tr(
                    "Copy this private activation link and send it to the member:",
                    "Copia este enlace privado de activación y envíalo al miembro:",
                  )}
                </p>
                <code>{`${window.location.origin}${memberActivationPath}`}</code>
                <button
                  type="button"
                  className="admin-primary full"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      `${window.location.origin}${memberActivationPath}`,
                    )
                  }
                >
                  {tr("Copy activation link", "Copiar enlace de activación")}
                </button>
              </div>
            ) : (
              <>
                <label>
                  {tr("Member name", "Nombre del miembro")}
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    value={memberForm.name}
                    onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })}
                  />
                </label>
                <label>
                  {tr("Member email", "Correo del miembro")}
                  <input
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={memberForm.email}
                    onChange={(event) =>
                      setMemberForm({ ...memberForm, email: event.target.value })
                    }
                  />
                </label>
                <button className="admin-primary full">
                  {tr("Create member invitation", "Crear invitación de miembro")}
                </button>
              </>
            )}
          </form>
        </div>
      )}
      {productModal && (
        <div className="modal-backdrop" onMouseDown={() => setProductModal(false)}>
          <div
            className="award-modal reward-editor-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setProductModal(false)}
              aria-label={tr("Close", "Cerrar")}
            >
              <X />
            </button>
            <span className="modal-icon">
              <PackageOpen />
            </span>
            <span className="section-kicker">{tr("Business product", "Producto del negocio")}</span>
            <h2>
              {editingProductId
                ? tr("Edit product", "Editar producto")
                : tr("Add a product", "Agregar un producto")}
            </h2>
            <ProductEditorFields
              draft={productForm}
              setDraft={setProductForm}
              imageFile={productImage}
              setImageFile={setProductImage}
              tr={tr}
              onSubmit={submitProduct}
              editing={Boolean(editingProductId)}
              onArchive={archiveCurrentProduct}
              loyaltyMode={data.business.loyalty_mode}
            />
          </div>
        </div>
      )}
      {rewardModal && (
        <div className="modal-backdrop" onMouseDown={() => setRewardModal(false)}>
          <form
            className="award-modal reward-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-editor-title"
            onSubmit={submitReward}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setRewardModal(false)}
              aria-label={tr("Close", "Cerrar")}
            >
              <X />
            </button>
            <span className="modal-icon">
              <Gift />
            </span>
            <span className="section-kicker">
              {tr("Business reward offer", "Oferta de recompensa del negocio")}
            </span>
            <h2 id="reward-editor-title">
              {editingRewardId
                ? tr("Edit reward", "Editar recompensa")
                : tr("Create a reward", "Crear una recompensa")}
            </h2>
            <p>
              {tr(
                "Changes publish to this business’s member wallets only.",
                "Los cambios se publican únicamente en las billeteras de los miembros de este negocio.",
              )}
            </p>
            <label>
              {tr("Reward name", "Nombre de la recompensa")}
              <input
                required
                minLength={2}
                maxLength={120}
                value={rewardForm.name}
                onChange={(event) => setRewardForm({ ...rewardForm, name: event.target.value })}
                placeholder={tr("Example: Free specialty drink", "Ejemplo: Bebida especial gratis")}
              />
            </label>
            <label>
              {tr("Description", "Descripción")}
              <textarea
                maxLength={500}
                value={rewardForm.description}
                onChange={(event) =>
                  setRewardForm({ ...rewardForm, description: event.target.value })
                }
                placeholder={tr(
                  "Explain what the member receives and any important eligibility details.",
                  "Explica lo que recibe el miembro y cualquier requisito importante.",
                )}
              />
            </label>
            <div className="reward-editor-grid">
              <label>
                {data.business.loyalty_mode === "visits"
                  ? tr("Visits cost", "Costo en visitas")
                  : tr("Points cost", "Costo en puntos")}
                <input
                  required
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={
                    data.business.loyalty_mode === "visits" ? rewardForm.visits : rewardForm.points
                  }
                  onChange={(event) =>
                    setRewardForm({
                      ...rewardForm,
                      ...(data.business.loyalty_mode === "visits"
                        ? { visits: Number(event.target.value) }
                        : { points: Number(event.target.value) }),
                    })
                  }
                />
              </label>
              <label>
                {tr("Quantity available", "Cantidad disponible")}
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  value={rewardForm.inventoryRemaining ?? ""}
                  onChange={(event) =>
                    setRewardForm({
                      ...rewardForm,
                      inventoryRemaining:
                        event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                  placeholder={tr("Unlimited", "Sin límite")}
                />
              </label>
            </div>
            <label className="reward-active-check">
              <input
                type="checkbox"
                checked={rewardForm.active}
                onChange={(event) => setRewardForm({ ...rewardForm, active: event.target.checked })}
              />
              <span>
                <strong>{tr("Visible to members", "Visible para los miembros")}</strong>
                <small>
                  {tr(
                    "Turn this off to save the offer without publishing it.",
                    "Desactiva esto para guardar la oferta sin publicarla.",
                  )}
                </small>
              </span>
            </label>
            <div className="reward-editor-actions">
              {editingRewardId && (
                <button type="button" className="danger-button" onClick={archiveCurrentReward}>
                  {tr("Archive reward", "Archivar recompensa")}
                </button>
              )}
              <button className="admin-primary">
                {editingRewardId
                  ? tr("Save changes", "Guardar cambios")
                  : tr("Create reward", "Crear recompensa")}
              </button>
            </div>
          </form>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(false)}>
          <form
            className="award-modal"
            role="dialog"
            aria-modal="true"
            onSubmit={submitAward}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setModal(false)}
              aria-label={tr("Close", "Cerrar")}
            >
              <X />
            </button>
            <span className="modal-icon">
              <Award />
            </span>
            <span className="section-kicker">
              {tr("Production award", "Otorgamiento de producción")}
            </span>
            <h2>{tr("Reward a member", "Premiar a un miembro")}</h2>
            <p>
              {tr(
                "This writes an immutable entry to the rewards ledger.",
                "Esto escribe una entrada inmutable en el registro de recompensas.",
              )}
            </p>
            <label>
              {tr("Member", "Miembro")}
              <select
                required
                value={award.memberId}
                onChange={(e) => setAward({ ...award, memberId: e.target.value })}
              >
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {formatNumber(member.units)}{" "}
                    {data.business.loyalty_mode === "visits"
                      ? tr("visits", "visitas")
                      : tr("points", "puntos")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Purchase amount", "Monto de compra")}
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={award.amount}
                onChange={(e) => setAward({ ...award, amount: e.target.value })}
              />
            </label>
            <label>
              {data.business.loyalty_mode === "visits"
                ? tr("Visits", "Visitas")
                : tr("Points", "Puntos")}
              <input
                type="number"
                min="1"
                step="1"
                required
                value={award.points}
                onChange={(e) => setAward({ ...award, points: e.target.value })}
              />
            </label>
            <label>
              {tr("Reason", "Motivo")}
              <input
                maxLength={300}
                value={award.note}
                onChange={(e) => setAward({ ...award, note: e.target.value })}
              />
            </label>
            <button className="admin-primary full">
              {data.business.loyalty_mode === "visits"
                ? tr("Post visits", "Registrar visitas")
                : tr("Post award", "Publicar puntos")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function clientBrandStyle(branding: ClientBrandingDraft) {
  return {
    "--client-primary": branding.primaryColor,
    "--client-secondary": branding.secondaryColor,
  } as CSSProperties;
}
function Loading({
  label,
  failed = false,
  retryLabel = "Try again",
  onRetry,
  signInLabel = "Go to sign in",
}: {
  label: string;
  failed?: boolean;
  retryLabel?: string;
  onRetry?: () => void;
  signInLabel?: string;
}) {
  return (
    <div className="error-screen">
      <div>
        <BrandMark />
        <h1>{label}</h1>
        {failed ? (
          <div className="status-actions">
            {onRetry && (
              <button className="button button-dark" type="button" onClick={onRetry}>
                <RotateCcw size={17} /> {retryLabel}
              </button>
            )}
            <a className="button button-ghost" href="/login">
              {signInLabel}
            </a>
          </div>
        ) : (
          <span className="status-spinner" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  tr,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tr: TranslatePair;
}) {
  return (
    <article className="metric-card">
      <span className="metric-icon">
        <Icon />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>
          <span>{tr("Live", "En vivo")}</span> {tr("production data", "datos de producción")}
        </p>
      </div>
    </article>
  );
}
function TransactionTable({
  transactions,
  loyaltyMode = "points",
  tr,
  formatDateTime,
  formatNumber,
  localeCode,
}: {
  transactions: DashboardData["transactions"];
  loyaltyMode?: "points" | "visits";
  tr: TranslatePair;
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  localeCode: string;
}) {
  return (
    <section className="panel transaction-panel">
      <div className="panel-title">
        <div>
          <span>
            <ReceiptText />
          </span>
          <h3>{tr("Transactions", "Transacciones")}</h3>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Member", "Miembro")}</th>
              <th>{tr("Purchase", "Compra")}</th>
              <th>{loyaltyMode === "visits" ? tr("Visits", "Visitas") : tr("Points", "Puntos")}</th>
              <th>{tr("Status", "Estado")}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className="member-avatar">{initials(t.member)}</span>
                  <span>
                    <strong>{t.member}</strong>
                    <small>{t.rewardName ?? formatDateTime(t.time)}</small>
                  </span>
                </td>
                <td>
                  {t.amount
                    ? new Intl.NumberFormat(localeCode, {
                        style: "currency",
                        currency: "USD",
                      }).format(t.amount)
                    : tr("Reward", "Recompensa")}
                </td>
                <td className={t.type === "earned" ? "positive" : "redeemed"}>
                  {t.type === "earned" ? "+" : "−"}
                  {formatNumber(t.units)}
                </td>
                <td>
                  <span className={`table-status ${t.type}`}>
                    {t.type === "earned" ? tr("Awarded", "Otorgados") : tr("Redeemed", "Canjeados")}
                  </span>
                </td>
              </tr>
            ))}
            {!transactions.length && (
              <tr>
                <td colSpan={4} className="empty-table">
                  {tr("No transactions yet.", "Aún no hay transacciones.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductEditorFields({
  draft,
  setDraft,
  imageFile,
  setImageFile,
  tr,
  onSubmit,
  editing,
  onArchive,
  loyaltyMode = "points",
}: {
  draft: ProductDraft;
  setDraft: (draft: ProductDraft) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  tr: TranslatePair;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  editing: boolean;
  onArchive: () => void | Promise<void>;
  loyaltyMode?: "points" | "visits";
}) {
  return (
    <form className="client-reward-form product-editor-form" onSubmit={onSubmit}>
      <label>
        {tr("Product name", "Nombre del producto")}
        <input
          required
          minLength={2}
          maxLength={120}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        {tr("Description", "Descripción")}
        <textarea
          maxLength={1000}
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </label>
      <div className="client-color-fields">
        <label>
          {tr("Category", "Categoría")}
          <input
            maxLength={80}
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </label>
        <label>
          {tr("Price", "Precio")}
          <input
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            value={draft.priceCents / 100}
            onChange={(event) =>
              setDraft({
                ...draft,
                priceCents: Math.max(0, Math.round(Number(event.target.value) * 100)),
              })
            }
          />
        </label>
        <label>
          {loyaltyMode === "visits" ? tr("Visits", "Visitas") : tr("Points", "Puntos")}
          <input
            required
            type="number"
            min="1"
            max="1000000"
            step="1"
            value={loyaltyMode === "visits" ? draft.visitsCost : draft.pointsCost}
            onChange={(event) =>
              setDraft({
                ...draft,
                ...(loyaltyMode === "visits"
                  ? { visitsCost: Math.max(1, Math.round(Number(event.target.value))) }
                  : { pointsCost: Math.max(1, Math.round(Number(event.target.value))) }),
              })
            }
          />
        </label>
      </div>
      <label className="client-logo-upload product-image-upload">
        {tr("Choose product image from files", "Elegir imagen del producto desde archivos")}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
        />
        <small>
          {imageFile
            ? imageFile.name
            : draft.imageUrl
              ? tr(
                  "Current image will remain unless replaced.",
                  "La imagen actual permanecerá salvo que se reemplace.",
                )
              : tr("PNG, JPEG, or WebP up to 4 MB.", "PNG, JPEG o WebP de hasta 4 MB.")}
        </small>
        {draft.imageUrl && !imageFile && (
          <img className="product-image-preview" src={draft.imageUrl} alt={draft.name} />
        )}
      </label>
      <label>
        {tr("Purchase or details URL", "URL de compra o detalles")}
        <input
          type="url"
          placeholder="https://"
          value={draft.purchaseUrl ?? ""}
          onChange={(event) => setDraft({ ...draft, purchaseUrl: event.target.value || null })}
        />
      </label>
      <label className="reward-active-check">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
        />
        <span>
          <strong>{tr("Visible to members", "Visible para miembros")}</strong>
        </span>
      </label>
      <div className="reward-editor-actions">
        {editing && (
          <button type="button" className="danger-button" onClick={() => void onArchive()}>
            {tr("Archive", "Archivar")}
          </button>
        )}
        <button className="admin-primary">
          {editing
            ? tr("Save product", "Guardar producto")
            : tr("Publish product", "Publicar producto")}
        </button>
      </div>
    </form>
  );
}
