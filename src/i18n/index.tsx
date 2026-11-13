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
  "Forgot password | Elite Rewards": "Olvidé mi contraseña | Elite Rewards",
  "Reset password | Elite Rewards": "Restablecer contraseña | Elite Rewards",
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
  "Add Elite Rewards to home screen": "Agregar Elite Rewards a la pantalla de inicio",
  "Elite Rewards app": "Aplicación Elite Rewards",
  "Add Elite Rewards to your home screen": "Agrega Elite Rewards a tu pantalla de inicio",
  "Open Elite Rewards like an app with the official Elite Rewards logo on your phone or tablet.":
    "Abre Elite Rewards como una aplicación con el logotipo oficial de Elite Rewards en tu teléfono o tableta.",
  "In Safari, tap the Share button.": "En Safari, toca el botón Compartir.",
  "Choose Add to Home Screen, then tap Add.":
    "Elige Agregar a la pantalla de inicio y luego toca Agregar.",
  "Open your browser menu.": "Abre el menú de tu navegador.",
  "Choose Install app or Add to Home screen.":
    "Elige Instalar aplicación o Agregar a la pantalla de inicio.",
  "Close install instructions": "Cerrar instrucciones de instalación",
  "Got it": "Entendido",
  "Open business dashboard": "Abrir panel del negocio",
  "No app required": "No requiere aplicación",
  "Secure member access": "Acceso seguro para miembros",
  "Server-backed rewards ledger": "Registro de recompensas respaldado por el servidor",
  "Elite Rewards member wallet preview": "Vista previa de la billetera de miembro de Elite Rewards",
  Member: "Miembro",
  "Good afternoon, Maya": "Buenas tardes, Maya",
  points: "puntos",
  Visits: "Visitas",
  "Visits recorded": "Visitas registradas",
  "Record visits": "Registrar visitas",
  "Post visits": "Registrar visitas",
  "Visits cost": "Costo en visitas",
  Free: "Gratis",
  "Redeem {rewardName} for free? No points or visits will be deducted.":
    "¿Canjear {rewardName} gratis? No se descontarán puntos ni visitas.",
  "Loyalty model": "Modelo de lealtad",
  "Choose points or visits": "Elige puntos o visitas",
  "Use points": "Usar puntos",
  "Use visits": "Usar visitas",
  "The rewards program now runs on visits.": "El programa ahora funciona con visitas.",
  "The rewards program now runs on points.": "El programa ahora funciona con puntos.",
  "Choose what this business awards and what members spend on rewards.":
    "Elige lo que este negocio otorga y lo que los miembros usan para recompensas.",
  "This controls balances, earning, reward costs, customer pages, and member wallets for this business.":
    "Esto controla los saldos, la acumulación, los costos de recompensas, las páginas para clientes y las billeteras de miembros de este negocio.",
  "Reward value not set": "Valor de recompensa sin configurar",
  "{count} visits until your next reward": {
    one: "Falta {count} visita para tu próxima recompensa",
    other: "Faltan {count} visitas para tu próxima recompensa",
  },
  "Redeem {rewardName} for {count} visits? This will deduct the visits from your balance.":
    "¿Canjear {rewardName} por {count} visitas? Esto descontará las visitas de tu saldo.",
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
  "Designed around your business": "Diseñado alrededor de tu negocio",
  "Your brand. Your rewards. Your way to build loyalty.":
    "Tu marca. Tus recompensas. Tu manera de generar lealtad.",
  "Elite Rewards becomes the digital loyalty side of your team. We give your business one customizable system for attracting members, rewarding repeat customers, and keeping the entire experience organized.":
    "Elite Rewards se convierte en el área digital de lealtad de tu equipo. Le damos a tu negocio un sistema personalizable para atraer miembros, premiar a clientes frecuentes y mantener toda la experiencia organizada.",
  "How Elite Rewards works": "Cómo funciona Elite Rewards",
  "Join in seconds": "Únete en segundos",
  "One scan. No app download. Members start earning before they leave the counter.":
    "Un escaneo. Sin descargar una aplicación. Los miembros empiezan a ganar antes de salir del mostrador.",
  "Give customers a permanent Join Rewards link or NFC card. They create a private member wallet in English or Spanish without downloading an app.":
    "Ofrece a tus clientes un enlace permanente para unirse a recompensas o una tarjeta NFC. Crean una billetera privada de miembro en inglés o español sin descargar una aplicación.",
  "Built around your brand": "Creado alrededor de tu marca",
  "Make the experience feel like your business with your logo, colors, business motto or live message, products, and reward offers across customer and member pages.":
    "Haz que la experiencia se sienta como tu negocio con tu logotipo, colores, lema o mensaje en vivo, productos y ofertas de recompensas en las páginas de clientes y miembros.",
  "Run the loyalty model that fits your business. Award points for eligible purchases or count visits toward rewards, then set each offer's required value.":
    "Usa el modelo de lealtad que se adapte a tu negocio. Otorga puntos por compras elegibles o cuenta visitas para alcanzar recompensas y luego establece el valor requerido de cada oferta.",
  "Grow through referrals": "Crece por medio de referidos",
  "Use member referrals when they fit your strategy. Members can share a personal link with friends and family, helping your program reach new customers.":
    "Usa los referidos de miembros cuando encajen con tu estrategia. Los miembros pueden compartir un enlace personal con amigos y familiares para ayudar a que tu programa llegue a nuevos clientes.",
  "More than a rewards page": "Más que una página de recompensas",
  "Add a loyalty system your whole team can use.":
    "Agrega un sistema de lealtad que todo tu equipo pueda usar.",
  "Elite Rewards connects your customer sign-up, branded member experience, rewards, referrals, and activity records so your staff can spend less time juggling separate tools and more time building customer relationships.":
    "Elite Rewards conecta el registro de clientes, la experiencia de miembro con tu marca, las recompensas, los referidos y los registros de actividad para que tu personal dedique menos tiempo a manejar herramientas separadas y más tiempo a fortalecer las relaciones con los clientes.",
  "One organized place to manage members, balances, rewards, products, and client branding.":
    "Un lugar organizado para administrar miembros, saldos, recompensas, productos y la imagen de cada cliente.",
  "A consistent branded experience from the first scan to the member wallet and redemption.":
    "Una experiencia de marca consistente desde el primer escaneo hasta la billetera del miembro y el canje.",
  "Flexible program controls that can change as your business and customer strategy evolve.":
    "Controles flexibles que pueden cambiar a medida que evolucionan tu negocio y tu estrategia de clientes.",
  "Clear activity and redemption records that help your team serve members with confidence.":
    "Registros claros de actividad y canjes que ayudan a tu equipo a atender a los miembros con confianza.",
  "Built to grow with you": "Creado para crecer contigo",
  "Start simple, then shape the program around what your customers respond to.":
    "Comienza de forma sencilla y luego adapta el programa a lo que mejor responden tus clientes.",
  "Change branding, choose points or visits, publish rewards and products, and manage referrals from one business dashboard while every member keeps a secure, business-specific wallet.":
    "Cambia la imagen de marca, elige puntos o visitas, publica recompensas y productos, y administra referidos desde un solo panel del negocio mientras cada miembro mantiene una billetera segura y específica para ese negocio.",
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
  "Elite Rewards keeps member activity, eligible purchases, and redemptions organized in one authoritative rewards ledger.":
    "Elite Rewards mantiene la actividad de miembros, las compras elegibles y los canjes organizados en un solo registro oficial de recompensas.",
  "Sign in to Elite Rewards": "Iniciar sesión en Elite Rewards",
  "Sign in to your member wallet": "Inicia sesión en tu billetera de miembro",
  "Use the member email and password created for this rewards program.":
    "Usa el correo electrónico y la contraseña de miembro creados para este programa de recompensas.",
  "This sign-in is for member wallets. Use a member account.":
    "Este acceso es para billeteras de miembros. Usa una cuenta de miembro.",
  "A business account is currently signed in as {name}.":
    "Actualmente hay una cuenta de negocio iniciada como {name}.",
  "Sign out and continue as a member": "Cerrar sesión y continuar como miembro",
  "Return to business dashboard": "Volver al panel del negocio",
  "Thoughtful loyalty tools for growing businesses.":
    "Herramientas de lealtad bien diseñadas para negocios en crecimiento.",
  "Trade Marked and Registered LLC": "Marca registrada y LLC registrada",
  "Interested? Contact Mike": "¿Te interesa? Comunícate con Mike",
  "Call Mike at 407-405-1726": "Llama a Mike al 407-405-1726",
  "Tap to call": "Toca para llamar",
  "Back to site": "Volver al sitio",
  "Secure access": "Acceso seguro",
  "Use your business or member account. Rewards balances are stored in the production ledger.":
    "Usa tu cuenta de negocio o de miembro. Los saldos de recompensas se guardan en el registro de producción.",
  Email: "Correo electrónico",
  Password: "Contraseña",
  "Show password": "Mostrar contraseña",
  "Hide password": "Ocultar contraseña",
  "Use at least 8 characters.": "Usa al menos 8 caracteres.",
  "Signing in…": "Iniciando sesión…",
  "Sign in": "Iniciar sesión",
  "Forgot password?": "¿Olvidaste tu contraseña?",
  "Back to sign in": "Volver a iniciar sesión",
  "Account recovery": "Recuperación de cuenta",
  "Forgot your password?": "¿Olvidaste tu contraseña?",
  "Enter the email on your Elite Rewards account. If it matches an active account, Elite Rewards will prepare a secure reset request.":
    "Ingresa el correo electrónico de tu cuenta de Elite Rewards. Si coincide con una cuenta activa, Elite Rewards preparará una solicitud segura para restablecerla.",
  "Request received": "Solicitud recibida",
  "If that email belongs to an active account, the Elite Rewards administrator can now provide a private reset link.":
    "Si ese correo pertenece a una cuenta activa, el administrador de Elite Rewards ahora puede proporcionar un enlace privado para restablecerla.",
  "Return to sign in": "Volver a iniciar sesión",
  "Submitting…": "Enviando…",
  "Request password reset": "Solicitar restablecimiento de contraseña",
  "Secure password reset": "Restablecimiento seguro de contraseña",
  "Create a new password": "Crea una nueva contraseña",
  "Use a new password with at least 8 characters.":
    "Usa una contraseña nueva de al menos 8 caracteres.",
  "This password reset link is incomplete.":
    "Este enlace para restablecer la contraseña está incompleto.",
  "Checking your secure reset link…": "Verificando tu enlace seguro…",
  "New password": "Nueva contraseña",
  "Resetting…": "Restableciendo…",
  "Reset password": "Restablecer contraseña",
  "Password reset complete": "Contraseña restablecida",
  "Sign in with your new password on the next screen.":
    "Inicia sesión con tu nueva contraseña en la siguiente pantalla.",
  "Continue to sign in": "Continuar para iniciar sesión",
  "Password reset request failed": "No se pudo solicitar el restablecimiento de contraseña",
  "Password reset unavailable": "El restablecimiento de contraseña no está disponible",
  "Password reset failed": "No se pudo restablecer la contraseña",
  "Password reset link is invalid or expired":
    "El enlace para restablecer la contraseña no es válido o venció",
  "Too many password reset requests; try again later":
    "Demasiadas solicitudes para restablecer la contraseña; inténtalo más tarde",
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
  "Join Rewards": "Únete a Recompensas",
  "This Join Rewards link is incomplete.": "Este enlace para unirse a recompensas está incompleto.",
  "Enrollment unavailable": "La inscripción no está disponible",
  "Loading your rewards program…": "Cargando tu programa de recompensas…",
  "Secure member enrollment": "Inscripción segura de miembros",
  "Create your private member wallet to view this business’s products, earn points, and redeem available rewards.":
    "Crea tu billetera privada de miembro para ver los productos de este negocio, ganar puntos y canjear recompensas disponibles.",
  "Loyalty rewards": "Recompensas de lealtad",
  "Earn more every time you return.": "Gana más cada vez que regreses.",
  "Join {businessName} rewards, collect points, and unlock offers selected by this business.":
    "Únete a las recompensas de {businessName}, acumula puntos y desbloquea ofertas seleccionadas por este negocio.",
  "Join {businessName} rewards, collect visits, and unlock offers selected by this business.":
    "Únete a las recompensas de {businessName}, acumula visitas y desbloquea ofertas seleccionadas por este negocio.",
  "Create your private member wallet to view this business’s products, record visits, and redeem available rewards.":
    "Crea tu billetera privada de miembro para ver los productos de este negocio, registrar visitas y canjear recompensas disponibles.",
  "Open member wallet": "Abrir billetera de miembro",
  "NFC card destination": "Destino de la tarjeta NFC",
  "Available offers": "Ofertas disponibles",
  "Rewards worth coming back for": "Recompensas por las que vale la pena regresar",
  "No rewards are published right now.": "No hay recompensas publicadas en este momento.",
  "Business products": "Productos del negocio",
  "Explore what this business offers": "Explora lo que ofrece este negocio",
  "View product": "Ver producto",
  "View full product": "Ver producto completo",
  "View full product: {productName}": "Ver producto completo: {productName}",
  "Product details": "Detalles del producto",
  "Close product details": "Cerrar detalles del producto",
  "No products are published right now.": "No hay productos publicados en este momento.",
  pts: "pts",
  "Loading rewards program…": "Cargando programa de recompensas…",
  "Live holiday theme": "Tema festivo en vivo",
  Commemoration: "Conmemoración",
  Holiday: "Festividad",
  Event: "Evento",
  "Always available": "Siempre disponible",
  "Honoring Dr. Martin Luther King Jr.": "En honor al Dr. Martin Luther King Jr.",
  "A day to reflect on service, unity, and the work of building a more just community.":
    "Un día para reflexionar sobre el servicio, la unidad y el trabajo de construir una comunidad más justa.",
  "A Spring Celebration": "Una celebración de primavera",
  "Wishing our community a season of renewal, connection, and bright beginnings.":
    "Deseamos a nuestra comunidad una temporada de renovación, conexión y nuevos comienzos.",
  "September 11 — We Remember": "11 de septiembre — Recordamos",
  "Honoring the lives lost, the courage shown, and the enduring strength of our communities.":
    "Honramos las vidas perdidas, el valor demostrado y la fortaleza duradera de nuestras comunidades.",
  "Warm Winter Wishes": "Cálidos deseos de invierno",
  "Wishing our members and community a peaceful, joyful holiday season.":
    "Deseamos a nuestros miembros y a la comunidad una temporada festiva pacífica y alegre.",
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
  "Redeeming…": "Canjeando…",
  "Redeem {rewardName} for {count} points? This will deduct the points from your balance.":
    "¿Canjear {rewardName} por {count} puntos? Esto descontará los puntos de tu saldo.",
  "This business has not published an available reward yet. Check back soon.":
    "Este negocio aún no ha publicado una recompensa disponible. Vuelve pronto.",
  "Member products": "Productos para miembros",
  "Products from {businessName}": "Productos de {businessName}",
  "This business has not published products yet.": "Este negocio aún no ha publicado productos.",
  "Earn on your next visit": "Gana en tu próxima visita",
  "Show your unique member code at checkout.": "Muestra tu código único de miembro al pagar.",
  "Show member code": "Mostrar código de miembro",
  "Invite friends & family": "Invita a amigos y familiares",
  "Share your rewards link": "Comparte tu enlace de recompensas",
  "Friends can use your secure link to create a wallet for {businessName}.":
    "Tus amigos pueden usar tu enlace seguro para crear una billetera de {businessName}.",
  "Copy link": "Copiar enlace",
  "Referral link copied.": "Enlace de referido copiado.",
  "Copy failed. Select and copy the link manually.":
    "No se pudo copiar. Selecciona y copia el enlace manualmente.",
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
  "Password must contain between 8 and 200 characters":
    "La contraseña debe contener entre 8 y 200 caracteres",
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
  "Rewards program unavailable": "El programa de recompensas no está disponible",
  "Wallet failed to load": "No se pudo cargar la billetera",
  "Redemption failed": "No se pudo canjear la recompensa",
  "Referral link unavailable": "El enlace de referido no está disponible",
  "Unable to complete the request. Please try again.":
    "No se pudo completar la solicitud. Inténtalo de nuevo.",
  "Your account is private. This business can manage rewards, but it cannot see your password.":
    "Tu cuenta es privada. Este negocio puede administrar recompensas, pero no puede ver tu contraseña.",
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
    /password must contain between 8 and 200 characters/i,
    "Password must contain between 8 and 200 characters",
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
