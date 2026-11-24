/**
 * Contenido de la base de conocimiento: los 3 grupos y las 12 guías, con el texto por idioma.
 * Generado desde design/web/docs.mjs (DOCS y DOC_GROUPS) con las correcciones de web-30
 * (WhatsApp en todos los planes, `updated` por guía). Solo se importa en el servidor:
 * a los componentes de cliente les llegan las piezas que pintan, nunca el módulo entero.
 * Marcado en los textos: solo `**negrita**` (lo interpreta `RichText`).
 */
// Sin la dependencia server-only (no instalada): lo importan solo páginas y componentes de servidor.
import type { DocId } from '@gensmart/shared';
import type { SiteLanguage } from '@/lib/site-routes';
import type { DocGroupId } from '@/lib/docs-routes';

export type ByLang = Record<SiteLanguage, string>;

export type DocType = 'guide' | 'video';

/** Funciones que dependen del plan: la etiqueta "Disponible en los planes" sale de `PLAN_LIMITS`. */
export type DocPlanFeature = 'whatsapp' | 'humanTakeover';

export type DocBlock =
  | { kind: 'p'; text: ByLang }
  | { kind: 'h2'; text: ByLang; id: ByLang }
  | { kind: 'note'; text: ByLang }
  | { kind: 'steps'; items: ByLang[] }
  | { kind: 'list'; variant: 'plain' | 'check' | 'fix'; items: ByLang[] }
  | { kind: 'video'; videoId: string; title: ByLang; caption: ByLang; durationSec: number }
  | { kind: 'chapters'; videoId: string; items: { start: number; title: ByLang }[] };

export interface DocGroupData {
  id: DocGroupId;
  icon: 'zap' | 'inbox' | 'plug';
  name: ByLang;
  desc: ByLang;
}

export interface DocData {
  id: DocId;
  group: DocGroupId;
  type: DocType;
  minutes: number;
  /** Última revisión (ISO). Va en "Actualizado" y en `dateModified`. */
  updated: string;
  planFeature?: DocPlanFeature;
  slug: ByLang;
  title: ByLang;
  summary: ByLang;
  body: DocBlock[];
  /** Relacionadas ("Sigue con"). */
  next: DocId[];
}

export const DOC_GROUP_DATA: readonly DocGroupData[] = [
  {
    id: "start",
    icon: "zap",
    name: {
      es: "Empezar",
      en: "Get started"
    },
    desc: {
      es: "Del primer agente a la primera conversación con un cliente real, en este orden.",
      en: "From your first agent to your first real customer conversation, in this order."
    }
  },
  {
    id: "operate",
    icon: "inbox",
    name: {
      es: "Operar cada día",
      en: "Run it day to day"
    },
    desc: {
      es: "Lo que usa tu equipo cuando el agente ya está activo.",
      en: "What your team uses once the agent is live."
    }
  },
  {
    id: "extend",
    icon: "plug",
    name: {
      es: "Ampliar",
      en: "Extend"
    },
    desc: {
      es: "Cuando ya funciona y quieres llegar más lejos.",
      en: "When it already works and you want to go further."
    }
  }
];

export const DOCS: readonly DocData[] = [
  {
    id: "que-es-gensmart",
    group: "start",
    type: "video",
    minutes: 2,
    updated: "2026-11-24",
    slug: {
      es: "que-es-gensmart",
      en: "what-is-gensmart"
    },
    title: {
      es: "Qué es GenSmart",
      en: "What is GenSmart"
    },
    summary: {
      es: "En dos minutos: qué es la plataforma, qué hace tu agente y cómo se conecta a tu negocio.",
      en: "In two minutes: what the platform is, what your agent does and how it connects to your business."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "GenSmart es la plataforma agéntica donde creas el agente de IA que tu negocio necesita: responde, califica y agenda por ti, sin escribir código. Y cuando hace falta, tú tomas la conversación.",
          en: "GenSmart is the agentic platform where you create the AI agent your business needs: it answers, qualifies and books for you, with no code. And when needed, you take over the conversation."
        }
      },
      {
        kind: "video",
        videoId: "hgc0L3aEJT0",
        title: {
          es: "GenSmart: la plataforma agéntica donde creas cualquier agente de IA",
          en: "GenSmart: the agentic platform where you create any AI agent"
        },
        caption: {
          es: "Duración: 2:10",
          en: "Length: 2:10"
        },
        durationSec: 130
      },
      {
        kind: "h2",
        text: {
          es: "Lo que verás en el video",
          en: "What you will see in the video"
        },
        id: {
          es: "lo-que-veras-en-el-video",
          en: "what-you-will-see-in-the-video"
        }
      },
      {
        kind: "chapters",
        videoId: "hgc0L3aEJT0",
        items: [
          {
            start: 0,
            title: {
              es: "Tus clientes escriben a toda hora",
              en: "Your customers message you at all hours"
            }
          },
          {
            start: 16,
            title: {
              es: "Qué es GenSmart",
              en: "What is GenSmart"
            }
          },
          {
            start: 29,
            title: {
              es: "Listo en menos de 5 minutos",
              en: "Live in under 5 minutes"
            }
          },
          {
            start: 41,
            title: {
              es: "Cada negocio crea el suyo",
              en: "Every business builds its own"
            }
          },
          {
            start: 52,
            title: {
              es: "Qué hace tu agente por ti",
              en: "What your agent does for you"
            }
          },
          {
            start: 63,
            title: {
              es: "Percibe, razona, planea y actúa",
              en: "Perceives, reasons, plans and acts"
            }
          },
          {
            start: 87,
            title: {
              es: "Todo queda en tu CRM",
              en: "Everything lands in your CRM"
            }
          },
          {
            start: 96,
            title: {
              es: "Los canales donde ya te escriben",
              en: "The channels where they already write to you"
            }
          },
          {
            start: 107,
            title: {
              es: "Conecta tus herramientas",
              en: "Connect your tools"
            }
          },
          {
            start: 122,
            title: {
              es: "Crea tu agente",
              en: "Create your agent"
            }
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "El ciclo del agente con cada mensaje",
          en: "The agent cycle with every message"
        },
        id: {
          es: "el-ciclo-del-agente-con-cada-mensaje",
          en: "the-agent-cycle-with-every-message"
        }
      },
      {
        kind: "p",
        text: {
          es: "A diferencia de un asistente que solo responde, el agente sigue un ciclo con cada mensaje:",
          en: "Unlike an assistant that only replies, the agent follows a cycle with every message:"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Percibe:** lee el mensaje y el historial.",
            en: "**Perceives:** it reads the message and the history."
          },
          {
            es: "**Razona:** entiende qué quiere el cliente y qué lo frena.",
            en: "**Reasons:** it understands what the customer wants and what is holding them back."
          },
          {
            es: "**Planea:** decide si cotiza, agenda o pasa la conversación a una persona.",
            en: "**Plans:** it decides whether to quote, book or hand off to a person."
          },
          {
            es: "**Actúa:** ejecuta y lo registra en tu CRM.",
            en: "**Acts:** it executes and logs it in your CRM."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué sigue",
          en: "What comes next"
        },
        id: {
          es: "que-sigue",
          en: "what-comes-next"
        }
      },
      {
        kind: "p",
        text: {
          es: "Para armar el tuyo, empieza por la guía \"Crea tu primer agente\". Los seis canales y las más de 10.000 integraciones se explican en las guías de WhatsApp e integraciones.",
          en: "To build yours, start with the guide \"Create your first agent\". The six channels and the 10,000+ integrations are covered in the WhatsApp and integrations guides."
        }
      }
    ],
    next: [
      "primer-agente",
      "conectar-whatsapp"
    ]
  },
  {
    id: "primer-agente",
    group: "start",
    type: "guide",
    minutes: 2,
    updated: "2026-11-24",
    slug: {
      es: "crear-tu-primer-agente",
      en: "create-your-first-agent"
    },
    title: {
      es: "Crea tu primer agente",
      en: "Create your first agent"
    },
    summary: {
      es: "Del botón Crear agente al agente publicado: plantilla o cero, prompt, información de tu negocio, prueba y canal.",
      en: "From the Create agent button to a published agent: template or blank, prompt, your business information, test and channel."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "Un agente de GenSmart tiene un trabajo: calificar leads, atender dudas o agendar citas. Esta guía te lleva de cero a un agente publicado, y después lo afinas con las conversaciones reales.",
          en: "A GenSmart agent has one job: qualify leads, answer questions or book appointments. This guide takes you from zero to a published agent, and afterwards you refine it with real conversations."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Una cuenta de GenSmart",
            en: "A GenSmart account"
          },
          {
            es: "Claro cuál será el trabajo del agente, por ejemplo \"calificar y agendar una demo\"",
            en: "A clear idea of the agent's job, for example \"qualify and book a demo\""
          },
          {
            es: "La información de tu negocio a mano: servicios, precios, horarios y preguntas frecuentes",
            en: "Your business information at hand: services, prices, hours and frequently asked questions"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso",
          en: "Step by step"
        },
        id: {
          es: "paso-a-paso",
          en: "step-by-step"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "En **Agentes de IA**, haz clic en **Crear agente** y elige cómo empezar: **desde una plantilla** (ya trae el prompt, las variables y las herramientas configurados) o **desde cero** (le pones nombre y una descripción opcional). Todo se puede cambiar después.",
            en: "In **AI Agents**, click **Create Agent** and choose how to start: **from a template** (it already comes with the prompt, variables and tools set up) or **from scratch** (you give it a name and an optional description). Everything can be changed later."
          },
          {
            es: "En la pestaña **Prompt**, escribe las instrucciones del agente: qué trabajo hace, cómo habla y cuándo pasa a una persona. Si no sabes cómo redactarlas, usa el botón **Generar con IA**. Si partiste de una plantilla, ajusta el que ya trae.",
            en: "In the **Prompt** tab, write the agent's instructions: what job it does, how it speaks and when it hands off to a person. If you are not sure how to word them, use the **Generate with AI** button. If you started from a template, adjust the one it brings."
          },
          {
            es: "Carga la información de tu negocio en la **base de conocimiento**: archivos PDF, MD o TXT, o direcciones web. El agente responde con eso, no inventa.",
            en: "Load your business information into the **knowledge base**: PDF, MD or TXT files, or web addresses. The agent answers with that, it does not make things up."
          },
          {
            es: "Pruébalo con **Vista previa**. Los mensajes de prueba no cuentan para el uso de tu plan.",
            en: "Test it with **Preview**. Test messages do not count toward your plan usage."
          },
          {
            es: "En la pestaña **Canales**, activa el canal donde va a atender y conéctalo.",
            en: "In the **Channels** tab, turn on the channel where it will work and connect it."
          },
          {
            es: "Haz clic en **Publicar**. Se guarda la versión y el agente queda activo.",
            en: "Click **Publish**. The version is saved and the agent goes live."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Plantillas disponibles",
          en: "Available templates"
        },
        id: {
          es: "plantillas-disponibles",
          en: "available-templates"
        }
      },
      {
        kind: "p",
        text: {
          es: "Hay plantillas para atención al cliente, captación de leads, agenda de citas, recepción de clínica, inmobiliaria, restaurante y tienda WooCommerce.",
          en: "There are templates for customer service, lead capture, appointment scheduling, clinic reception, real estate, restaurants and WooCommerce stores."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Canales donde puede atender",
          en: "Channels where it can work"
        },
        id: {
          es: "canales-donde-puede-atender",
          en: "channels-where-it-can-work"
        }
      },
      {
        kind: "p",
        text: {
          es: "Chat web, WhatsApp, Messenger, Instagram, Telegram y correo. TikTok aparece en la plataforma como Próximamente.",
          en: "Web chat, WhatsApp, Messenger, Instagram, Telegram and email. TikTok appears in the platform as Coming soon."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "Si el agente responde algo que no esperabas, vuelve a **Prompt**, agrega la regla que falta y prueba otra vez en Vista previa.",
            en: "If the agent answers something you did not expect, go back to **Prompt**, add the missing rule and test again in Preview."
          },
          {
            es: "Si no usa la información que cargaste, revisa que el archivo haya terminado de procesarse y aparezca como **Listo**.",
            en: "If it does not use the information you loaded, check that the file has finished processing and shows as **Ready**."
          },
          {
            es: "Si publicaste una versión que no te convence, en **Versiones** puedes revertir a una anterior.",
            en: "If you published a version you are not happy with, in **Versions** you can roll back to a previous one."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Antes de dejarlo atendiendo clientes reales, haz la lista de la guía \"Prueba tu agente antes de publicarlo\".",
          en: "Before letting it serve real customers, run the checklist in the guide \"Test your agent before publishing\"."
        }
      }
    ],
    next: [
      "conectar-whatsapp",
      "base-de-conocimiento"
    ]
  },
  {
    id: "conectar-whatsapp",
    group: "start",
    type: "guide",
    minutes: 2,
    updated: "2026-11-24",
    planFeature: "whatsapp",
    slug: {
      es: "conectar-whatsapp",
      en: "connect-whatsapp"
    },
    title: {
      es: "Conecta tu número de WhatsApp Business",
      en: "Connect your WhatsApp Business number"
    },
    summary: {
      es: "Autorizas con Facebook desde el navegador y GenSmart configura la cuenta, el webhook y el número por ti.",
      en: "You authorize with Facebook from the browser and GenSmart sets up the account, the webhook and the number for you."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "La configuración rápida usa el inicio de sesión con Facebook. No copias llaves de API ni configuras un webhook a mano: GenSmart identifica tu cuenta de WhatsApp Business, suscribe el webhook y registra tu número.",
          en: "Quick setup uses Facebook login. You do not copy API keys or set up a webhook by hand: GenSmart finds your WhatsApp Business account, subscribes the webhook and registers your number."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Un agente creado en tu cuenta de GenSmart",
            en: "An agent created in your GenSmart account"
          },
          {
            es: "Acceso a la cuenta de Facebook que administra tu negocio en Meta",
            en: "Access to the Facebook account that manages your business in Meta"
          },
          {
            es: "El número de WhatsApp Business que vas a usar, o la disposición de agregar uno nuevo durante el proceso. Cada número se conecta a un solo agente.",
            en: "The WhatsApp Business number you will use, or willingness to add a new one during the process. Each number connects to one agent only."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso",
          en: "Step by step"
        },
        id: {
          es: "paso-a-paso",
          en: "step-by-step"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "En tu agente, abre la pestaña **Canales** y activa **WhatsApp**.",
            en: "In your agent, open the **Channels** tab and turn on **WhatsApp**."
          },
          {
            es: "En **Configuración rápida**, haz clic en **Conectar con Facebook**.",
            en: "Under **Quick Setup**, click **Connect with Facebook**."
          },
          {
            es: "Autoriza a GenSmart en la ventana emergente de Facebook y completa todos los pasos que te muestre, incluido agregar y verificar tu número con el código que te llega.",
            en: "Authorize GenSmart in the Facebook popup and complete every step it shows, including adding and verifying your number with the code you receive."
          },
          {
            es: "Si tienes varias cuentas o números, **selecciona tu cuenta de WhatsApp Business** y **tu número de teléfono**.",
            en: "If you have several accounts or numbers, **select your WhatsApp Business account** and **your phone number**."
          },
          {
            es: "Espera unos segundos mientras GenSmart conecta tu cuenta y registra el número. Al terminar verás el aviso **WhatsApp conectado** con tu teléfono, y el agente empieza a responder los mensajes que lleguen.",
            en: "Wait a few seconds while GenSmart connects your account and registers the number. When it finishes you will see the **WhatsApp connected** notice with your phone, and the agent starts answering the messages that arrive."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Si prefieres la configuración manual",
          en: "If you prefer manual setup"
        },
        id: {
          es: "si-prefieres-la-configuracion-manual",
          en: "if-you-prefer-manual-setup"
        }
      },
      {
        kind: "p",
        text: {
          es: "Debajo de la configuración rápida está **Configuración manual**. Ahí ingresas el ID del número de teléfono, el WABA ID y un token de acceso permanente generado en Meta Business Manager (Usuarios del sistema), y configuras en el panel de desarrolladores de Meta la URL del webhook y el token de verificación que GenSmart te muestra.",
          en: "Below quick setup there is **Manual Setup**. There you enter the phone number ID, the WABA ID and a permanent access token generated in Meta Business Manager (System Users), and set the webhook URL and verify token that GenSmart shows you in the Meta developer dashboard."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "Si la conexión se cancela, haz clic de nuevo en **Conectar con Facebook** y asegúrate de completar todos los pasos de la ventana emergente. Si tu navegador la bloqueó, permítela.",
            en: "If the connection is cancelled, click **Connect with Facebook** again and make sure you complete every step in the popup. If your browser blocked it, allow it."
          },
          {
            es: "Si dice que no encuentra tu cuenta de WhatsApp Business o tu número, termina primero la configuración de WhatsApp Business en Meta Business Manager y vuelve a intentarlo.",
            en: "If it says it cannot find your WhatsApp Business account or your number, finish the WhatsApp Business setup in Meta Business Manager first and try again."
          },
          {
            es: "Si el número se agregó pero no está verificado, vuelve a conectar y completa el paso del código de verificación.",
            en: "If the number was added but is not verified, connect again and complete the verification code step."
          },
          {
            es: "Si dice que el número ya está conectado a otro agente, elige uno diferente o desconéctalo del otro agente.",
            en: "If it says the number is already connected to another agent, choose a different one or disconnect it from the other agent."
          },
          {
            es: "Si la sesión expiró o el SDK de Facebook no cargó, actualiza la página e inténtalo de nuevo.",
            en: "If the session expired or the Facebook SDK did not load, refresh the page and try again."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Si desconectas WhatsApp desde la misma pestaña, el agente deja de recibir y enviar mensajes por ese canal. Y para saber por qué algunos mensajes salen y otros no, lee la guía de la ventana de 24 horas.",
          en: "If you disconnect WhatsApp from the same tab, the agent stops receiving and sending messages on that channel. And to understand why some messages send and others do not, read the guide on the 24-hour window."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Sobre los costos de Meta",
          en: "About Meta costs"
        },
        id: {
          es: "sobre-los-costos-de-meta",
          en: "about-meta-costs"
        }
      },
      {
        kind: "p",
        text: {
          es: "A partir del mensaje de servicio 1.000 del mes, Meta cobra directamente a tu cuenta de WhatsApp Business. Es un costo de Meta hacia tu negocio, no un cargo de GenSmart, y GenSmart no agrega comisión ni recargo.",
          en: "From the 1,000th service message of the month, Meta charges your WhatsApp Business account directly. It is a cost from Meta to your business, not a GenSmart fee, and GenSmart adds no commission or markup."
        }
      }
    ],
    next: [
      "ventana-24-horas",
      "primer-agente"
    ]
  },
  {
    id: "base-de-conocimiento",
    group: "start",
    type: "guide",
    minutes: 5,
    updated: "2026-11-24",
    slug: {
      es: "base-de-conocimiento",
      en: "knowledge-base"
    },
    title: {
      es: "Base de conocimiento: lo que sabe tu agente",
      en: "Knowledge base: what your agent knows"
    },
    summary: {
      es: "Cómo cargar archivos y páginas web, qué formatos y límites hay, cómo escribir el contenido y cómo comprobar que el agente lo usa.",
      en: "How to load files and web pages, which formats and limits apply, how to write the content and how to check the agent uses it."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "La base de conocimiento es la información de tu negocio que el agente consulta para responder: precios, políticas, catálogo y preguntas frecuentes. El agente responde con lo que hay ahí. Si algo no está, no debe inventarlo: debe decir que no lo sabe.",
          en: "The knowledge base is the business information the agent consults to answer: prices, policies, catalog and frequently asked questions. The agent answers with what is there. If something is missing, it should not make it up: it should say it does not know."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Un agente creado (si no lo tienes, sigue la guía **Crea tu primer agente**)",
            en: "An agent already created (if not, follow the **Create your first agent** guide)"
          },
          {
            es: "Tus documentos listos en PDF, DOCX, TXT o MD, de máximo 20 MB cada uno",
            en: "Your documents ready as PDF, DOCX, TXT or MD, 20 MB each at most"
          },
          {
            es: "O las direcciones web donde ya está publicada la información (tu sitio, tu catálogo, tus preguntas frecuentes)",
            en: "Or the web addresses where the information is already published (your site, catalog, FAQ)"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso",
          en: "Step by step"
        },
        id: {
          es: "paso-a-paso",
          en: "step-by-step"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Entra al agente y abre la pestaña **Herramientas**. Haz clic en **Agregar herramienta** y elige **Base de Conocimiento**.",
            en: "Open the agent and go to the **Tools** tab. Click **Add tool** and choose **Knowledge Base**."
          },
          {
            es: "Ponle un nombre y una descripción cortos, por ejemplo \"Catálogo y políticas\". Esa descripción le dice al agente para qué sirve esta fuente.",
            en: "Give it a short name and description, for example \"Catalog and policies\". That description tells the agent what this source is for."
          },
          {
            es: "Sube tus archivos: arrástralos a la zona de carga o haz clic para explorar. Puedes subir varios a la vez.",
            en: "Upload your files: drag them to the upload area or click to browse. You can upload several at once."
          },
          {
            es: "Si la información está en una página web, pega la dirección en el campo de URL y haz clic en **Agregar URL**. GenSmart lee la página y la guarda como fuente.",
            en: "If the information is on a web page, paste the address in the URL field and click **Add URL**. GenSmart reads the page and stores it as a source."
          },
          {
            es: "Espera a que cada fuente pase de **Procesando** a **Listo**. Se actualiza sola cada pocos segundos.",
            en: "Wait for each source to go from **Processing** to **Ready**. It refreshes by itself every few seconds."
          },
          {
            es: "Deja la herramienta habilitada y pruébala en **Vista previa** (más abajo, cómo comprobarlo).",
            en: "Leave the tool enabled and test it in **Preview** (see below how to check it)."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Formatos y límites",
          en: "Formats and limits"
        },
        id: {
          es: "formatos-y-limites",
          en: "formats-and-limits"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Archivos:** PDF, DOCX, TXT y MD, de hasta 20 MB cada uno",
            en: "**Files:** PDF, DOCX, TXT and MD, up to 20 MB each"
          },
          {
            es: "**Páginas web:** por dirección. El contenido se lee en el momento de agregarla; si la página cambia, agrégala de nuevo",
            en: "**Web pages:** by address. The content is read when you add it; if the page changes, add it again"
          },
          {
            es: "**Cantidad de fuentes según tu plan:** Solo 1, Starter 5, Pro 20 y Enterprise sin límite. La plataforma te muestra cuántas llevas usadas",
            en: "**Number of sources by plan:** Solo 1, Starter 5, Pro 20 and Enterprise unlimited. The platform shows how many you have used"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué significa cada estado",
          en: "What each status means"
        },
        id: {
          es: "que-significa-cada-estado",
          en: "what-each-status-means"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Procesando:** GenSmart está leyendo la fuente y dividiéndola en fragmentos para poder buscar en ella",
            en: "**Processing:** GenSmart is reading the source and splitting it into chunks so it can be searched"
          },
          {
            es: "**Listo:** la fuente ya se puede consultar. Verás cuántos fragmentos generó",
            en: "**Ready:** the source can now be consulted. You will see how many chunks it produced"
          },
          {
            es: "**Error:** no se pudo leer. Usa **Reprocesar** para intentarlo de nuevo",
            en: "**Error:** it could not be read. Use **Reprocess** to try again"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cómo escribir el contenido",
          en: "How to write the content"
        },
        id: {
          es: "como-escribir-el-contenido",
          en: "how-to-write-the-content"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Parte de las veinte preguntas que más te hacen tus clientes y responde cada una.",
            en: "Start from the twenty questions your customers ask most and answer each one."
          },
          {
            es: "Escribe datos concretos: precios, plazos, horarios y condiciones. Evita frases como \"consulta con nosotros\".",
            en: "Write concrete facts: prices, lead times, hours and conditions. Avoid phrases like \"ask us\"."
          },
          {
            es: "Pon cada dato en un solo lugar. Si el precio aparece en dos archivos con valores distintos, el agente puede dar cualquiera.",
            en: "Put each fact in one place. If the price appears in two files with different values, the agent may give either."
          },
          {
            es: "Usa títulos claros y párrafos cortos. Un archivo por tema funciona mejor que un solo documento enorme.",
            en: "Use clear headings and short paragraphs. One file per topic works better than one huge document."
          },
          {
            es: "Si un PDF es una imagen escaneada, el texto no se puede leer: expórtalo con texto seleccionable.",
            en: "If a PDF is a scanned image, the text cannot be read: export it with selectable text."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Lo que el agente no debe responder (por ejemplo, descuentos que no existen) se define en el **Prompt**, no en la base de conocimiento.",
          en: "What the agent must not answer (for example, discounts that do not exist) is defined in the **Prompt**, not in the knowledge base."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Cómo comprobar que funciona",
          en: "How to check it works"
        },
        id: {
          es: "como-comprobar-que-funciona",
          en: "how-to-check-it-works"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre **Vista previa** y haz las preguntas de tu lista.",
            en: "Open **Preview** and ask the questions on your list."
          },
          {
            es: "Compara cada respuesta con la que darías tú. El dato debe coincidir con tu documento.",
            en: "Compare each answer with the one you would give. The fact must match your document."
          },
          {
            es: "Inventa tres preguntas que no estén en la base y confirma que el agente dice que no lo sabe o pasa el caso a una persona.",
            en: "Make up three questions that are not in the base and confirm the agent says it does not know or hands the case to a person."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "El agente no usa tu información: revisa que la fuente esté en **Listo** y que la herramienta esté **Habilitada**.",
            en: "The agent does not use your information: check that the source is **Ready** and the tool is **Enabled**."
          },
          {
            es: "Responde con un dato viejo: reemplaza el archivo o vuelve a agregar la URL, y borra la fuente anterior.",
            en: "It answers with an old fact: replace the file or add the URL again, and delete the previous source."
          },
          {
            es: "La fuente queda en Error: prueba **Reprocesar**. Si sigue igual, revisa que el archivo no supere 20 MB y que el PDF tenga texto, no solo imágenes.",
            en: "The source stays in Error: try **Reprocess**. If it persists, check the file is under 20 MB and the PDF has text, not only images."
          },
          {
            es: "No te deja subir más: llegaste al límite de fuentes de tu plan. Borra una que ya no uses o sube de plan.",
            en: "You cannot upload more: you reached the source limit of your plan. Delete one you no longer use or upgrade."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Para conectar tu inventario, crear pedidos o consultar sistemas externos se usan otras herramientas, no la base de conocimiento. Mira la guía de **Integraciones**.",
          en: "To connect your inventory, create orders or query external systems, other tools are used, not the knowledge base. See the **Integrations** guide."
        }
      }
    ],
    next: [
      "traspaso",
      "probar-antes"
    ]
  },
  {
    id: "traspaso",
    group: "operate",
    type: "guide",
    minutes: 6,
    updated: "2026-11-24",
    planFeature: "humanTakeover",
    slug: {
      es: "traspaso-a-una-persona",
      en: "handoff-to-a-person"
    },
    title: {
      es: "Traspaso a una persona",
      en: "Handoff to a person"
    },
    summary: {
      es: "Las dos formas de que una persona entre a la conversación: el botón que envía el agente y Tomar control en la bandeja. Cómo se configuran y qué ves.",
      en: "The two ways a person joins the conversation: the button the agent sends and Take control from the inbox. How to set them up and what your team sees."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "El traspaso es parte del diseño del agente, no un plan B. En GenSmart hay **dos formas** de que una persona entre a la conversación, y sirven para cosas distintas. Las dos requieren el plan Starter o superior.",
          en: "Handoff is part of the agent's design, not a plan B. GenSmart has **two ways** for a person to join the conversation, and they serve different purposes. Both require the Starter plan or higher."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Las dos formas, lado a lado",
          en: "The two ways, side by side"
        },
        id: {
          es: "las-dos-formas-lado-a-lado",
          en: "the-two-ways-side-by-side"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Derivación a humano:** el cliente pide hablar con una persona y el agente le envía un botón. Al tocarlo, se abre un chat de WhatsApp con alguien de tu equipo. La conversación sigue por fuera del agente.",
            en: "**Handoff to a human:** the customer asks to talk to a person and the agent sends a button. Tapping it opens a WhatsApp chat with someone on your team. The conversation continues outside the agent."
          },
          {
            es: "**Tomar control:** alguien de tu equipo entra a la conversación desde la bandeja y escribe en el mismo chat. Mientras tanto, el agente deja de responder.",
            en: "**Take control:** someone on your team joins the conversation from the inbox and writes in the same chat. Meanwhile, the agent stops answering."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Plan Starter o superior",
            en: "Starter plan or higher"
          },
          {
            es: "Para la derivación: el número de WhatsApp de cada persona que atenderá, con código de país (por ejemplo 573001234567)",
            en: "For handoff: the WhatsApp number of each person who will answer, with country code (for example 573001234567)"
          },
          {
            es: "Ese número debe ser distinto al del agente. Si usas el mismo, el enlace vuelve a abrir el chat con el bot",
            en: "That number must be different from the agent's. If you use the same one, the link opens the chat with the bot again"
          },
          {
            es: "Para los horarios: un calendario creado en GenSmart (opcional)",
            en: "For schedules: a calendar created in GenSmart (optional)"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: activar la derivación a humano",
          en: "Step by step: turn on handoff to a human"
        },
        id: {
          es: "paso-a-paso-activar-la-derivacion-a-humano",
          en: "step-by-step-turn-on-handoff-to-a-human"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Entra al agente y abre la pestaña **Ajustes**. Busca la sección **Derivación a humano** y actívala.",
            en: "Open the agent and go to the **Settings** tab. Find the **Handoff to human** section and turn it on."
          },
          {
            es: "En **Contactos de soporte**, haz clic en **Agregar contacto**. Escribe el nombre (por ejemplo \"Ana (Ventas)\") y su número de WhatsApp. Puedes agregar hasta 5.",
            en: "Under **Support contacts**, click **Add contact**. Enter the name (for example \"Ana (Sales)\") and their WhatsApp number. You can add up to 5."
          },
          {
            es: "Si quieres horarios, asigna a cada contacto uno o más **calendarios de disponibilidad**. Sin calendario, el contacto está siempre disponible.",
            en: "If you want schedules, assign each contact one or more **availability calendars**. Without a calendar, the contact is always available."
          },
          {
            es: "Escribe el **texto del botón** (hasta 20 caracteres). Por defecto es \"Hablar con el equipo\".",
            en: "Write the **button text** (up to 20 characters). The default is \"Talk to the team\"."
          },
          {
            es: "Haz clic en **Guardar** y pruébalo en **Vista previa**. En la prueba el traspaso se simula: ves cómo responde el agente, pero no se envía ningún botón real.",
            en: "Click **Save** and test it in **Preview**. In the test the handoff is simulated: you see how the agent answers, but no real button is sent."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cómo funciona cuando un cliente lo pide",
          en: "How it works when a customer asks"
        },
        id: {
          es: "como-funciona-cuando-un-cliente-lo-pide",
          en: "how-it-works-when-a-customer-asks"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "El cliente pide hablar con una persona, o el agente falla dos veces en resolver su problema.",
            en: "The customer asks to talk to a person, or the agent fails twice to solve their problem."
          },
          {
            es: "Si no conoce el nombre del cliente, el agente lo pregunta una vez antes de enviar el botón.",
            en: "If it does not know the customer's name, the agent asks for it once before sending the button."
          },
          {
            es: "GenSmart elige a una persona disponible según los horarios. Si varias están disponibles, las rota. Si la conversación ya tuvo una, vuelve a la misma.",
            en: "GenSmart picks an available person based on schedules. If several are available, it rotates them. If the conversation already had one, it goes back to the same person."
          },
          {
            es: "El cliente recibe el botón. El mensaje de WhatsApp que se abre ya viene escrito con su nombre y su necesidad, así que tu equipo no empieza de cero.",
            en: "The customer receives the button. The WhatsApp message that opens is already written with their name and need, so your team does not start from zero."
          },
          {
            es: "En la bandeja la conversación queda marcada como **Derivada** y tu equipo recibe una notificación con un resumen interno que el cliente no ve.",
            en: "In the inbox the conversation is tagged **Handed off** and your team gets a notification with an internal summary the customer does not see."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "El agente nunca promete que alguien \"te va a escribir\": el cliente tiene que tocar el botón. Así nadie queda esperando una llamada que no llegará.",
          en: "The agent never promises that someone \"will write to you\": the customer has to tap the button. That way nobody waits for a call that will not come."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si no hay nadie disponible",
          en: "If nobody is available"
        },
        id: {
          es: "si-no-hay-nadie-disponible",
          en: "if-nobody-is-available"
        }
      },
      {
        kind: "p",
        text: {
          es: "Si ningún contacto está disponible en ese horario, el agente no envía el botón. Le explica al cliente el horario de atención y le ofrece dejar sus datos o agendar un momento. Tu equipo recibe igual la notificación de que se pidió ayuda.",
          en: "If no contact is available at that time, the agent does not send the button. It explains the office hours to the customer and offers to take their details or schedule a time. Your team still gets the notification that help was requested."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: tomar el control desde la bandeja",
          en: "Step by step: take control from the inbox"
        },
        id: {
          es: "paso-a-paso-tomar-el-control-desde-la-bandeja",
          en: "step-by-step-take-control-from-the-inbox"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre **Conversaciones** y entra a la conversación. Puedes filtrar por **Control humano** para ver las que piden atención.",
            en: "Open **Conversations** and go into the conversation. You can filter by **Human control** to see the ones asking for attention."
          },
          {
            es: "Haz clic en **Tomar control**. Verás el aviso \"Estás controlando esta conversación\" y el agente deja de responder.",
            en: "Click **Take control**. You will see the notice \"You are controlling this conversation\" and the agent stops answering."
          },
          {
            es: "Escribe al cliente desde el mismo chat. Los mensajes del cliente se siguen guardando mientras tanto.",
            en: "Write to the customer from the same chat. The customer's messages keep being saved meanwhile."
          },
          {
            es: "Cuando termines, haz clic en **Liberar a la IA**. GenSmart genera un resumen de tu intervención y el agente retoma la conversación.",
            en: "When you finish, click **Release to AI**. GenSmart generates a summary of your intervention and the agent takes over again."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Dónde funciona",
          en: "Where it works"
        },
        id: {
          es: "donde-funciona",
          en: "where-it-works"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "La derivación con botón funciona en WhatsApp, Messenger y chat web. En el chat web se envía como texto con el enlace",
            en: "The button handoff works on WhatsApp, Messenger and web chat. On web chat it is sent as text with the link"
          },
          {
            es: "Instagram, Telegram y correo todavía no usan la derivación a humano",
            en: "Instagram, Telegram and email do not use handoff to a human yet"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Reglas que conviene definir en el prompt",
          en: "Rules worth defining in the prompt"
        },
        id: {
          es: "reglas-que-conviene-definir-en-el-prompt",
          en: "rules-worth-defining-in-the-prompt"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "El cliente pide hablar con alguien",
            en: "The customer asks to talk to someone"
          },
          {
            es: "Hay enojo o un reclamo",
            en: "There is anger or a complaint"
          },
          {
            es: "Hay dinero de por medio: reembolsos, cobros, descuentos fuera de lista",
            en: "Money is involved: refunds, charges, off-list discounts"
          },
          {
            es: "El tema es delicado: salud, legal, datos personales",
            en: "The topic is sensitive: health, legal, personal data"
          },
          {
            es: "El agente no sabe la respuesta",
            en: "The agent does not know the answer"
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Para ver cada regla con ejemplos, lee \"Cuándo un agente de IA debe pasar la conversación a una persona\" en el blog.",
          en: "To see each rule with examples, read \"When an AI agent should hand the conversation to a person\" on the blog."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "No aparece la sección de derivación o dice que requiere plan: tu plan es menor que Starter. Actualiza el plan.",
            en: "The handoff section does not appear or says it needs a plan: your plan is below Starter. Upgrade."
          },
          {
            es: "No te deja activarla: agrega al menos un contacto. Revisa que el número tenga de 10 a 15 dígitos y no esté repetido.",
            en: "You cannot turn it on: add at least one contact. Check the number has 10 to 15 digits and is not repeated."
          },
          {
            es: "El agente no envía el botón: puede que nadie esté disponible en ese horario o que ya haya enviado uno hace poco. Por defecto espera 10 minutos entre botones; lo cambias en **Avanzado**.",
            en: "The agent does not send the button: nobody may be available at that time, or it already sent one recently. By default it waits 10 minutes between buttons; you change it under **Advanced**."
          },
          {
            es: "El botón abre el chat con el bot: el número del contacto es el mismo del agente. Usa otro número.",
            en: "The button opens the chat with the bot: the contact's number is the same as the agent's. Use another number."
          },
          {
            es: "El agente sigue respondiendo cuando ya tomaste el control: revisa que veas el aviso \"Estás controlando esta conversación\".",
            en: "The agent keeps answering after you took control: check that you see the \"You are controlling this conversation\" notice."
          }
        ]
      }
    ],
    next: [
      "bandeja",
      "probar-antes"
    ]
  },
  {
    id: "bandeja",
    group: "operate",
    type: "guide",
    minutes: 5,
    updated: "2026-11-24",
    slug: {
      es: "bandeja-unificada",
      en: "unified-inbox"
    },
    title: {
      es: "Bandeja unificada",
      en: "Unified inbox"
    },
    summary: {
      es: "Dónde ver las conversaciones de todos tus agentes y canales, cómo filtrarlas, cuáles piden atención y qué puedes hacer dentro de cada una.",
      en: "Where to see the conversations of all your agents and channels, how to filter them, which ones need attention and what you can do inside each."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "La bandeja es el lugar donde tu equipo ve lo que están hablando tus agentes: todas las conversaciones de todos los canales, en una sola lista. Desde ahí entras cuando hace falta, sin abrir WhatsApp, Instagram o el chat web por separado.",
          en: "The inbox is where your team sees what your agents are talking about: all conversations from all channels, in a single list. From here you step in when needed, without opening WhatsApp, Instagram or web chat separately."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Al menos un agente publicado con un canal conectado",
            en: "At least one published agent with a connected channel"
          },
          {
            es: "Para escribir como persona en una conversación: plan Starter o superior (mira la guía **Traspaso a una persona**)",
            en: "To write as a person in a conversation: Starter plan or higher (see the **Handoff to a person** guide)"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: revisar tus conversaciones",
          en: "Step by step: review your conversations"
        },
        id: {
          es: "paso-a-paso-revisar-tus-conversaciones",
          en: "step-by-step-review-your-conversations"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre **Conversaciones** en el menú de la plataforma.",
            en: "Open **Conversations** in the platform menu."
          },
          {
            es: "Verás la lista con el contacto, el canal, el agente y el último mensaje. Las que necesitan ayuda humana aparecen primero, marcadas como **Necesita ayuda**.",
            en: "You will see the list with the contact, channel, agent and last message. The ones that need human help appear first, marked **Needs help**."
          },
          {
            es: "Haz clic en una conversación para abrir el hilo completo.",
            en: "Click a conversation to open the full thread."
          },
          {
            es: "En el panel lateral verás la información del contacto, el canal, el agente, cuándo empezó y las **variables capturadas** (nombre, interés, lo que el agente haya pedido).",
            en: "In the side panel you will see the contact information, channel, agent, when it started and the **captured variables** (name, interest, whatever the agent asked for)."
          },
          {
            es: "Si hay una puntuación de lead, aparece en la conversación. Cómo se calcula está en la guía de CRM.",
            en: "If there is a lead score, it appears in the conversation. How it is calculated is in the CRM guide."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cómo filtrar",
          en: "How to filter"
        },
        id: {
          es: "como-filtrar",
          en: "how-to-filter"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Agente:** solo las conversaciones de un agente, o **Todos los agentes**",
            en: "**Agent:** only one agent's conversations, or **All agents**"
          },
          {
            es: "**Canal:** web, WhatsApp, Telegram, correo, Instagram o Messenger",
            en: "**Channel:** web, WhatsApp, Telegram, email, Instagram or Messenger"
          },
          {
            es: "**Estado:** Todas, Activas, Cerradas o Control humano",
            en: "**Status:** All, Active, Closed or Human control"
          },
          {
            es: "**Búsqueda:** por nombre, teléfono o correo del contacto",
            en: "**Search:** by the contact's name, phone or email"
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Por defecto la lista muestra los últimos 8 días. Para ver conversaciones más antiguas, haz clic en **Ver todas**.",
          en: "By default the list shows the last 8 days. To see older conversations, click **Show all**."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Qué significa cada estado",
          en: "What each status means"
        },
        id: {
          es: "que-significa-cada-estado",
          en: "what-each-status-means"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Activa:** el agente de IA está atendiendo. Tú solo miras si quieres.",
            en: "**Active:** the AI agent is handling it. You only watch if you want."
          },
          {
            es: "**Control humano:** alguien de tu equipo tomó la conversación o la pidió el cliente. El agente no responde mientras tanto. Verás quién la tomó.",
            en: "**Human control:** someone on your team took the conversation or the customer asked for it. The agent does not answer meanwhile. You will see who took it."
          },
          {
            es: "**Cerrada:** el caso terminó. El agente deja de responder en ella y el historial se conserva.",
            en: "**Closed:** the case ended. The agent stops answering in it and the history is kept."
          },
          {
            es: "**Derivada:** etiqueta que aparece cuando el agente le envió al cliente el botón para hablar con una persona.",
            en: "**Handed off:** a tag that appears when the agent sent the customer the button to talk to a person."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué puedes hacer dentro de una conversación",
          en: "What you can do inside a conversation"
        },
        id: {
          es: "que-puedes-hacer-dentro-de-una-conversacion",
          en: "what-you-can-do-inside-a-conversation"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Tomar control** y escribir al cliente, y luego **Liberar a la IA** (detalle en la guía de traspaso)",
            en: "**Take control** and write to the customer, then **Release to AI** (details in the handoff guide)"
          },
          {
            es: "**Cerrar la conversación**. Te pide confirmar, porque el agente deja de responder",
            en: "**Close the conversation**. It asks you to confirm, because the agent stops answering"
          },
          {
            es: "**Ver el contacto** en el CRM desde el panel lateral",
            en: "**View the contact** in the CRM from the side panel"
          },
          {
            es: "**Eliminar** una o varias conversaciones seleccionadas. También se elimina el contacto si no tiene otras conversaciones, y no se puede deshacer",
            en: "**Delete** one or several selected conversations. The contact is also deleted if it has no other conversations, and it cannot be undone"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Avisos para no perderte un caso",
          en: "Alerts so you do not miss a case"
        },
        id: {
          es: "avisos-para-no-perderte-un-caso",
          en: "alerts-so-you-do-not-miss-a-case"
        }
      },
      {
        kind: "p",
        text: {
          es: "Puedes activar las notificaciones desde la propia bandeja. Te avisan cuando llega un mensaje nuevo de un cliente y cuando una conversación pide ayuda humana. La lista se actualiza sola.",
          en: "You can turn on notifications from the inbox itself. They alert you when a new customer message arrives and when a conversation asks for human help. The list refreshes by itself."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "No ves una conversación reciente: revisa los filtros activos (agente, canal, estado) y que no estés buscando algo con más de 8 días sin pulsar **Ver todas**.",
            en: "You do not see a recent conversation: check the active filters (agent, channel, status) and that you are not looking for something older than 8 days without clicking **Show all**."
          },
          {
            es: "No te deja tomar control: esa función requiere plan Starter o superior.",
            en: "It does not let you take control: that feature requires the Starter plan or higher."
          },
          {
            es: "Un canal dejó de responder: la bandeja muestra el aviso **Canal no disponible** cuando tu plan ya no incluye ese canal. Mejora el plan para reactivarlo.",
            en: "A channel stopped answering: the inbox shows the **Channel not available** alert when your plan no longer includes that channel. Upgrade the plan to reactivate it."
          },
          {
            es: "Una herramienta dejó de funcionar: igual que con los canales, el aviso **Herramienta no disponible** indica que tu plan ya no la incluye.",
            en: "A tool stopped working: as with channels, the **Tool not available** alert means your plan no longer includes it."
          }
        ]
      }
    ],
    next: [
      "crm",
      "traspaso"
    ]
  },
  {
    id: "crm",
    group: "operate",
    type: "guide",
    minutes: 6,
    updated: "2026-11-24",
    slug: {
      es: "crm-y-puntaje-de-leads",
      en: "crm-and-lead-score"
    },
    title: {
      es: "CRM y puntaje de leads",
      en: "CRM and lead score"
    },
    summary: {
      es: "Qué guarda cada contacto, cuándo y cómo la IA le pone un puntaje de 0 a 10, cómo se mueve en el embudo y qué hacer con los leads calientes.",
      en: "What each contact stores, when and how the AI gives it a score from 0 to 10, how it moves through the pipeline and what to do with hot leads."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "El CRM de GenSmart se llena solo. Cada persona que escribe a tu agente queda guardada como contacto, y la IA lee la conversación para ponerle un puntaje que te dice qué tan cerca está de comprar. Así sabes a quién escribirle primero sin leer todos los chats.",
          en: "GenSmart's CRM fills itself. Every person who writes to your agent is saved as a contact, and the AI reads the conversation to give it a score that tells you how close they are to buying. That way you know who to contact first without reading every chat."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Un agente publicado que ya esté hablando con personas (el CRM no se llena con la vista previa)",
            en: "A published agent already talking to people (the CRM does not fill from the preview)"
          },
          {
            es: "Que tu agente pida datos de contacto, como nombre, teléfono o correo. Mientras más datos capture, más útil es el contacto",
            en: "An agent that asks for contact details such as name, phone or email. The more it captures, the more useful the contact is"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué guarda cada contacto",
          en: "What each contact stores"
        },
        id: {
          es: "que-guarda-cada-contacto",
          en: "what-each-contact-stores"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Datos básicos:** nombre, teléfono, correo y el canal por el que llegó",
            en: "**Basic data:** name, phone, email and the channel they came through"
          },
          {
            es: "**Puntaje:** un número de 0 a 10 puesto por la IA",
            en: "**Score:** a number from 0 to 10 set by the AI"
          },
          {
            es: "**Servicio detectado:** el producto o servicio que la persona busca, según la conversación",
            en: "**Detected service:** the product or service the person is after, according to the conversation"
          },
          {
            es: "**Resumen de IA:** dos o tres frases con lo que pasó en la conversación y qué tan buen lead es",
            en: "**AI summary:** two or three sentences on what happened in the conversation and how good a lead it is"
          },
          {
            es: "**Variables capturadas:** los datos que el agente fue pidiendo, como ciudad, presupuesto o fecha",
            en: "**Captured variables:** the data the agent asked for along the way, such as city, budget or date"
          },
          {
            es: "**Notas:** un espacio tuyo para escribir lo que quieras recordar",
            en: "**Notes:** a space of your own to write whatever you want to remember"
          },
          {
            es: "**Conversaciones y línea de tiempo:** todo lo que ha hablado esa persona con tus agentes",
            en: "**Conversations and timeline:** everything that person has said to your agents"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cómo se calcula el puntaje",
          en: "How the score is calculated"
        },
        id: {
          es: "como-se-calcula-el-puntaje",
          en: "how-the-score-is-calculated"
        }
      },
      {
        kind: "p",
        text: {
          es: "La IA lee la conversación y decide un número de 0 a 10 según el interés que mostró la persona. Esta es la escala que usa:",
          en: "The AI reads the conversation and picks a number from 0 to 10 based on the interest the person showed. This is the scale it uses:"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**0 a 2:** spam, algo que no tiene que ver con tu negocio o alguien probando",
            en: "**0 to 2:** spam, something unrelated to your business or someone testing"
          },
          {
            es: "**3 a 4:** interés mínimo, hizo preguntas básicas",
            en: "**3 to 4:** minimal interest, asked basic questions"
          },
          {
            es: "**5 a 6:** interés real y dejó algún dato de contacto",
            en: "**5 to 6:** real interest and left some contact detail"
          },
          {
            es: "**7 a 8:** interés fuerte, preguntó precios o disponibilidad y dejó sus datos completos",
            en: "**7 to 8:** strong interest, asked about prices or availability and left full details"
          },
          {
            es: "**9 a 10:** listo para comprar o pidió una cita o el siguiente paso",
            en: "**9 to 10:** ready to buy or asked for an appointment or the next step"
          }
        ]
      },
      {
        kind: "p",
        text: {
          es: "En la lista de contactos el número se ve en rojo de 0 a 3, en amarillo de 4 a 6 y en verde de 7 a 10.",
          en: "In the contact list the number shows in red from 0 to 3, yellow from 4 to 6 and green from 7 to 10."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Cuándo se calcula",
          en: "When it is calculated"
        },
        id: {
          es: "cuando-se-calcula",
          en: "when-it-is-calculated"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Solo, a los 6 mensajes:** cuando una conversación llega a 6 mensajes y todavía no tiene puntaje, se califica automáticamente",
            en: "**On its own, at 6 messages:** when a conversation reaches 6 messages and has no score yet, it is scored automatically"
          },
          {
            es: "**Al cerrar la conversación:** si la cierras desde la bandeja, se califica de nuevo con todo lo que se habló",
            en: "**When you close the conversation:** if you close it from the inbox, it is scored again with everything that was said"
          },
          {
            es: "**Cuando tú quieras:** en la ficha del contacto, el botón **Re-analizar con IA** vuelve a calificar su conversación más reciente",
            en: "**Whenever you want:** on the contact's page, the **Re-analyze with AI** button scores their most recent conversation again"
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "El puntaje es una lectura de la IA, no una verdad. Una conversación muy corta puede quedar con un puntaje bajo aunque la persona sí quiera comprar. Si dudas de un número, abre el resumen y la conversación, y ajusta la etapa tú mismo.",
          en: "The score is an AI reading, not a fact. A very short conversation can end up with a low score even if the person does want to buy. If you doubt a number, open the summary and the conversation, and adjust the stage yourself."
        }
      },
      {
        kind: "h2",
        text: {
          es: "El embudo: tres etapas",
          en: "The pipeline: three stages"
        },
        id: {
          es: "el-embudo-tres-etapas",
          en: "the-pipeline-three-stages"
        }
      },
      {
        kind: "p",
        text: {
          es: "En **Embudo** ves a tus contactos en tres columnas: **Lead**, **Oportunidad** y **Cliente**. Todos empiezan como Lead. Puedes filtrar el tablero por agente.",
          en: "In **Pipeline** you see your contacts in three columns: **Lead**, **Opportunity** and **Customer**. Everyone starts as a Lead. You can filter the board by agent."
        }
      },
      {
        kind: "p",
        text: {
          es: "Cuando la IA califica una conversación, mueve al contacto sola con estas reglas:",
          en: "When the AI scores a conversation, it moves the contact on its own with these rules:"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "Un **Lead** con puntaje de 4 a 6 pasa a **Oportunidad**",
            en: "A **Lead** with a score of 4 to 6 moves to **Opportunity**"
          },
          {
            es: "Un **Lead u Oportunidad** con puntaje de 7 o más pasa a **Cliente**",
            en: "A **Lead or Opportunity** with a score of 7 or more moves to **Customer**"
          },
          {
            es: "Con puntaje de 0 a 3 el contacto se queda donde está",
            en: "With a score of 0 to 3 the contact stays where it is"
          },
          {
            es: "La IA nunca hace retroceder a un contacto. Si ya es Cliente, no lo baja",
            en: "The AI never moves a contact backwards. If they are already a Customer, it does not move them down"
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Ojo con esto: la plataforma pasa a **Cliente** a quien llega a 7, aunque todavía no haya pagado. Esa etapa significa \"muy interesado\", no \"compró\". Si quieres que Cliente signifique venta cerrada, mueve tú a cada persona cuando el pago esté confirmado.",
          en: "Watch out for this: the platform moves anyone who reaches 7 to **Customer**, even if they have not paid yet. That stage means \"very interested\", not \"bought\". If you want Customer to mean a closed sale, move each person yourself once payment is confirmed."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: mover un contacto a mano",
          en: "Step by step: move a contact by hand"
        },
        id: {
          es: "paso-a-paso-mover-un-contacto-a-mano",
          en: "step-by-step-move-a-contact-by-hand"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre **Embudo** en el menú de la plataforma.",
            en: "Open **Pipeline** in the platform menu."
          },
          {
            es: "Busca la tarjeta del contacto en su columna.",
            en: "Find the contact's card in its column."
          },
          {
            es: "Arrástrala a la columna donde corresponde. Aparece el aviso **Movido a** con la etapa nueva.",
            en: "Drag it to the column where it belongs. The **Moved to** notice appears with the new stage."
          },
          {
            es: "Si prefieres, abre el contacto y usa el botón **Mover a** de su ficha.",
            en: "If you prefer, open the contact and use the **Move to** button on its page."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué hacer con un lead caliente",
          en: "What to do with a hot lead"
        },
        id: {
          es: "que-hacer-con-un-lead-caliente",
          en: "what-to-do-with-a-hot-lead"
        }
      },
      {
        kind: "p",
        text: {
          es: "Cuando un contacto saca **8 o más**, la plataforma avisa a todos los miembros de tu equipo con una notificación dentro de la plataforma y un correo. El aviso trae el puntaje y el servicio que busca. Los leads de puntaje alto también aparecen en el panel principal.",
          en: "When a contact scores **8 or more**, the platform alerts every member of your team with an in-platform notification and an email. The alert includes the score and the service they want. High-score leads also show on the main dashboard."
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre el contacto y lee el **resumen de IA** para entender en qué quedó la conversación.",
            en: "Open the contact and read the **AI summary** to understand where the conversation stands."
          },
          {
            es: "Si el agente ya lo está atendiendo bien, déjalo. Si necesita una persona, toma el control desde la bandeja (mira la guía **Traspaso a una persona**).",
            en: "If the agent is already handling them well, leave it. If a person is needed, take control from the inbox (see the **Handoff to a person** guide)."
          },
          {
            es: "Escribe una nota con lo que acordaste, para que cualquiera del equipo lo vea.",
            en: "Write a note with what you agreed, so anyone on the team can see it."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Buscar, filtrar y exportar contactos",
          en: "Search, filter and export contacts"
        },
        id: {
          es: "buscar-filtrar-y-exportar-contactos",
          en: "search-filter-and-export-contacts"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Buscar** por nombre, correo o teléfono",
            en: "**Search** by name, email or phone"
          },
          {
            es: "**Filtrar** por agente, por etapa y por rango de puntaje",
            en: "**Filter** by agent, by stage and by score range"
          },
          {
            es: "**Ordenar** por fecha, nombre, puntaje, etapa o última actualización",
            en: "**Sort** by date, name, score, stage or last update"
          },
          {
            es: "**Exportar CSV** con el botón de la lista de contactos",
            en: "**Export CSV** with the button on the contact list"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cómo leer las cifras del embudo",
          en: "How to read the pipeline numbers"
        },
        id: {
          es: "como-leer-las-cifras-del-embudo",
          en: "how-to-read-the-pipeline-numbers"
        }
      },
      {
        kind: "p",
        text: {
          es: "Arriba del tablero ves el total de contactos, cuántos hay en cada etapa, el puntaje promedio, el puntaje más alto y dos tasas: de Lead a Oportunidad y de Oportunidad a Cliente. Salen de tus propios contactos, no son estimaciones. Como la etapa Cliente la mueve el puntaje, úsalas como guía del interés, no como ventas cerradas.",
          en: "Above the board you see the total contacts, how many are in each stage, the average score, the highest score and two rates: Lead to Opportunity and Opportunity to Customer. They come from your own contacts, they are not estimates. Since the Customer stage is moved by the score, use them as a guide to interest, not as closed sales."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "Un contacto no tiene puntaje: la conversación aún no llega a 6 mensajes ni se ha cerrado. Usa **Re-analizar con IA** o ciérrala desde la bandeja.",
            en: "A contact has no score: the conversation has not reached 6 messages or been closed yet. Use **Re-analyze with AI** or close it from the inbox."
          },
          {
            es: "Re-analizar dice que no hay conversación: el contacto no tiene ninguna conversación que calificar.",
            en: "Re-analyze says there is no conversation: the contact has no conversation to score."
          },
          {
            es: "El contacto no cambió de etapa: la IA solo sube de etapa y solo con puntaje de 4 o más. Muévelo a mano si lo necesitas.",
            en: "The contact did not change stage: the AI only moves contacts up, and only with a score of 4 or more. Move it by hand if you need to."
          },
          {
            es: "Los contactos de la vista previa no aparecen: la prueba no guarda contactos en tu CRM. Solo se guardan las conversaciones reales.",
            en: "Preview contacts do not appear: testing does not save contacts to your CRM. Only real conversations are saved."
          },
          {
            es: "Eliminar un contacto borra sus conversaciones y mensajes para siempre y no se puede deshacer.",
            en: "Deleting a contact permanently erases its conversations and messages and cannot be undone."
          }
        ]
      }
    ],
    next: [
      "agenda",
      "bandeja"
    ]
  },
  {
    id: "agenda",
    group: "operate",
    type: "guide",
    minutes: 6,
    updated: "2026-11-24",
    slug: {
      es: "agenda-de-citas",
      en: "appointment-booking"
    },
    title: {
      es: "Agenda de citas",
      en: "Appointment booking"
    },
    summary: {
      es: "Cómo crear tus calendarios, darle la herramienta de agendamiento a tu agente y qué pasa cuando un cliente reserva: correos, avisos y cómo ver las citas.",
      en: "How to create your calendars, give your agent the scheduling tool and what happens when a customer books: emails, alerts and how to see the appointments."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "Tu agente puede revisar tus horarios libres y reservar la cita en la misma conversación. El cliente no llena formularios ni espera a que alguien le responda. Las citas quedan en tu calendario de GenSmart, ligadas al contacto en el CRM.",
          en: "Your agent can check your free times and book the appointment in the same conversation. The customer fills in no forms and waits for nobody to answer. Appointments land in your GenSmart calendar, linked to the contact in the CRM."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Un agente creado (mira la guía **Crea tu primer agente**)",
            en: "An agent already created (see the **Create your first agent** guide)"
          },
          {
            es: "Saber tu horario real de atención: días, horas y cuánto dura cada cita",
            en: "Knowing your real service hours: days, hours and how long each appointment lasts"
          },
          {
            es: "Un correo de tu equipo para recibir el aviso de cada cita nueva",
            en: "An email from your team to receive the alert for each new appointment"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: crear un calendario",
          en: "Step by step: create a calendar"
        },
        id: {
          es: "paso-a-paso-crear-un-calendario",
          en: "step-by-step-create-a-calendar"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre **Calendario** en el menú de la plataforma y haz clic en **Crear calendario**.",
            en: "Open **Calendar** in the platform menu and click **Create calendar**."
          },
          {
            es: "Ponle un nombre que reconozcas, como \"Valoración inicial\" o \"Consulta con la doctora\".",
            en: "Give it a name you will recognize, such as \"Initial assessment\" or \"Consultation with the doctor\"."
          },
          {
            es: "Elige la **zona horaria**. Las horas que el agente ofrece salen de aquí, así que revisa que sea la de tu negocio.",
            en: "Choose the **time zone**. The times the agent offers come from here, so check it is your business's."
          },
          {
            es: "Marca los **días disponibles** y el **horario** (hora de inicio y de fin).",
            en: "Mark the **available days** and the **hours** (start and end time)."
          },
          {
            es: "Define la **duración de cada cita** y el **tiempo entre citas**, en minutos.",
            en: "Set the **length of each appointment** and the **time between appointments**, in minutes."
          },
          {
            es: "Define el **máximo de días de anticipación**: hasta cuántos días adelante se puede reservar.",
            en: "Set the **maximum days in advance**: how many days ahead a booking can be made."
          },
          {
            es: "Escribe el correo de aviso para que te llegue cada cita nueva y guarda.",
            en: "Enter the alert email so every new appointment reaches you, and save."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Crea un calendario por cada cosa distinta que agendas. Una valoración de 20 minutos y un procedimiento de 90 minutos no deberían compartir duración. Cada calendario tiene su propia configuración.",
          en: "Create one calendar for each different thing you book. A 20-minute assessment and a 90-minute procedure should not share a length. Each calendar has its own settings."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: darle la agenda a tu agente",
          en: "Step by step: give the agenda to your agent"
        },
        id: {
          es: "paso-a-paso-darle-la-agenda-a-tu-agente",
          en: "step-by-step-give-the-agenda-to-your-agent"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre tu agente y entra a la pestaña **Herramientas**.",
            en: "Open your agent and go to the **Tools** tab."
          },
          {
            es: "Agrega la herramienta **Agendamiento**.",
            en: "Add the **Scheduling** tool."
          },
          {
            es: "En **Calendarios**, elige uno o varios. Si aún no tienes, puedes crear uno desde ahí mismo.",
            en: "Under **Calendars**, pick one or several. If you do not have one yet, you can create it right there."
          },
          {
            es: "Si elegiste varios, escribe en las instrucciones del agente cuál usar en cada caso. El agente decide con esa lógica y **no le pregunta al cliente** qué calendario quiere.",
            en: "If you picked several, write in the agent's instructions which one to use in each case. The agent decides with that logic and **does not ask the customer** which calendar they want."
          },
          {
            es: "Guarda y prueba con una conversación real (la vista previa también crea citas reales, como explica la guía **Prueba tu agente antes de publicarlo**).",
            en: "Save and test with a real conversation (the preview also creates real appointments, as the **Test your agent before publishing** guide explains)."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué hace el agente cuando alguien quiere una cita",
          en: "What the agent does when someone wants an appointment"
        },
        id: {
          es: "que-hace-el-agente-cuando-alguien-quiere-una-cit",
          en: "what-the-agent-does-when-someone-wants-an-appoin"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "El cliente pregunta por una cita.",
            en: "The customer asks about an appointment."
          },
          {
            es: "El agente revisa en tu calendario la fecha que pidió y le ofrece los horarios libres.",
            en: "The agent checks your calendar for the date requested and offers the free times."
          },
          {
            es: "El cliente elige uno.",
            en: "The customer picks one."
          },
          {
            es: "El agente reserva con la fecha, la hora y el nombre. Un horario ya ocupado no se puede reservar dos veces.",
            en: "The agent books with the date, time and name. A time that is already taken cannot be booked twice."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué pasa cuando se reserva una cita",
          en: "What happens when an appointment is booked"
        },
        id: {
          es: "que-pasa-cuando-se-reserva-una-cita",
          en: "what-happens-when-an-appointment-is-booked"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Queda en tu calendario** ligada al contacto, con un resumen de la conversación como descripción",
            en: "**It lands in your calendar** linked to the contact, with a summary of the conversation as the description"
          },
          {
            es: "**Llega un correo a tu equipo** con la cita nueva, si pusiste un correo de aviso en el calendario",
            en: "**An email reaches your team** with the new appointment, if you set an alert email on the calendar"
          },
          {
            es: "**Llega un correo de confirmación al cliente**, si el agente alcanzó a capturar su correo. Trae un botón para agregar la cita a su Google Calendar",
            en: "**A confirmation email reaches the customer**, if the agent managed to capture their email. It includes a button to add the appointment to their Google Calendar"
          },
          {
            es: "**Aviso en la plataforma:** unos 30 minutos antes de la cita, tu equipo ve un recordatorio dentro de GenSmart",
            en: "**Platform alert:** about 30 minutes before the appointment, your team sees a reminder inside GenSmart"
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "El recordatorio de 30 minutos es para tu equipo, no para el cliente. Si quieres que el cliente reciba un recordatorio, pídele su correo durante la conversación para que reciba al menos la confirmación.",
          en: "The 30-minute reminder is for your team, not the customer. If you want the customer to get something in writing, ask for their email during the conversation so they at least receive the confirmation."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Ver y manejar tus citas",
          en: "See and manage your appointments"
        },
        id: {
          es: "ver-y-manejar-tus-citas",
          en: "see-and-manage-your-appointments"
        }
      },
      {
        kind: "p",
        text: {
          es: "En **Calendario** ves las citas por mes y por día. Puedes filtrar por calendario o por estado (Programada, Completada o Cancelada), crear una cita a mano con **Nueva cita**, editarla para cambiar la hora o los detalles, y cancelarla. Cancelar te pide confirmar y no se puede deshacer.",
          en: "In **Calendar** you see appointments by month and by day. You can filter by calendar or by status (Scheduled, Completed or Cancelled), create an appointment by hand with **New appointment**, edit it to change the time or details, and cancel it. Cancelling asks you to confirm and cannot be undone."
        }
      },
      {
        kind: "note",
        text: {
          es: "El agente reserva, pero no cancela ni cambia citas. Si un cliente quiere cambiar la hora, lo resuelve tu equipo desde **Calendario**. El correo de confirmación le indica que se comunique con el negocio.",
          en: "The agent books, but it does not cancel or change appointments. If a customer wants to change the time, your team handles it from **Calendar**. The confirmation email tells them to contact the business."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Límites que protegen tu agenda",
          en: "Limits that protect your calendar"
        },
        id: {
          es: "limites-que-protegen-tu-agenda",
          en: "limits-that-protect-your-calendar"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "Un agente hace como máximo **3 reservas por conversación cada hora**",
            en: "An agent makes at most **3 bookings per conversation per hour**"
          },
          {
            es: "Un calendario recibe como máximo **30 reservas por hora**",
            en: "A calendar receives at most **30 bookings per hour**"
          },
          {
            es: "A una misma dirección de correo se le envían como máximo **3 confirmaciones cada 24 horas**. La cita se reserva igual, solo que no se envía el correo extra",
            en: "A single email address gets at most **3 confirmations every 24 hours**. The appointment is still booked, only the extra email is not sent"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "El agente dice que no tiene horarios: revisa que el calendario esté asignado en la herramienta **Agendamiento**, que el día pedido esté entre los días disponibles y que no pase del máximo de días de anticipación.",
            en: "The agent says it has no times: check that the calendar is assigned in the **Scheduling** tool, that the requested day is among the available days and that it does not exceed the maximum days in advance."
          },
          {
            es: "Las horas salen corridas: la zona horaria del calendario no es la de tu negocio. Corrígela en la configuración del calendario.",
            en: "Times come out shifted: the calendar's time zone is not your business's. Fix it in the calendar settings."
          },
          {
            es: "No te llegó el correo de aviso: el calendario no tiene correo de aviso guardado, o el mensaje cayó en spam.",
            en: "You did not get the alert email: the calendar has no alert email saved, or the message landed in spam."
          },
          {
            es: "El cliente no recibió confirmación: el agente no capturó su correo en la conversación, o ya recibió 3 confirmaciones en el día.",
            en: "The customer did not get a confirmation: the agent did not capture their email in the conversation, or they already received 3 confirmations that day."
          },
          {
            es: "El agente usa el calendario equivocado: con varios calendarios, escribe en las instrucciones una regla clara para cada caso.",
            en: "The agent uses the wrong calendar: with several calendars, write a clear rule for each case in the instructions."
          }
        ]
      }
    ],
    next: [
      "ventana-24-horas",
      "integraciones"
    ]
  },
  {
    id: "ventana-24-horas",
    group: "extend",
    type: "guide",
    minutes: 4,
    updated: "2026-11-24",
    slug: {
      es: "ventana-de-24-horas",
      en: "24-hour-window"
    },
    title: {
      es: "La ventana de 24 horas de WhatsApp",
      en: "The WhatsApp 24-hour window"
    },
    summary: {
      es: "Qué es la regla de las 24 horas, cómo afecta a tu agente y a tu equipo, y qué hacer cuando un cliente tarda en responder.",
      en: "What the 24-hour rule is, how it affects your agent and your team, and what to do when a customer takes long to reply."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "Es una regla de WhatsApp, no de GenSmart. Cada vez que un cliente te escribe, se abre una ventana de 24 horas en la que puedes responderle con mensajes normales. Pasadas esas 24 horas sin que el cliente escriba, WhatsApp ya no deja entregar mensajes libres a esa persona.",
          en: "It is a WhatsApp rule, not a GenSmart one. Every time a customer writes to you, a 24-hour window opens in which you can reply with normal messages. After 24 hours without the customer writing, WhatsApp no longer lets free-form messages be delivered to that person."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Cómo funciona",
          en: "How it works"
        },
        id: {
          es: "como-funciona",
          en: "how-it-works"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**El cliente escribe:** la ventana se abre y empiezan a contar 24 horas",
            en: "**The customer writes:** the window opens and 24 hours start counting"
          },
          {
            es: "**Dentro de la ventana:** tu agente, o una persona de tu equipo, puede responder con libertad",
            en: "**Inside the window:** your agent, or someone on your team, can reply freely"
          },
          {
            es: "**El cliente vuelve a escribir:** la ventana se reinicia y vuelven a contar 24 horas desde ese último mensaje",
            en: "**The customer writes again:** the window resets and 24 hours count again from that last message"
          },
          {
            es: "**Fuera de la ventana:** WhatsApp solo permite iniciar la conversación con una plantilla de mensaje aprobada por Meta",
            en: "**Outside the window:** WhatsApp only allows starting the conversation with a message template approved by Meta"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué significa para tu agente",
          en: "What it means for your agent"
        },
        id: {
          es: "que-significa-para-tu-agente",
          en: "what-it-means-for-your-agent"
        }
      },
      {
        kind: "p",
        text: {
          es: "Tu agente responde cuando el cliente escribe, así que siempre trabaja dentro de la ventana. Por eso conversa sin problema, incluso a las 3 de la mañana.",
          en: "Your agent replies when the customer writes, so it always works inside the window. That is why it chats without trouble, even at 3 in the morning."
        }
      },
      {
        kind: "note",
        text: {
          es: "GenSmart hoy no envía plantillas de WhatsApp ni mensajes masivos. El agente solo contesta a quien escribió primero. Si necesitas escribirle a un cliente que lleva más de 24 horas callado, tendrás que hacerlo por fuera de la plataforma, con una plantilla aprobada en tu cuenta de Meta.",
          en: "GenSmart does not send WhatsApp templates or bulk messages today. The agent only answers whoever wrote first. If you need to write to a customer who has been silent for more than 24 hours, you will have to do it outside the platform, with a template approved in your Meta account."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Qué significa para tu equipo",
          en: "What it means for your team"
        },
        id: {
          es: "que-significa-para-tu-equipo",
          en: "what-it-means-for-your-team"
        }
      },
      {
        kind: "p",
        text: {
          es: "Si una persona toma el control de una conversación (mira la guía **Traspaso a una persona**) y escribe cuando ya pasaron más de 24 horas desde el último mensaje del cliente, WhatsApp no entrega ese mensaje. En GenSmart el mensaje queda guardado en el hilo, pero el cliente no lo recibe, y la plataforma no te muestra un error.",
          en: "If a person takes control of a conversation (see the **Handoff to a person** guide) and writes when more than 24 hours have passed since the customer's last message, WhatsApp does not deliver that message. In GenSmart the message is saved in the thread, but the customer does not receive it, and the platform shows you no error."
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "Antes de escribir, mira la hora del último mensaje del cliente en la conversación",
            en: "Before writing, check the time of the customer's last message in the conversation"
          },
          {
            es: "Si pasaron más de 24 horas, contacta al cliente por otro medio, como una llamada, o con una plantilla desde tu cuenta de Meta",
            en: "If more than 24 hours have passed, contact the customer another way, such as a call, or with a template from your Meta account"
          },
          {
            es: "Cuando el cliente responda, la ventana se reabre y ya puedes seguir desde GenSmart",
            en: "When the customer replies, the window reopens and you can carry on from GenSmart"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cómo evitar perder clientes por la ventana",
          en: "How to avoid losing customers to the window"
        },
        id: {
          es: "como-evitar-perder-clientes-por-la-ventana",
          en: "how-to-avoid-losing-customers-to-the-window"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Haz que tu agente cierre cada respuesta con una pregunta o un siguiente paso claro, para que el cliente tenga motivo de contestar.",
            en: "Have your agent end every reply with a question or a clear next step, so the customer has a reason to answer."
          },
          {
            es: "Pide el correo durante la conversación. Así tienes otra vía si el cliente deja de contestar por WhatsApp.",
            en: "Ask for the email during the conversation. That gives you another route if the customer stops answering on WhatsApp."
          },
          {
            es: "Responde los casos que pidieron ayuda humana dentro del mismo día. Revisa la bandeja: las que piden ayuda aparecen primero con la marca **Necesita ayuda**.",
            en: "Answer the cases that asked for human help within the same day. Check the inbox: the ones asking for help appear first with the **Needs help** mark."
          },
          {
            es: "Si ofreces citas, confirma por correo. El agente envía la confirmación al correo que capturó (mira la guía **Agenda de citas**).",
            en: "If you offer appointments, confirm by email. The agent sends the confirmation to the email it captured (see the **Appointment booking** guide)."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Las plantillas, sus categorías y lo que cuesta cada conversación los define Meta y cambian con el tiempo. Revisa la documentación vigente de Meta antes de decidir.",
          en: "Templates, their categories and what each conversation costs are set by Meta and change over time. Check Meta's current documentation before deciding."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "Un mensaje de tu equipo aparece en GenSmart pero el cliente dice que no llegó: probablemente pasaron más de 24 horas desde su último mensaje. Contáctalo por otro medio.",
            en: "A message from your team shows in GenSmart but the customer says it did not arrive: more than 24 hours have probably passed since their last message. Contact them another way."
          },
          {
            es: "El agente no responde a un cliente: la ventana no es la causa, porque el agente solo contesta cuando el cliente escribe. Revisa que el agente esté publicado y el canal conectado (mira la guía **Conecta tu número de WhatsApp Business**).",
            en: "The agent does not answer a customer: the window is not the cause, because the agent only answers when the customer writes. Check that the agent is published and the channel connected (see the **Connect your WhatsApp Business number** guide)."
          }
        ]
      }
    ],
    next: [
      "conectar-whatsapp",
      "traspaso"
    ]
  },
  {
    id: "conectar-tienda",
    group: "extend",
    type: "guide",
    minutes: 6,
    updated: "2026-11-24",
    slug: {
      es: "conectar-tu-tienda",
      en: "connect-your-store"
    },
    title: {
      es: "Conecta tu tienda con tu agente",
      en: "Connect your store to your agent"
    },
    summary: {
      es: "Cómo conectar Tiendanube o WooCommerce para que tu agente busque productos, calcule envíos y cree pedidos con link de pago.",
      en: "How to connect Tiendanube or WooCommerce so your agent searches products, checks shipping and creates orders with a payment link."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "Un agente que conoce tu catálogo no inventa precios ni promete lo que no tienes. Consulta la tienda en el momento y responde con lo que hay. Esta guía te lleva por las dos tiendas que vienen listas en GenSmart: Tiendanube y WooCommerce.",
          en: "An agent that knows your catalog does not make up prices or promise what you do not have. It checks the store at that moment and answers with what is there. This guide walks you through the two stores that come ready in GenSmart: Tiendanube and WooCommerce."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Qué puede hacer tu agente con la tienda conectada",
          en: "What your agent can do with the store connected"
        },
        id: {
          es: "que-puede-hacer-tu-agente-con-la-tienda-conectad",
          en: "what-your-agent-can-do-with-the-store-connected"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Buscar productos** y ver el detalle de cada uno",
            en: "**Search products** and see the detail of each one"
          },
          {
            es: "**Consultar los envíos** de tu tienda (en WooCommerce, por zona de envío)",
            en: "**Check shipping** for your store (in WooCommerce, by shipping zone)"
          },
          {
            es: "**Crear el pedido** y entregar el link de pago de tu tienda. El cobro lo hace tu tienda, no GenSmart",
            en: "**Create the order** and hand over your store's payment link. Your store takes the payment, not GenSmart"
          },
          {
            es: "**Consultar el estado** de un pedido (en WooCommerce)",
            en: "**Check the status** of an order (in WooCommerce)"
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "La tienda sigue siendo el sistema donde vive la venta. GenSmart no guarda tus pedidos: los consulta y los crea en tu tienda.",
          en: "Your store stays the system where the sale lives. GenSmart does not keep your orders: it reads them and creates them in your store."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Un agente de ventas creado (mira la guía **Crea tu primer agente**), o la plantilla de tienda",
            en: "A sales agent created (see the **Create your first agent** guide), or the store template"
          },
          {
            es: "Tu catálogo con nombres, precios y fotos al día en la tienda",
            en: "Your catalog with names, prices and photos up to date in the store"
          },
          {
            es: "Para WooCommerce: acceso de administrador a tu tienda y un plan Pro o superior, porque el servidor MCP empieza ahí",
            en: "For WooCommerce: administrator access to your store and a Pro plan or above, because the MCP server starts there"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: Tiendanube",
          en: "Step by step: Tiendanube"
        },
        id: {
          es: "paso-a-paso-tiendanube",
          en: "step-by-step-tiendanube"
        }
      },
      {
        kind: "p",
        text: {
          es: "Con Tiendanube no pegas claves. La conexión se hace instalando la app, y GenSmart prepara el resto.",
          en: "With Tiendanube you paste no keys. The connection is made by installing the app, and GenSmart sets up the rest."
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Instala la app de GenSmart en tu tienda Tiendanube y autoriza el acceso.",
            en: "Install the GenSmart app on your Tiendanube store and authorize access."
          },
          {
            es: "GenSmart crea tu cuenta con el correo de la tienda, o la vincula si ya tenías una, y te envía un enlace de acceso. No hay contraseña que inventar.",
            en: "GenSmart creates your account with the store's email, or links it if you already had one, and sends you an access link. There is no password to invent."
          },
          {
            es: "Entra con ese enlace. Encuentras un agente de ventas con el nombre de tu tienda, ya conectado a ella y publicado, con el chat web activo.",
            en: "Sign in with that link. You will find a sales agent named after your store, already connected to it and published, with web chat on."
          },
          {
            es: "Abre el agente y, en la pestaña de configuración, ajusta el **tipo de negocio**. Viene como \"tienda online\" y conviene que diga qué vendes, por ejemplo \"ropa deportiva\".",
            en: "Open the agent and, in the configuration tab, adjust the **business type**. It comes as \"online store\" and should say what you sell, for example \"sportswear\"."
          },
          {
            es: "Pruébalo antes de dar la URL a nadie (mira el final de esta guía).",
            en: "Test it before giving the URL to anyone (see the end of this guide)."
          }
        ]
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "Tu cuenta usa el plan Pro mientras la app esté instalada. Si la suspendes o la desinstalas, la conexión con la tienda se desactiva y la cuenta pasa al plan Solo. Tus conversaciones y contactos se conservan.",
            en: "Your account uses the Pro plan while the app is installed. If you suspend or uninstall it, the store connection is switched off and the account moves to the Solo plan. Your conversations and contacts are kept."
          },
          {
            es: "Cuando una compra se paga en tu tienda, el contacto que coincida por correo o teléfono pasa a **Cliente** en el embudo. Si no hay coincidencia, no se crea ningún contacto.",
            en: "When a purchase is paid in your store, the contact that matches by email or phone moves to **Customer** in the pipeline. If there is no match, no contact is created."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: WooCommerce",
          en: "Step by step: WooCommerce"
        },
        id: {
          es: "paso-a-paso-woocommerce",
          en: "step-by-step-woocommerce"
        }
      },
      {
        kind: "p",
        text: {
          es: "Con WooCommerce conectas tu tienda con una dirección y un par de claves que tú generas. Las claves las ve GenSmart solo para hablar con tu tienda.",
          en: "With WooCommerce you connect your store with an address and a pair of keys that you generate. GenSmart uses the keys only to talk to your store."
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "En tu WordPress entra a **WooCommerce, Ajustes, Avanzado, API REST** y crea una clave nueva.",
            en: "In your WordPress go to **WooCommerce, Settings, Advanced, REST API** and create a new key."
          },
          {
            es: "Dale permisos de **Lectura/Escritura**: sin escritura el agente no podrá crear pedidos.",
            en: "Give it **Read/Write** permissions: without write access the agent cannot create orders."
          },
          {
            es: "Copia el **Consumer Key** y el **Consumer Secret**. Se muestran una sola vez, así que guárdalos antes de cerrar la pantalla.",
            en: "Copy the **Consumer Key** and the **Consumer Secret**. They are shown only once, so save them before closing the screen."
          },
          {
            es: "En GenSmart abre tu agente, entra a **Herramientas** y agrega **Servidor MCP**. Elige la opción **WooCommerce Store**.",
            en: "In GenSmart open your agent, go to **Tools** and add **MCP Server**. Choose the **WooCommerce Store** option."
          },
          {
            es: "Completa los tres datos: la **URL de la tienda** completa con https://, el Consumer Key y el Consumer Secret.",
            en: "Fill in the three fields: the full **store URL** with https://, the Consumer Key and the Consumer Secret."
          },
          {
            es: "Usa **Probar conexión** y guarda solo cuando salga bien. Si falla, revisa que la URL sea exacta y que la clave tenga permisos de lectura y escritura.",
            en: "Use **Test connection** and save only when it passes. If it fails, check that the URL is exact and that the key has read and write permissions."
          },
          {
            es: "En las instrucciones del agente escribe cuándo usar la tienda, por ejemplo: \"si el cliente pregunta por un producto, búscalo en la tienda antes de responder\".",
            en: "In the agent's instructions write when to use the store, for example: \"if the customer asks about a product, look it up in the store before answering\"."
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Tus claves de WooCommerce dan acceso a tu tienda. No las pegues en una conversación, en un correo ni en las instrucciones del agente. Solo van en el formulario de la herramienta.",
          en: "Your WooCommerce keys give access to your store. Do not paste them into a conversation, an email or the agent's instructions. They go only in the tool form."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Prueba antes de abrirlo al público",
          en: "Test before opening it to the public"
        },
        id: {
          es: "prueba-antes-de-abrirlo-al-publico",
          en: "test-before-opening-it-to-the-public"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Pregunta por un producto real: nombre, precio y si hay disponible.",
            en: "Ask about a real product: name, price and whether it is available."
          },
          {
            es: "Pide un producto que no vendes. El agente debe decir que no lo tiene, no inventarlo.",
            en: "Ask for a product you do not sell. The agent should say it does not have it, not invent it."
          },
          {
            es: "Pregunta por el envío a tu ciudad y a una ciudad lejana.",
            en: "Ask about shipping to your city and to a faraway one."
          },
          {
            es: "Haz un pedido de prueba completo y abre el link de pago. Compruébalo en el panel de tu tienda.",
            en: "Place a full test order and open the payment link. Check it in your store's dashboard."
          },
          {
            es: "Anula o elimina el pedido de prueba en tu tienda para que no cuente en tus ventas.",
            en: "Cancel or delete the test order in your store so it does not count in your sales."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "El agente dice que no encuentra productos que sí tienes: revisa que estén publicados y con nombre claro en la tienda, y que la conexión esté activa en la pestaña Herramientas.",
            en: "The agent says it cannot find products you do have: check that they are published and clearly named in the store, and that the connection is active in the Tools tab."
          },
          {
            es: "La prueba de conexión de WooCommerce falla: confirma la URL con https://, que la clave sea de lectura y escritura y que tu sitio no bloquee la API REST con un plugin de seguridad.",
            en: "The WooCommerce connection test fails: confirm the URL with https://, that the key has read and write access and that your site does not block the REST API with a security plugin."
          },
          {
            es: "El agente inventa un precio: refuerza la instrucción \"antes de dar un precio, búscalo en la tienda\" y vuelve a probar.",
            en: "The agent makes up a price: strengthen the instruction \"before giving a price, look it up in the store\" and test again."
          }
        ]
      }
    ],
    next: [
      "integraciones",
      "probar-antes"
    ]
  },
  {
    id: "integraciones",
    group: "extend",
    type: "guide",
    minutes: 7,
    updated: "2026-11-24",
    slug: {
      es: "integraciones",
      en: "integrations"
    },
    title: {
      es: "Integraciones y herramientas externas",
      en: "Integrations and external tools"
    },
    summary: {
      es: "Qué integraciones ya vienen listas, cómo conectar tu tienda o tu sistema, y cuándo usar una función personalizada, un servidor MCP o un aviso por correo.",
      en: "Which integrations come ready, how to connect your store or system, and when to use a custom function, an MCP server or an email alert."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "Un agente que solo conversa responde preguntas. Un agente conectado a tus sistemas consulta tu inventario, crea pedidos y avisa a tu equipo. Esta guía te dice qué puedes conectar hoy, con qué herramienta y en qué plan.",
          en: "An agent that only chats answers questions. An agent connected to your systems checks your inventory, creates orders and alerts your team. This guide tells you what you can connect today, with which tool and on which plan."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Un agente creado (mira la guía **Crea tu primer agente**)",
            en: "An agent already created (see the **Create your first agent** guide)"
          },
          {
            es: "Saber qué quieres que haga el agente en tu sistema: consultar, crear algo o avisar",
            en: "Knowing what you want the agent to do in your system: check, create something or alert"
          },
          {
            es: "Si vas a conectar una tienda o un sistema, tener a mano sus claves de acceso",
            en: "If you are going to connect a store or system, having its access keys at hand"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Integraciones que ya vienen listas",
          en: "Integrations that come ready"
        },
        id: {
          es: "integraciones-que-ya-vienen-listas",
          en: "integrations-that-come-ready"
        }
      },
      {
        kind: "p",
        text: {
          es: "Estas cuatro tienen un perfil preparado en GenSmart, así que casi no hay que configurar nada técnico:",
          en: "These four have a ready profile in GenSmart, so there is almost nothing technical to set up:"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Tiendanube:** busca productos y categorías y crea pedidos con link de pago. Se conecta instalando la app de Tiendanube, sin pegar claves",
            en: "**Tiendanube:** searches products and categories and creates orders with a payment link. It connects by installing the Tiendanube app, with no keys to paste"
          },
          {
            es: "**WooCommerce:** busca productos, consulta zonas de envío y crea pedidos con link de pago. Necesitas la dirección de tu tienda y tus claves de API de WooCommerce",
            en: "**WooCommerce:** searches products, checks shipping zones and creates orders with a payment link. You need your store address and your WooCommerce API keys"
          },
          {
            es: "**Mastershop:** para dropshipping. Necesitas tu propia clave de Mastershop. Cuando cambia el estado de un pedido, el cliente recibe el aviso en la conversación",
            en: "**Mastershop:** for dropshipping. You need your own Mastershop key. When an order's status changes, the customer gets the alert in the conversation"
          },
          {
            es: "**Synchroteam:** para servicios en campo, como aire acondicionado, plomería o electricidad: trabajos, técnicos, clientes y disponibilidad",
            en: "**Synchroteam:** for field services such as air conditioning, plumbing or electrical: jobs, technicians, customers and availability"
          }
        ]
      },
      {
        kind: "note",
        text: {
          es: "Si tu herramienta no está en esa lista, no significa que no se pueda conectar. Si tiene API pública, puedes usar una función personalizada o un servidor MCP, como explica más abajo. Eso sí requiere un poco de trabajo técnico de tu lado o de tu desarrollador.",
          en: "If your tool is not on that list, it does not mean it cannot be connected. If it has a public API, you can use a custom function or an MCP server, as explained below. That does take some technical work on your side or your developer's."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Qué herramienta usar y cuándo",
          en: "Which tool to use and when"
        },
        id: {
          es: "que-herramienta-usar-y-cuando",
          en: "which-tool-to-use-and-when"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Servidor MCP:** para conectar tu tienda o un sistema completo (productos, pedidos, agenda). Vienen listos los de arriba. Disponible desde el plan Pro, hasta 3 servidores. En Enterprise, sin límite",
            en: "**MCP server:** to connect your store or a whole system (products, orders, calendar). The ones above come ready. Available from the Pro plan, up to 3 servers. On Enterprise, no limit"
          },
          {
            es: "**Función personalizada:** para una acción concreta en un sistema que tiene API, como consultar el estado de un pedido o crear un registro. Starter incluye 2, Pro incluye 10, Enterprise sin límite",
            en: "**Custom function:** for one specific action in a system with an API, such as checking an order's status or creating a record. Starter includes 2, Pro includes 10, Enterprise no limit"
          },
          {
            es: "**Notificación por correo:** para que el agente avise a tu equipo cuando pasa algo, como un cliente que pide cotización. Starter incluye 2, Pro incluye 10, Enterprise sin límite",
            en: "**Email notification:** so the agent alerts your team when something happens, such as a customer asking for a quote. Starter includes 2, Pro includes 10, Enterprise no limit"
          },
          {
            es: "**Agendamiento:** para reservar citas en los calendarios de GenSmart (mira la guía **Agenda de citas**)",
            en: "**Scheduling:** to book appointments in GenSmart calendars (see the **Appointment booking** guide)"
          },
          {
            es: "**Base de conocimiento:** para que el agente responda con tu información (mira la guía **Base de conocimiento**)",
            en: "**Knowledge base:** so the agent answers with your information (see the **Knowledge base** guide)"
          }
        ]
      },
      {
        kind: "p",
        text: {
          es: "El plan Solo no incluye funciones personalizadas, servidores MCP ni notificaciones por correo.",
          en: "The Solo plan does not include custom functions, MCP servers or email notifications."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: conectar tu tienda o sistema con un servidor MCP",
          en: "Step by step: connect your store or system with an MCP server"
        },
        id: {
          es: "paso-a-paso-conectar-tu-tienda-o-sistema-con-un-",
          en: "step-by-step-connect-your-store-or-system-with-a"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Abre tu agente y entra a la pestaña **Herramientas**.",
            en: "Open your agent and go to the **Tools** tab."
          },
          {
            es: "Agrega la herramienta **Servidor MCP**.",
            en: "Add the **MCP Server** tool."
          },
          {
            es: "Si tu plataforma es una de las que vienen listas, elígela. GenSmart reconoce la dirección y te pide solo lo que necesita de ti, como tu clave.",
            en: "If your platform is one of those that come ready, pick it. GenSmart recognizes the address and asks you only for what it needs from you, such as your key."
          },
          {
            es: "Completa los datos y usa **Probar conexión** antes de guardar. Si algo no coincide, aquí aparece el error.",
            en: "Fill in the details and use **Test connection** before saving. If something does not match, the error shows here."
          },
          {
            es: "Guarda y prueba con una conversación real, como pedir un producto de tu catálogo.",
            en: "Save and test with a real conversation, such as asking for a product from your catalog."
          },
          {
            es: "En las instrucciones del agente escribe cuándo usar la herramienta: por ejemplo, \"si el cliente pregunta por un producto, búscalo en la tienda antes de responder\".",
            en: "In the agent's instructions write when to use the tool: for example, \"if the customer asks about a product, look it up in the store before answering\"."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: crear una función personalizada",
          en: "Step by step: create a custom function"
        },
        id: {
          es: "paso-a-paso-crear-una-funcion-personalizada",
          en: "step-by-step-create-a-custom-function"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "En la pestaña **Herramientas**, agrega **Función personalizada**.",
            en: "In the **Tools** tab, add **Custom function**."
          },
          {
            es: "Ponle un nombre y una descripción clara de cuándo debe usarla el agente. El agente decide con esa descripción.",
            en: "Give it a name and a clear description of when the agent should use it. The agent decides with that description."
          },
          {
            es: "Escribe la dirección (URL) de la API y el método, por ejemplo GET para consultar o POST para crear. La dirección debe ser pública.",
            en: "Enter the API address (URL) and the method, for example GET to check or POST to create. The address must be public."
          },
          {
            es: "Si la API pide autenticación, elige el tipo (token, o clave en el encabezado o en la dirección) y pega tu clave.",
            en: "If the API asks for authentication, choose the type (token, or key in the header or in the address) and paste your key."
          },
          {
            es: "Define qué datos le manda el agente, y qué parte de la respuesta debe leer.",
            en: "Define what data the agent sends, and which part of the response it should read."
          },
          {
            es: "Usa el botón de prueba para verificar que responde bien, y guarda.",
            en: "Use the test button to check it responds well, and save."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Paso a paso: avisar a tu equipo por correo",
          en: "Step by step: alert your team by email"
        },
        id: {
          es: "paso-a-paso-avisar-a-tu-equipo-por-correo",
          en: "step-by-step-alert-your-team-by-email"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "En **Herramientas**, agrega **Notificación por email**.",
            en: "In **Tools**, add **Email notification**."
          },
          {
            es: "Escribe el correo de quien recibe el aviso, y opcionalmente copias.",
            en: "Enter the email of whoever receives the alert, and optionally copies."
          },
          {
            es: "Redacta el asunto y el cuerpo. Puedes insertar datos de la conversación, como el nombre del contacto o el enlace a la conversación.",
            en: "Write the subject and body. You can insert conversation data, such as the contact's name or the link to the conversation."
          },
          {
            es: "Define los datos que el agente debe recoger para el aviso, como el producto o la ciudad.",
            en: "Define the data the agent must collect for the alert, such as the product or the city."
          },
          {
            es: "Usa **Enviar email de prueba** y guarda.",
            en: "Use **Send test email** and save."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Tu propia llave de OpenAI o Anthropic",
          en: "Your own OpenAI or Anthropic key"
        },
        id: {
          es: "tu-propia-llave-de-openai-o-anthropic",
          en: "your-own-openai-or-anthropic-key"
        }
      },
      {
        kind: "p",
        text: {
          es: "En el plan Enterprise puedes usar tu propia llave de OpenAI o de Anthropic. Se configura en los ajustes de tu organización, y solo la ven los roles de propietario y administrador.",
          en: "On the Enterprise plan you can use your own OpenAI or Anthropic key. It is set in your organization settings, and only the owner and admin roles can see it."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "No ves la herramienta o no te deja agregarla: tu plan puede no incluirla o ya llegaste al límite. Mejora el plan o elimina una que no uses.",
            en: "You do not see the tool or it will not let you add it: your plan may not include it, or you reached the limit. Upgrade the plan or remove one you do not use."
          },
          {
            es: "La conexión falla al probar: revisa que la clave esté bien copiada, sin espacios, y que tenga los permisos que pide la plataforma.",
            en: "The connection fails when testing: check that the key is copied correctly, with no spaces, and has the permissions the platform asks for."
          },
          {
            es: "El agente no usa la herramienta: en las instrucciones, dile cuándo debe usarla. Sin esa regla puede responder sin consultarla.",
            en: "The agent does not use the tool: in the instructions, tell it when to use it. Without that rule it may answer without checking."
          },
          {
            es: "Una herramienta dejó de funcionar tras cambiar de plan: la bandeja muestra el aviso **Herramienta no disponible**. Vuelve al plan que la incluye para reactivarla.",
            en: "A tool stopped working after a plan change: the inbox shows the **Tool not available** alert. Return to the plan that includes it to reactivate it."
          }
        ]
      }
    ],
    next: [
      "agenda",
      "base-de-conocimiento"
    ]
  },
  {
    id: "probar-antes",
    group: "start",
    type: "guide",
    minutes: 5,
    updated: "2026-11-24",
    slug: {
      es: "prueba-tu-agente-antes-de-publicarlo",
      en: "test-your-agent-before-publishing"
    },
    title: {
      es: "Prueba tu agente antes de publicarlo",
      en: "Test your agent before publishing"
    },
    summary: {
      es: "Cómo usar la Vista previa, qué probar, qué sí ocurre de verdad durante la prueba y cómo volver atrás si algo sale mal.",
      en: "How to use Preview, what to test, what really happens during a test and how to roll back if something goes wrong."
    },
    body: [
      {
        kind: "p",
        text: {
          es: "Quince minutos de pruebas antes de activar el agente evitan la semana más incómoda del proyecto. La **Vista previa** te deja chatear con tu agente como si fueras un cliente, sin gastar mensajes de tu plan y sin que nadie real reciba nada.",
          en: "Fifteen minutes of testing before turning the agent on avoids the most uncomfortable week of the project. **Preview** lets you chat with your agent as if you were a customer, without spending your plan messages and without any real person receiving anything."
        }
      },
      {
        kind: "h2",
        text: {
          es: "Antes de empezar",
          en: "Before you start"
        },
        id: {
          es: "antes-de-empezar",
          en: "before-you-start"
        }
      },
      {
        kind: "list",
        variant: "check",
        items: [
          {
            es: "Un agente con prompt y base de conocimiento cargada",
            en: "An agent with a prompt and a loaded knowledge base"
          },
          {
            es: "Una lista de las veinte preguntas que más te hacen tus clientes",
            en: "A list of the twenty questions your customers ask most"
          },
          {
            es: "Los campos obligatorios de **Configuración** completos: si faltan, GenSmart no te deja publicar y te lo indica",
            en: "The required fields in **Settings** filled in: if any is missing, GenSmart will not let you publish and tells you which"
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cómo abrir la Vista previa",
          en: "How to open Preview"
        },
        id: {
          es: "como-abrir-la-vista-previa",
          en: "how-to-open-preview"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Entra al agente y haz clic en **Vista previa**, arriba en el editor.",
            en: "Open the agent and click **Preview**, at the top of the editor."
          },
          {
            es: "Verás el aviso **Modo vista previa**: los mensajes no cuentan para el uso de tu plan.",
            en: "You will see the **Preview mode** banner: messages do not count toward your plan usage."
          },
          {
            es: "Escribe un mensaje y envíalo. El agente responde con el prompt, la base de conocimiento y las herramientas que tiene hoy.",
            en: "Type a message and send it. The agent answers with the prompt, knowledge base and tools it has today."
          },
          {
            es: "Si el agente captura datos (nombre, correo, interés), aparecen debajo como **Variables capturadas**.",
            en: "If the agent captures data (name, email, interest), it appears below as **Captured variables**."
          },
          {
            es: "Usa **Reiniciar** para empezar una conversación nueva desde cero.",
            en: "Use **Reset** to start a new conversation from scratch."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Las siete pruebas",
          en: "The seven tests"
        },
        id: {
          es: "las-siete-pruebas",
          en: "the-seven-tests"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "**Saludo:** dice quién es el agente y qué puede hacer.",
            en: "**Greeting:** it says who the agent is and what it can do."
          },
          {
            es: "**Conocimiento:** las veinte preguntas frecuentes tienen respuesta correcta y una pregunta fuera de la base se reconoce como tal.",
            en: "**Knowledge:** the twenty frequent questions get a correct answer and a question outside the base is recognized as such."
          },
          {
            es: "**Datos:** el agente pide lo que necesitas (nombre, teléfono, interés) y lo ves en las variables capturadas.",
            en: "**Data:** the agent asks for what you need (name, phone, interest) and you see it in the captured variables."
          },
          {
            es: "**Traspaso:** pide hablar con una persona y comprueba que el agente lo reconoce y se despide bien.",
            en: "**Handoff:** ask to speak with a person and check that the agent recognizes it and says goodbye properly."
          },
          {
            es: "**Agenda:** si tiene calendario, pide una cita y revisa que ofrezca horarios reales.",
            en: "**Scheduling:** if it has a calendar, ask for an appointment and check that it offers real time slots."
          },
          {
            es: "**Casos difíciles:** un cliente enojado, un mensaje confuso, una pregunta fuera de tema.",
            en: "**Hard cases:** an angry customer, a confusing message, an off-topic question."
          },
          {
            es: "**Personas ajenas:** pide a dos o tres personas que no son tú que le escriban. Escriben de formas que no imaginas.",
            en: "**Outside testers:** ask two or three people who are not you to write to it. They write in ways you do not imagine."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Qué ocurre de verdad durante la prueba",
          en: "What really happens during a test"
        },
        id: {
          es: "que-ocurre-de-verdad-durante-la-prueba",
          en: "what-really-happens-during-a-test"
        }
      },
      {
        kind: "p",
        text: {
          es: "La Vista previa es un ensayo, pero no todo es simulado. Tenlo claro antes de probar:",
          en: "Preview is a rehearsal, but not everything is simulated. Be clear on this before testing:"
        }
      },
      {
        kind: "list",
        variant: "plain",
        items: [
          {
            es: "**Es simulado:** el traspaso a una persona (no se envía ningún aviso) y la captura de datos (no se guarda ningún contacto).",
            en: "**Simulated:** the handoff to a person (no notice is sent) and data capture (no contact is saved)."
          },
          {
            es: "**Es real:** si el agente reserva una cita, la cita queda creada en el calendario. Bórrala después de probar.",
            en: "**Real:** if the agent books an appointment, it is created in the calendar. Delete it after testing."
          },
          {
            es: "**Es real:** las funciones personalizadas y los servidores MCP conectados se ejecutan contra tu sistema. Si crean pedidos o registros, prueba con datos de ejemplo.",
            en: "**Real:** connected custom functions and MCP servers run against your system. If they create orders or records, test with sample data."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Cuando todo está bien: publicar",
          en: "When everything is fine: publish"
        },
        id: {
          es: "cuando-todo-esta-bien-publicar",
          en: "when-everything-is-fine-publish"
        }
      },
      {
        kind: "steps",
        items: [
          {
            es: "Haz clic en **Publicar** y confirma. Se guardan los cambios y esa versión queda activa.",
            en: "Click **Publish** and confirm. Your changes are saved and that version goes live."
          },
          {
            es: "Abre la pestaña **Versiones**: ahí queda el historial, con la fecha y quién publicó cada una.",
            en: "Open the **Versions** tab: the history is there, with the date and who published each one."
          },
          {
            es: "Empieza con un solo canal y un horario acotado. Corregir con poco tráfico es más fácil.",
            en: "Start with a single channel and a limited schedule. Fixing things with little traffic is easier."
          }
        ]
      },
      {
        kind: "h2",
        text: {
          es: "Si algo no sale",
          en: "If something does not work"
        },
        id: {
          es: "si-algo-no-sale",
          en: "if-something-does-not-work"
        }
      },
      {
        kind: "list",
        variant: "fix",
        items: [
          {
            es: "No te deja publicar: GenSmart muestra **Configuración incompleta** con los campos que faltan. Completa esos campos y publica otra vez.",
            en: "You cannot publish: GenSmart shows **Incomplete configuration** with the missing fields. Fill them in and publish again."
          },
          {
            es: "La Vista previa responde distinto al canal real: confirma que publicaste la última versión y que el canal está conectado al agente correcto.",
            en: "Preview answers differently from the real channel: confirm you published the latest version and the channel is connected to the right agent."
          },
          {
            es: "Publicaste una versión que no te convence: en **Versiones**, elige la anterior y haz clic en **Revertir**.",
            en: "You published a version you are not happy with: in **Versions**, choose the previous one and click **Roll back**."
          },
          {
            es: "El agente inventa datos: el dato no está en la base de conocimiento. Agrégalo ahí; no lo arregles solo con reglas en el prompt.",
            en: "The agent makes up facts: the fact is not in the knowledge base. Add it there; do not fix it only with prompt rules."
          }
        ]
      }
    ],
    next: [
      "traspaso",
      "base-de-conocimiento"
    ]
  }
];
