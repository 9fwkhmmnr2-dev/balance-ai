"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../lib/supabase";
import VeraGoldWorkspace from "./vera-gold-workspace";
import VeraIsotype from "./vera-isotype";
const VeraCore3D = dynamic(() => import("./vera-core-3d"), {
  ssr: false,
  loading: () => <span className="vera-core-3d"><span className="vera-core-fallback" aria-hidden="true" /></span>,
});

type FinancialSummary = { currency: string; period: Period; income: number; expenses: number; netBalance: number; movementsCount: number };
type ChatMessage = { role: "user" | "model"; content: string; financialSummary?: FinancialSummary };
type Period = "daily" | "weekly" | "monthly" | "yearly";
type Conversation = { id: string; title: string; last_message_at: string; archived_at: string | null; created_at?: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const starters = ["¿Cómo vienen mis finanzas este mes?", "¿En qué estoy gastando más?", "Ayudame a entender mis gastos."];
const welcomePhrases = [
  "Tus cuentas al día, tu cabeza tranquila.",
  "Un paso a la vez. Tus finanzas también tienen su ritmo.",
  "Cada movimiento cuenta. Vamos a entenderlos juntos.",
  "Un poco más de claridad para tomar mejores decisiones.",
  "Tu progreso no siempre se mide en números.",
];
function pickWelcomePhrase(previous?: string) {
  const choices = welcomePhrases.filter((phrase) => phrase !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? welcomePhrases[0];
}
const periodLabels: Record<Period, string> = { daily: "Hoy", weekly: "Últimos 7 días", monthly: "Este mes", yearly: "Este año" };

function formatFinancialAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(amount)}`;
  }
}

function getFinancialComparison(summary: FinancialSummary) {
  const scale = Math.max(summary.income, summary.expenses, 0);
  return {
    incomeWidth: scale > 0 ? (summary.income / scale) * 100 : 0,
    expensesWidth: scale > 0 ? (summary.expenses / scale) * 100 : 0,
    expenseRatio: summary.income > 0 ? (summary.expenses / summary.income) * 100 : null,
    difference: Math.abs(summary.netBalance),
    outcome: summary.netBalance > 0 ? "Ingresos por encima de gastos" : summary.netBalance < 0 ? "Gastos por encima de ingresos" : "Ingresos y gastos equilibrados",
  };
}

function shouldShowFinancialSummary(message: string, previousMessages: ChatMessage[]) {
  const normalized = message.toLocaleLowerCase("es-AR");

  // Esta tarjeta resume ingresos, gastos y balance general. No debe aparecer
  // para consultas cuyo foco sea una categoría o un objetivo de ahorro.
  const categoryDetailIntent =
    /\b(en qué|dónde|cuál|cuáles|distribución|desglose|detalle)\b.*\b(categorías?|rubro|comida|transporte|servicios|suscripciones)\b/i.test(normalized) ||
    /\b(cuánto|cuanto|qué|que|dónde|donde)\b.*\b(gasté|gaste|gasto|gastado|gastos?)\b.*\b(en|de)\s+(comida|transporte|servicios|suscripciones)\b/i.test(normalized) ||
    /\b(categorías?|rubro)\b/i.test(normalized);
  const savingsGoalIntent =
    /\b(objetivo|meta)\b.*\b(ahorro|ahorrar|comprar|juntar)\b/i.test(normalized) ||
    /\b(cuánto me falta|progreso|voy avanzando)\b.*\b(ahorro|objetivo|meta|comprar)\b/i.test(normalized);
  if (categoryDetailIntent || savingsGoalIntent) return false;

  const overviewIntent =
    /\b(resumen financiero|resumen de mis finanzas|panorama financiero|estado de mis finanzas|cómo vienen mis finanzas|como vienen mis finanzas|analizá mis finanzas|analiza mis finanzas)\b/i.test(normalized);
  const totalsIntent =
    /\b(cuánto|cuanto|total)\b.*\b(gasté|gaste|gastado|ingresé|ingrese|ingresado|gastos|ingresos)\b/i.test(normalized) ||
    /\b(ingresos?|gastos?)\b.*\b(este mes|esta semana|hoy|este año|del período|del periodo)\b/i.test(normalized) ||
    /\b(saldo neto|balance general|balance del período|balance del periodo)\b/i.test(normalized);
  const comparisonIntent =
    /\b(compará|compara|comparar|comparación|comparacion)\b.*\b(ingresos?|gastos?)\b/i.test(normalized) ||
    /\b(ingresos?|gastos?)\b.*\b(vs\.?|versus)\b.*\b(ingresos?|gastos?)\b/i.test(normalized);
  if (overviewIntent || totalsIntent || comparisonIntent) return true;

  const visualIntent =
    /\b(tarjetas? (?:gráficas?|visuales?)|gráfic[oa]s?|comparaci[oó]n visual|visualiz(?:á|a|ame|ar)|mostrame (?:una )?(?:tarjeta|gráfico|gráfica|comparación))\b/i.test(normalized);
  const hasRecentFinancialContext = previousMessages.slice(-4).some((item) =>
    item.role === "user" &&
    /\b(finanzas?|gastos?|ingresos?|balance|saldo|movimientos?|resumen financiero)\b/i.test(item.content)
  );
  if (visualIntent && hasRecentFinancialContext) return true;

  const hasPreviousSummaryCard = previousMessages.some(
    (item) => item.role === "model" && Boolean(item.financialSummary)
  );
  const asksToRefreshPreviousCard =
    /\b(actualizá|actualiza|actualizalo|actualizála|armá|arma|armalo|mostrá|mostra|mostrame|repetí|repeti|otra vez|de nuevo)\b/i.test(normalized);
  return hasPreviousSummaryCard && asksToRefreshPreviousCard;
}
function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}
function renderModelContent(content: string) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) { blocks.push(<h3 key={i}>{renderInlineMarkdown(heading[1])}</h3>); i++; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      blocks.push(<ul key={i}>{items.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}</ul>);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; }
      blocks.push(<ol key={i}>{items.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}</ol>);
      continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^\s*(#{1,3}\s+|[-*]\s+|\d+[.)]\s+)/.test(lines[i])) { paragraph.push(lines[i].trim()); i++; }
    blocks.push(<p key={i}>{paragraph.map((part, index) => <span key={index}>{index > 0 ? " " : ""}{renderInlineMarkdown(part)}</span>)}</p>);
  }
  return <div className="vera-rich-content">{blocks}</div>;
}

export default function VeraView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [welcomePhrase, setWelcomePhrase] = useState(() => pickWelcomePhrase());
  const [period, setPeriod] = useState<Period>("monthly");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archived, setArchived] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCorePanel, setShowCorePanel] = useState(false);
  const [showGoldPanel, setShowGoldPanel] = useState(false);
  const [isGold, setIsGold] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [showGoldWelcome, setShowGoldWelcome] = useState(false);
  const [goldDemoPhase, setGoldDemoPhase] = useState<"idle" | "unstable" | "nucleus-gold" | "focus" | "transform" | "complete" | "dismissed">("idle");
  const [showTools, setShowTools] = useState(false);
  const [goldWorkspaceMode, setGoldWorkspaceMode] = useState<"actions" | "planning" | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const attachmentRef = useRef<HTMLInputElement | null>(null);
  const [listening, setListening] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const composeRef = useRef<HTMLTextAreaElement | null>(null);

  const getToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (sessionError || !token) throw new Error("Tu sesión no está disponible. Volvé a iniciar sesión.");
    return token;
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = await getToken();
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch("/api/vera/conversations", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/vera/conversations?archived=true", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);
      const activePayload = await activeResponse.json();
      const archivedPayload = await archivedResponse.json();
      if (!activeResponse.ok || !archivedResponse.ok) throw new Error(activePayload.error || archivedPayload.error || "No pude cargar el historial.");
      setConversations(activePayload.conversations ?? []);
      setArchived(archivedPayload.conversations ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude cargar el historial.");
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => () => { speechRecognitionRef.current?.stop(); }, []);

  // El estado FINANCE PLUS se consulta al servidor para usar el mismo criterio de acceso que protege la API.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/vera/entitlement", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const entitlement = await response.json() as { isGold?: boolean; accountId?: string };
      if (!active) return;
      setAccountId(entitlement.accountId ?? "");
      if (!entitlement.isGold) return;
      setIsGold(true);
      let welcomeSeen = false;
      try {
        const key = `vera-gold-welcome-seen:${entitlement.accountId}`;
        welcomeSeen = window.localStorage.getItem(key) === "true";
        if (!welcomeSeen) window.localStorage.setItem(key, "true");
      } catch {
        // Si el almacenamiento está bloqueado, la experiencia sigue funcionando.
      }
      if (!welcomeSeen) setShowGoldWelcome(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (window.location.search.includes("goldDemo=1")) {
      window.history.replaceState({}, "", window.location.pathname);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        setGoldDemoPhase("complete");
        return;
      }
      setGoldDemoPhase("unstable");
      const timers = [
        window.setTimeout(() => setGoldDemoPhase("nucleus-gold"), 1700),
        window.setTimeout(() => setGoldDemoPhase("focus"), 3300),
        window.setTimeout(() => setGoldDemoPhase("transform"), 4700),
        window.setTimeout(() => setGoldDemoPhase("complete"), 7600),
      ];
      return () => timers.forEach(window.clearTimeout);
    }
  }, []);

  useEffect(() => {
    if (!showGoldWelcome) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => setShowGoldWelcome(false), reducedMotion ? 350 : 5400);
    return () => window.clearTimeout(timeout);
  }, [showGoldWelcome]);

  async function toggleDictation() {
    if (listening) {
      speechRecognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const browserWindow = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("El dictado por voz no está disponible en este navegador. Podés escribir tu mensaje normalmente.");
      return;
    }
    try {
      // Request microphone permission only after the user taps the dictation button.
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      const recognition = new Recognition();
      recognition.lang = "es-AR";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join("");
        setDraft(transcript);
        if (composeRef.current) {
          composeRef.current.style.height = "auto";
          composeRef.current.style.height = `${Math.min(composeRef.current.scrollHeight, 132)}px`;
        }
      };
      recognition.onerror = (event) => {
        setListening(false);
        setError(event.error === "not-allowed"
          ? "No se habilitó el micrófono. Podés revisar el permiso del navegador."
          : "No pude reconocer la voz. Probá nuevamente o escribí tu mensaje.");
      };
      recognition.onend = () => setListening(false);
      speechRecognitionRef.current = recognition;
      setError("");
      recognition.start();
      setListening(true);
    } catch (cause) {
      setListening(false);
      const denied = cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "PermissionDeniedError");
      setError(denied
        ? "No se habilitó el micrófono. Permití el acceso al audio desde los ajustes de Safari y volvé a intentarlo."
        : "No pude iniciar el dictado. Probá nuevamente.");
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (composeRef.current) {
      composeRef.current.style.height = "auto";
      composeRef.current.style.height = `${Math.min(composeRef.current.scrollHeight, 132)}px`;
    }
  }

  async function saveConversation(nextMessages: ChatMessage[], id: string | null) {
    const token = await getToken();
    const response = await fetch("/api/vera/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, messages: nextMessages.slice(-100) }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.conversation?.id) throw new Error(payload.error || "No pude guardar esta conversación.");
    setConversationId(payload.conversation.id);
    await loadHistory();
  }

  async function openConversation(id: string) {
    if (sending) return;
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`/api/vera/conversations?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.conversation) throw new Error(payload.error || "No pude abrir esa conversación.");
      setConversationId(payload.conversation.id);
      setMessages(payload.conversation.messages ?? []);
      setDraft("");
      setShowHistory(false);
      setShowArchived(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude abrir esa conversación.");
    }
  }

  function newConversation() {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setWelcomePhrase((current) => pickWelcomePhrase(current));
    setError("");
    setShowHistory(false);
    setShowArchived(false);
  }

  async function changeArchive(id: string, action: "archive" | "restore") {
    try {
      const token = await getToken();
      const response = await fetch("/api/vera/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pude actualizar la conversación.");
      if (conversationId === id && action === "archive") newConversation();
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude actualizar la conversación.");
    }
  }
 
  async function renameConversation(id: string) {
    const title = editingTitle.replace(/\\s+/g, " ").trim();
    if (!title || title.length > 64 || savingTitle) return;
    setSavingTitle(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/vera/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action: "rename", title }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pude cambiar el título.");
      setEditingConversationId(null);
      setEditingTitle("");
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude cambiar el título.");
    } finally {
      setSavingTitle(false);
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("¿Eliminar definitivamente esta conversación?")) return;
    try {
      const token = await getToken();
      const response = await fetch("/api/vera/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pude eliminar la conversación.");
      if (conversationId === id) newConversation();
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude eliminar la conversación.");
    }
  }

  async function sendMessage(value: string) {
    const text = value.trim();
    if (!text || sending) return;
    setError("");
    setDraft("");
    if (composeRef.current) composeRef.current.style.height = "46px";
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const accessToken = await getToken();
      const response = await fetch("/api/vera/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: nextMessages.slice(-11).filter((message, index) => index > 0 || message.role === "user").map(({ role, content }) => ({ role, content })), period }),
      });
      const payload = await response.json() as { reply?: string; error?: string; financialSummary?: FinancialSummary };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "No pude recibir una respuesta de VERA.");
      const financialSummary = payload.financialSummary && shouldShowFinancialSummary(text, messages) ? payload.financialSummary : undefined;
      const completedMessages = [...nextMessages, { role: "model" as const, content: payload.reply, ...(financialSummary ? { financialSummary } : {}) }];
      setMessages(completedMessages);
      await saveConversation(completedMessages, conversationId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude conectar con VERA.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  const visibleConversations = showArchived ? archived : conversations;

  return (
    <div className={`vera-page${isGold ? " is-gold-active" : ""}${goldDemoPhase !== "idle" ? ` gold-demo-${goldDemoPhase}` : ""}`}>
      <style>{`
        .vera-page{--v:#a78bfa;--v2:#7c3aed;--ink:#09090d;--panel:#14121c;--line:rgba(196,181,253,.15);color:#f5f3fa;max-width:1000px;margin:0 auto;padding:12px 0 48px}
        .vera-shell{position:relative;isolation:isolate;overflow:hidden;border:1px solid rgba(167,139,250,.22);border-radius:26px;background:radial-gradient(ellipse at 50% -10%,rgba(124,58,237,.22),transparent 48%),linear-gradient(155deg,#171020,#0d0a14 58%,#09080e);box-shadow:0 22px 65px rgba(0,0,0,.22)}
        .vera-shell:before,.vera-shell:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;filter:blur(18px);opacity:.95;background:radial-gradient(ellipse 58% 24% at 8% 20%,rgba(124,58,237,.46),transparent 72%),radial-gradient(ellipse 54% 25% at 92% 34%,rgba(167,139,250,.38),transparent 72%),radial-gradient(ellipse 60% 30% at 50% 86%,rgba(91,33,182,.42),transparent 72%);animation:vera-aurora 13s ease-in-out infinite alternate}.vera-shell:after{opacity:.72;filter:blur(24px);background:linear-gradient(112deg,transparent 8%,rgba(139,92,246,.12) 25%,transparent 39%,rgba(196,181,253,.15) 57%,transparent 72%),radial-gradient(ellipse 45% 20% at 72% 68%,rgba(196,181,253,.27),transparent 75%);animation-duration:18s;animation-direction:alternate-reverse}.vera-shell>*{position:relative;z-index:1}
        .vera-hero{position:relative;overflow:hidden;border:0;border-radius:0;background:transparent;padding:8px 24px 19px;text-align:center}

        .vera-eyebrow{font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:#c4b5fd;font-weight:700}
        .vera-hero h1{font-size:clamp(28px,5vw,38px);letter-spacing:-1.4px;margin:9px 0 7px;font-weight:750}
        .vera-hero h1 span{color:#c4b5fd}
        .vera-sub{max-width:520px;margin:0 auto;color:#b8b2c5;font-size:13px;line-height:1.65}\n        .vera-welcome-phrase{margin:15px auto 0;color:#c4b5fd;font-size:13px;font-style:italic;letter-spacing:.1px;line-height:1.6;animation:vera-phrase-in .9s ease both;text-shadow:0 0 18px rgba(167,139,250,.18)}
                .vera-chat{margin-top:0;border:0;border-top:1px solid var(--line);border-radius:0;overflow:hidden;background:rgba(10,8,15,.22)}
        .vera-chat-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-bottom:1px solid var(--line);min-height:70px}
        .vera-chat-head.is-welcome{align-items:center;justify-content:center;min-height:126px;padding:18px}
        .vera-brand{display:flex;align-items:center;gap:11px;min-width:0}
        .vera-brand-copy strong{display:block;font-size:14px;letter-spacing:.3px}
        .vera-brand-copy small{display:block;color:#a99dbb;font-size:10px;margin-top:3px}
        .vera-core-button{display:grid;place-items:center;flex:0 0 auto;width:48px;height:48px;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;transition:transform .25s ease}
        .vera-core-button .vera-core-3d{position:relative;display:block;width:100%;height:100%;min-width:36px;min-height:36px;overflow:visible;isolation:isolate;filter:drop-shadow(0 0 12px rgba(139,92,246,.38)) drop-shadow(0 0 25px rgba(91,33,182,.2))}.vera-core-3d canvas{position:relative;z-index:1;display:block;width:100%!important;height:100%!important}.vera-core-fallback{position:absolute;inset:13%;display:block;border-radius:46% 54% 49% 51%;background:radial-gradient(circle at 32% 25%,#f2eaff 0 5%,#c5a8ff 15%,#9560e9 42%,#552b98 70%,#1a0d2b 100%);box-shadow:inset 2px 3px 8px rgba(255,255,255,.55),inset -7px -8px 14px rgba(17,5,35,.7),0 0 18px rgba(139,92,246,.48),0 0 34px rgba(91,33,182,.28);animation:vera-core-morph 8s ease-in-out infinite,vera-core-breathe 4.2s ease-in-out infinite}.vera-core-3d.has-webgl .vera-core-fallback{opacity:.22}
        .vera-chat-head.is-welcome .vera-core-button{width:82px;height:82px}
        .vera-core-button:hover{transform:scale(1.05)}
        .vera-core-button:focus-visible{outline:2px solid #c4b5fd;outline-offset:5px}
        .vera-core-visual{position:relative;display:block;width:36px;height:36px;isolation:isolate;filter:drop-shadow(0 0 12px rgba(139,92,246,.38)) drop-shadow(0 0 25px rgba(91,33,182,.2));transform-style:preserve-3d;}
        .vera-chat-head.is-welcome .vera-core-visual{width:66px;height:66px;filter:drop-shadow(0 0 22px rgba(139,92,246,.45))}
        .vera-core-visual:before{content:"";position:absolute;inset:5% 7% 7% 4%;border-radius:42% 58% 64% 36%/44% 38% 62% 56%;background:radial-gradient(ellipse at 29% 19%,rgba(255,255,255,.98) 0%,rgba(231,216,255,.94) 7%,rgba(180,154,255,.92) 19%,rgba(137,86,232,.96) 39%,rgba(92,44,170,.98) 66%,#170d29 100%);box-shadow:inset 2px 3px 8px rgba(255,255,255,.62),inset -7px -9px 15px rgba(17,5,35,.72),inset 3px -2px 9px rgba(196,181,253,.2),0 0 18px rgba(139,92,246,.42),0 0 38px rgba(91,33,182,.24);animation:vera-core-morph 8s ease-in-out infinite,vera-core-breathe 4.2s ease-in-out infinite;transform-origin:48% 52%;}
        .vera-core-visual:after{content:"";position:absolute;inset:-8%;border:1px solid rgba(196,181,253,.4);border-radius:58% 42% 38% 62%/46% 60% 40% 54%;transform:rotate(-18deg);animation:vera-core-wave 4.8s ease-out infinite}
        .vera-core-depth{position:absolute;z-index:1;inset:13% 12% 12% 15%;border-radius:48% 52% 39% 61%/42% 43% 57% 58%;background:radial-gradient(ellipse at 68% 72%,rgba(21,7,42,.88),rgba(67,28,117,.42) 32%,transparent 68%);filter:blur(2px);mix-blend-mode:multiply;animation:vera-core-depth 6.8s ease-in-out infinite;}.vera-core-inner{position:absolute;z-index:2;inset:22% 19% 25% 24%;border-radius:55% 45% 38% 62%/43% 38% 62% 57%;background:radial-gradient(ellipse at 35% 30%,rgba(255,255,255,.98),rgba(220,202,255,.72) 15%,rgba(161,115,255,.28) 42%,rgba(83,38,145,.08) 68%,transparent 74%);filter:blur(1px);box-shadow:0 0 13px rgba(222,207,255,.2);animation:vera-core-inner 5.5s ease-in-out infinite}.vera-core-filament{position:absolute;z-index:3;inset:18% 8% 26% 28%;border:1px solid rgba(238,228,255,.5);border-left-color:transparent;border-bottom-color:rgba(196,181,253,.12);border-radius:62% 38% 58% 42%/42% 61% 39% 58%;transform:rotate(-28deg);filter:blur(.35px);animation:vera-core-filament 7s ease-in-out infinite}.vera-core-glint{position:absolute;z-index:4;top:18%;left:25%;width:22%;height:13%;border-radius:50%;background:rgba(255,255,255,.82);filter:blur(3px);transform:rotate(-35deg);opacity:.7;animation:vera-core-glint 5s ease-in-out infinite}
        .vera-core-particle{position:absolute;z-index:2;width:3px;height:3px;border-radius:50%;background:#eee5ff;box-shadow:0 0 8px rgba(225,211,255,.9)}
        .vera-core-particle.one{top:8%;right:14%;animation:vera-core-drift 5s ease-in-out infinite}
        .vera-core-particle.two{bottom:13%;left:8%;width:2px;height:2px;animation:vera-core-drift 6s ease-in-out -2s infinite reverse}
        .vera-core-visual.is-thinking:before{animation-duration:2.1s,1.5s;filter:brightness(1.2) saturate(1.12)}.vera-core-visual.is-thinking .vera-core-filament{animation-duration:2.2s}.vera-core-visual.is-thinking .vera-core-glint{opacity:1}
        .vera-core-visual.is-thinking:after{animation-duration:1.7s}
        .vera-head-actions{display:flex;align-items:center;gap:8px}
        .vera-chat-head.is-welcome .vera-head-actions{position:absolute;top:14px;right:16px}
        .vera-history-toggle,.vera-new-chat{border:1px solid rgba(196,181,253,.2);background:linear-gradient(145deg,rgba(42,31,59,.96),rgba(22,17,31,.98));color:#e7dcff;border-radius:10px;padding:8px 10px;font-size:11px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 5px 14px rgba(0,0,0,.16);transition:transform .2s ease,border-color .2s ease,background .2s ease,box-shadow .2s ease}.vera-history-toggle{display:grid;place-items:center;width:36px;height:36px;padding:0;font-size:19px;line-height:1}
        .vera-gold-entry{display:flex;justify-content:flex-start;padding:12px 16px 0}.vera-gold-trigger{border:1px solid rgba(200,169,107,.42);border-radius:7px;background:linear-gradient(115deg,#17130d,#090a0d);color:#d8bb7d;padding:7px 10px;font-size:9px;font-weight:750;letter-spacing:.13em;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);transition:border-color .2s,transform .2s,box-shadow .2s}.vera-gold-trigger:hover{border-color:rgba(228,207,158,.8);transform:translateY(-1px);box-shadow:0 6px 20px rgba(200,169,107,.12)}.vera-gold-panel{margin:12px 16px 0;padding:18px;border:1px solid rgba(200,169,107,.3);border-radius:15px;background:radial-gradient(ellipse at 0% 0%,rgba(200,169,107,.12),transparent 55%),linear-gradient(145deg,#15130f,#0b0b0d 72%);box-shadow:0 16px 36px rgba(0,0,0,.24);animation:vera-message-in .28s ease both}.vera-gold-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.vera-gold-panel-mark{color:#e2c98f;font-size:10px;font-weight:750;letter-spacing:.16em}.vera-gold-panel h2{margin:8px 0 5px;color:#f2ead8;font-size:19px;letter-spacing:-.3px}.vera-gold-panel-intro{margin:0;color:#aaa397;font-size:11px;line-height:1.65;max-width:560px}.vera-gold-close{border:1px solid rgba(200,169,107,.22);border-radius:8px;background:rgba(255,255,255,.025);color:#cbb98f;width:30px;height:30px;flex:0 0 30px;cursor:pointer;font-size:17px}.vera-gold-benefits{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:15px}.vera-gold-benefit{padding:10px 11px;border:1px solid rgba(200,169,107,.13);border-radius:10px;background:rgba(255,255,255,.025)}.vera-gold-benefit strong{display:block;color:#e7d6ae;font-size:11px;margin-bottom:4px}.vera-gold-benefit span{display:block;color:#a8a196;font-size:10px;line-height:1.5}.vera-gold-panel-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px;padding-top:13px;border-top:1px solid rgba(200,169,107,.13)}.vera-gold-panel-foot p{margin:0;color:#8f897e;font-size:10px;line-height:1.5}.vera-gold-compare-wrap{overflow-x:auto;margin-top:16px;border:1px solid rgba(200,169,107,.16);border-radius:10px}.vera-gold-compare{width:100%;border-collapse:collapse;font-size:10px}.vera-gold-compare th,.vera-gold-compare td{padding:10px 9px;border-bottom:1px solid rgba(200,169,107,.1);text-align:center;color:#bdb5a6}.vera-gold-compare th:first-child,.vera-gold-compare td:first-child{text-align:left;color:#e6dfd0}.vera-gold-compare th{color:#d8bf83;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.vera-gold-compare tr:last-child td{border-bottom:0}.vera-gold-compare td:nth-child(3){color:#e8d5a8;font-weight:700}.vera-gold-panel-price{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px;padding-top:14px;border-top:1px solid rgba(200,169,107,.14)}.vera-gold-panel-price strong,.vera-gold-panel-price span{display:block}.vera-gold-panel-price strong{color:#f0dfb7;font-size:12px}.vera-gold-panel-price span{margin-top:4px;color:#9f988b;font-size:10px}.vera-gold-buy{flex:0 0 auto;padding:10px 13px;border:1px solid rgba(200,169,107,.45);border-radius:8px;background:linear-gradient(120deg,#3b2d17,#17130d);color:#f0dba8;text-decoration:none;font-size:10px;font-weight:750}.vera-gold-panel-note{margin:10px 0 0;color:#8f897e;font-size:9px;line-height:1.5}.vera-gold-details{display:none}@media(max-width:520px){.vera-gold-benefits{grid-template-columns:1fr}.vera-gold-panel{margin-left:10px;margin-right:10px;padding:14px}.vera-gold-panel-foot{align-items:flex-start;flex-direction:column}.vera-gold-entry{padding-left:12px}}
        .vera-core-panel{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 18px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,rgba(124,58,237,.16),rgba(20,18,28,.9))}
        .vera-core-panel strong{display:block;color:#eee8fa;font-size:12px}
        .vera-core-panel p{margin-top:4px;color:#aaa1b8;font-size:11px;line-height:1.45}
        .vera-core-panel button{flex:0 0 auto;border:1px solid rgba(196,181,253,.2);border-radius:9px;background:#211a2d;color:#d9cafa;padding:7px 9px;font-size:10px;cursor:pointer}
        .vera-chat button:focus-visible,.vera-drawer button:focus-visible{outline:2px solid rgba(196,181,253,.9);outline-offset:3px}.vera-history-toggle:hover,.vera-new-chat:hover,.vera-core-panel button:hover,.vera-drawer-new:hover,.vera-drawer-tab:hover,.vera-history-action:hover,.vera-drawer-close:hover{transform:translateY(-1px);border-color:rgba(196,181,253,.58);filter:brightness(1.12)}.vera-history-toggle:active,.vera-new-chat:active,.vera-core-panel button:active,.vera-drawer-new:active,.vera-drawer-tab:active{transform:scale(.97)}
        .vera-period{background:#1c1728;border:1px solid rgba(196,181,253,.2);border-radius:9px;padding:8px;color:#ddd3f2;font-size:11px;max-width:150px}
        .vera-messages{display:flex;flex-direction:column;gap:13px;min-height:245px;max-height:470px;overflow-y:auto;padding:20px 17px}
                .vera-bubble{max-width:84%;padding:12px 14px;border-radius:16px;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;animation:vera-message-in .34s cubic-bezier(.2,.8,.2,1) both}
        .vera-bubble.model{align-self:flex-start;background:#211a2d;border:1px solid rgba(196,181,253,.12);color:#eee9f6;border-top-left-radius:5px}
        .vera-rich-content{display:flex;flex-direction:column;gap:9px}.vera-rich-content p{margin:0}.vera-rich-content strong{color:#fff;font-weight:650;text-shadow:0 0 16px rgba(180,154,255,.12)}.vera-rich-content h3{margin:3px 0 0;color:#d9c7ff;font-size:13px;line-height:1.45;font-weight:650;letter-spacing:.01em}.vera-rich-content ul,.vera-rich-content ol{margin:0;padding-left:19px;display:flex;flex-direction:column;gap:5px}.vera-rich-content li{padding-left:2px}.vera-rich-content li::marker{color:#b49aff}.vera-rich-content code{padding:2px 5px;border-radius:5px;background:rgba(180,154,255,.12);color:#dfd1ff;font-size:.92em}.vera-bubble.model{white-space:normal}.vera-bubble.model .vera-rich-content{overflow-wrap:anywhere}
        .vera-financial-card{margin-top:14px;padding:15px;border:1px solid rgba(180,154,255,.25);border-radius:16px;background:radial-gradient(ellipse at 4% 0%,rgba(124,58,237,.18),transparent 48%),linear-gradient(145deg,rgba(34,26,49,.98),rgba(15,13,22,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 12px 28px rgba(0,0,0,.16);animation:vera-message-in .42s ease both}.vera-financial-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:13px}.vera-financial-card-title{font-size:9px;letter-spacing:1.25px;text-transform:uppercase;color:#d2c2ff;font-weight:750}.vera-financial-card-period{font-size:10px;color:#aaa0ba}.vera-financial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.vera-financial-metric{min-width:0;padding:9px 8px;border-radius:10px;background:rgba(255,255,255,.028);border:1px solid rgba(196,181,253,.09)}.vera-financial-metric span{display:block;color:#aaa2b7;font-size:10px;margin-bottom:5px}.vera-financial-metric strong{display:block;color:#f4efff;font-size:clamp(11px,2vw,14px);font-weight:650;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.vera-financial-metric.net strong{color:#d0bdff}.vera-financial-comparison{margin-top:13px;padding:11px 11px 10px;border-radius:12px;background:rgba(7,6,12,.34);border:1px solid rgba(196,181,253,.1)}.vera-financial-comparison-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.vera-financial-comparison-head strong{font-size:11px;color:#eee8fa;font-weight:650}.vera-financial-comparison-head span{font-size:9px;color:#a99dbb;text-align:right}.vera-financial-bar-row{display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:9px;margin-top:7px}.vera-financial-bar-label{font-size:10px;color:#aaa2b7}.vera-financial-track{height:7px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.vera-financial-fill{height:100%;border-radius:99px;transition:width .65s cubic-bezier(.2,.75,.25,1)}.vera-financial-fill.income{background:linear-gradient(90deg,#8b65db,#c4a8ff);box-shadow:0 0 12px rgba(167,139,250,.28)}.vera-financial-fill.expenses{background:linear-gradient(90deg,#66508e,#a78bfa);opacity:.82}.vera-financial-insight{margin-top:10px;color:#cfc3e2;font-size:10px;line-height:1.5}.vera-financial-insight strong{color:#e9ddff;font-weight:650}.vera-financial-foot{margin-top:10px;color:#91889f;font-size:10px}.vera-bubble.model:has(.vera-financial-card){max-width:min(94%,620px)}@media(max-width:520px){.vera-financial-grid{gap:5px}.vera-financial-metric{padding:8px 6px}.vera-financial-metric span{font-size:9px}.vera-financial-card{padding:11px}.vera-financial-bar-row{grid-template-columns:52px minmax(0,1fr)}}
        .vera-bubble.user{align-self:flex-end;background:linear-gradient(135deg,#7040bd,#59319d);color:#fff;border-top-right-radius:5px}
        .vera-thinking{align-self:flex-start;display:flex;align-items:center;gap:8px;color:#c4b5fd;font-size:12px;padding:5px 10px;animation:vera-message-in .25s ease both}
        .vera-mini-coin{width:18px;height:18px;flex:0 0 18px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#e1d5ff,#a879ff 42%,#5923a7 80%);box-shadow:0 0 12px rgba(167,139,250,.4);animation:vera-breathe 1.5s ease-in-out infinite}
        .vera-dots{display:inline-flex;gap:3px;align-items:center}.vera-dots i{width:4px;height:4px;border-radius:50%;background:#c8adff;animation:vera-dot-wave .9s ease-in-out infinite}.vera-dots i:nth-child(2){animation-delay:.14s}.vera-dots i:nth-child(3){animation-delay:.28s}
        .vera-starters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:0 17px 20px}
        .vera-starters-label{grid-column:1/-1;color:#bca8e8;font-size:10px;letter-spacing:1.1px;text-transform:uppercase;padding:0 2px 1px}
        .vera-starter{display:flex;align-items:center;gap:10px;min-height:58px;text-align:left;border:1px solid rgba(196,181,253,.24);background:linear-gradient(145deg,rgba(124,58,237,.16),rgba(25,21,34,.92));color:#e8defa;border-radius:14px;padding:11px 12px;font-size:12px;line-height:1.45;cursor:pointer;transition:border-color .2s,background .2s,transform .2s,box-shadow .2s}
        .vera-starter:before{content:"✧";display:grid;place-items:center;flex:0 0 27px;width:27px;height:27px;border-radius:9px;background:rgba(167,139,250,.15);color:#d8c4ff;font-size:17px;box-shadow:inset 0 0 0 1px rgba(196,181,253,.16)}
        .vera-starter:hover{border-color:rgba(196,181,253,.55);background:linear-gradient(145deg,rgba(124,58,237,.28),rgba(35,27,49,.96));transform:translateY(-2px);box-shadow:0 8px 24px rgba(76,29,149,.16)}
        .vera-starter:disabled{opacity:.5;cursor:default}
        .vera-compose{padding:13px 15px 15px;border-top:1px solid var(--line);background:rgba(8,7,12,.45);transition:background .25s ease,box-shadow .25s ease}.vera-compose:focus-within{background:linear-gradient(110deg,rgba(36,23,56,.72),rgba(10,8,15,.72));box-shadow:inset 0 1px 0 rgba(196,181,253,.12),0 -8px 28px rgba(91,33,182,.08)}
        .vera-compose form{display:flex;align-items:flex-end;gap:8px;position:relative}
        .vera-compose-tools{position:relative;flex:0 0 auto}
        .vera-tool-trigger,.vera-mic{display:grid;place-items:center;width:44px;height:46px;flex:0 0 44px;border:1px solid rgba(196,181,253,.19);border-radius:14px;background:linear-gradient(150deg,#211a2d,#15111d);color:#d9cafa;font-size:21px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 5px 14px rgba(0,0,0,.16);transition:transform .18s ease,border-color .2s ease,background .2s ease,box-shadow .2s ease}
        .vera-tool-trigger:hover,.vera-mic:hover{transform:translateY(-2px);border-color:rgba(196,181,253,.52);box-shadow:0 7px 18px rgba(91,33,182,.2)}
        .vera-tool-trigger:active,.vera-mic:active{transform:scale(.95)}
        .vera-tools-menu{position:absolute;left:0;bottom:56px;z-index:20;width:min(280px,78vw);padding:12px;border:1px solid rgba(196,181,253,.22);border-radius:16px;background:linear-gradient(155deg,rgba(35,27,49,.98),rgba(14,11,20,.98));box-shadow:0 18px 48px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(18px);animation:vera-tools-in .18s ease both}
        .vera-tools-title{display:block;margin:1px 2px 9px;color:#bca8e8;font-size:10px;letter-spacing:1px;text-transform:uppercase}
        .vera-tools-group{padding:0 0 8px;margin:0 0 8px;border-bottom:1px solid rgba(196,181,253,.12)}.vera-tools-group.gold{border-bottom:0;margin-bottom:2px}.vera-tools-group-title{display:block;padding:5px 8px;color:#bca8e8;font-size:9px;font-weight:750;letter-spacing:1.15px}.vera-tools-group.gold .vera-tools-group-title{color:#e3c98f}.vera-tools-locked{margin:5px 8px 8px;color:#b7aebf;font-size:11px;line-height:1.5}
        .vera-tools-label{display:block;margin:0 2px 6px;color:#a99dbb;font-size:10px}
        .vera-tools-period{width:100%;margin-bottom:9px;max-width:none;background:#171320;border:1px solid rgba(196,181,253,.2);border-radius:9px;padding:9px;color:#eee5ff;font-size:12px}
        .vera-tools-action{display:flex;align-items:center;gap:9px;width:100%;padding:10px 9px;border:1px solid transparent;border-radius:10px;background:transparent;color:#e8defa;text-align:left;font-size:12px;cursor:pointer;transition:background .18s,border-color .18s,transform .18s}
        .vera-tools-action:hover{background:rgba(124,58,237,.17);border-color:rgba(196,181,253,.16);transform:translateX(2px)}
        .vera-tools-action.gold{color:#e8d5a8}.vera-tools-action.gold span:first-child{background:rgba(200,169,107,.17);color:#e8d5a8}.vera-tools-action.gold:hover{background:rgba(200,169,107,.12);border-color:rgba(200,169,107,.25)}
        .vera-tools-action span:first-child{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:rgba(167,139,250,.14);color:#d8c4ff;font-size:15px}.vera-tool-icon svg{display:block;width:16px;height:16px}
        .vera-mic.is-listening{color:#fff;background:linear-gradient(145deg,#8f54df,#5b2b9c);border-color:rgba(221,204,255,.62);box-shadow:0 0 0 4px rgba(139,92,246,.13),0 0 22px rgba(139,92,246,.3);animation:vera-mic-pulse 1.4s ease-in-out infinite}
        .vera-input{flex:1;min-width:0;resize:none;min-height:46px;max-height:132px;background:linear-gradient(155deg,#1b1625,#13101a);border:1px solid rgba(196,181,253,.2);border-radius:14px;padding:12px;color:#f5f3fa;font:inherit;font-size:13px;outline:none;box-shadow:inset 0 2px 7px rgba(0,0,0,.22),0 1px 0 rgba(255,255,255,.025);transition:border-color .22s ease,box-shadow .22s ease,background .22s ease}
        .vera-input:focus{border-color:rgba(196,181,253,.72);background:linear-gradient(155deg,#21192e,#17121f);box-shadow:0 0 0 3px rgba(167,139,250,.13),0 0 24px rgba(124,58,237,.12),inset 0 2px 7px rgba(0,0,0,.18)}
        .vera-send{position:relative;overflow:hidden;width:46px;height:46px;flex-shrink:0;border:1px solid rgba(232,220,255,.22);border-radius:14px;background:linear-gradient(145deg,#9b76ed,#6330bd);color:white;font-size:20px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 6px 17px rgba(91,33,182,.25);transition:transform .18s ease,filter .2s ease,box-shadow .2s ease,background .2s ease}
        .vera-send:disabled{opacity:.38;cursor:default;box-shadow:none}.vera-send.ready{background:linear-gradient(145deg,#d4c0ff 0%,#a77af5 38%,#7439d2 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 0 0 1px rgba(196,181,253,.14),0 0 22px rgba(139,92,246,.32);animation:vera-send-ready 2.8s ease-in-out infinite}.vera-send-arrow{display:block;transition:transform .2s cubic-bezier(.2,.8,.2,1)}.vera-send:not(:disabled):hover{transform:translateY(-2px);filter:brightness(1.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.32),0 9px 23px rgba(91,33,182,.35)}.vera-send:not(:disabled):hover .vera-send-arrow{transform:translate(2px,-2px)}.vera-send:not(:disabled):active{transform:scale(.94)}
        .vera-error{padding:0 17px 13px;color:#f0b4c0;font-size:12px}
        .vera-listening-label{margin:8px 3px 0;color:#c4b5fd;font-size:10px;animation:vera-phrase-in .2s ease both}.vera-privacy{margin:12px 3px 0;color:#898194;font-size:10px;line-height:1.6;text-align:center}
        .vera-drawer-backdrop{position:fixed;inset:0;z-index:80;background:rgba(4,3,8,.62);backdrop-filter:blur(5px);display:flex;justify-content:flex-start}
        .vera-drawer{width:min(340px,88vw);height:100%;overflow-y:auto;background:linear-gradient(165deg,#1a1425,#0d0b12 70%);border-right:1px solid rgba(196,181,253,.2);box-shadow:20px 0 60px rgba(0,0,0,.35);padding:20px 15px;animation:vera-drawer-in .22s ease both}
        .vera-drawer-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.vera-drawer-top strong{font-size:16px}.vera-drawer-close{background:transparent;border:0;color:#cfc3e4;font-size:23px;cursor:pointer}
        .vera-drawer-new{width:100%;padding:11px;border:1px solid rgba(196,181,253,.25);border-radius:12px;background:linear-gradient(120deg,rgba(124,58,237,.28),rgba(76,29,149,.18));color:#f1eaff;font-size:12px;font-weight:650;cursor:pointer;margin-bottom:17px}
        .vera-drawer-tabs{display:flex;gap:6px;margin-bottom:15px}.vera-filter-label{display:block;color:#a99dbb;font-size:10px;letter-spacing:.7px;text-transform:uppercase;margin:0 0 7px 2px}.vera-period-drawer{width:100%;max-width:none;margin-bottom:18px}.vera-drawer-tab{flex:1;border:1px solid rgba(196,181,253,.15);border-radius:9px;padding:8px;background:#15111d;color:#a99dbb;font-size:11px;cursor:pointer}.vera-drawer-tab.active{background:rgba(124,58,237,.24);border-color:rgba(196,181,253,.35);color:#eee5ff}
        .vera-history-item{padding:10px;border:1px solid transparent;border-radius:11px;margin-bottom:6px;background:rgba(255,255,255,.025)}.vera-history-item.selected{border-color:rgba(167,139,250,.28);background:rgba(124,58,237,.12)}
        .vera-history-open{display:block;width:100%;text-align:left;background:transparent;border:0;color:#eee8f7;cursor:pointer;padding:0;font-size:12px;line-height:1.4}.vera-history-date{display:block;color:#8e849d;font-size:10px;margin-top:4px}
        .vera-history-actions{display:flex;gap:12px;margin-top:8px}.vera-history-action{border:0;background:transparent;color:#bba5e9;font-size:10px;padding:0;cursor:pointer}.vera-history-action.delete{color:#d99ba9}
        .vera-history-edit{display:flex;gap:6px;margin-top:8px}.vera-history-edit input{flex:1;min-width:0;border:1px solid rgba(196,181,253,.28);border-radius:8px;background:#100d17;color:#f5f3fa;padding:8px;font:inherit;font-size:11px;outline:none}.vera-history-edit input:focus{border-color:#a78bfa;box-shadow:0 0 0 2px rgba(167,139,250,.13)}.vera-history-edit button{border:1px solid rgba(196,181,253,.2);border-radius:7px;background:rgba(124,58,237,.2);color:#e9ddff;padding:6px 8px;font-size:10px;cursor:pointer}.vera-history-edit button:disabled{opacity:.4;cursor:default}
        .vera-history-empty{padding:24px 10px;text-align:center;color:#968ba5;font-size:12px;line-height:1.6}
        @keyframes vera-tools-in{from{opacity:0;transform:translateY(7px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes vera-mic-pulse{0%,100%{box-shadow:0 0 0 3px rgba(139,92,246,.1),0 0 14px rgba(139,92,246,.2)}50%{box-shadow:0 0 0 6px rgba(139,92,246,.06),0 0 24px rgba(139,92,246,.38)}}@keyframes vera-phrase-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}\n        @keyframes vera-aurora{0%{transform:translate3d(-2%,0,0) rotate(-4deg) scale(1)}50%{transform:translate3d(3%,2%,0) rotate(3deg) scale(1.06)}100%{transform:translate3d(-1%,4%,0) rotate(-2deg) scale(1.02)}}
        @keyframes vera-breathe{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.04);filter:brightness(1.1)}}
        @keyframes vera-shine{0%,62%{left:-65%;opacity:0}70%{opacity:.9}88%,100%{left:130%;opacity:0}}
        @keyframes vera-dot-wave{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-4px);opacity:1}}
        @keyframes vera-message-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes vera-pulse{0%{transform:scale(.92);opacity:.7}100%{transform:scale(1.2);opacity:0}}
        @keyframes vera-core-depth{0%,100%{transform:translate(0,0) rotate(-8deg) scale(.96);opacity:.65}50%{transform:translate(-2px,2px) rotate(8deg) scale(1.08);opacity:1}}@keyframes vera-core-filament{0%,100%{transform:rotate(-28deg) scale(.94);opacity:.45}50%{transform:rotate(18deg) scale(1.08);opacity:.95}}@keyframes vera-core-glint{0%,100%{transform:translate(-2px,1px) rotate(-35deg);opacity:.45}50%{transform:translate(4px,-3px) rotate(-25deg);opacity:.95}}@keyframes vera-send-ready{0%,100%{filter:brightness(1)}50%{filter:brightness(1.12)}}@keyframes vera-core-morph{0%,100%{border-radius:42% 58% 64% 36%/44% 38% 62% 56%}35%{border-radius:58% 42% 45% 55%/52% 62% 38% 48%}68%{border-radius:48% 52% 59% 41%/37% 48% 52% 63%}}
        @keyframes vera-core-breathe{0%,100%{filter:brightness(1);transform:scale(1)}50%{filter:brightness(1.14);transform:scale(1.045)}}
        @keyframes vera-core-wave{0%{transform:scale(.86) rotate(-18deg);opacity:.65}100%{transform:scale(1.24) rotate(8deg);opacity:0}}
        @keyframes vera-core-inner{0%,100%{transform:translate(0,0) scale(.94);opacity:.65}50%{transform:translate(3px,-2px) scale(1.12);opacity:1}}
        @keyframes vera-core-drift{0%,100%{transform:translate(0,0);opacity:.55}50%{transform:translate(3px,-5px);opacity:1}}
        @keyframes vera-drawer-in{from{transform:translateX(-18px);opacity:.6}to{transform:translateX(0);opacity:1}}

        .vera-shell.is-gold{border-color:rgba(200,169,107,.34);background:radial-gradient(ellipse at 50% -10%,rgba(200,169,107,.16),transparent 48%),linear-gradient(155deg,#17140f,#0d0b09 58%,#09090a);box-shadow:0 22px 65px rgba(0,0,0,.28),0 0 34px rgba(200,169,107,.06)}
        .vera-shell.is-gold:before,.vera-shell.is-gold:after{background:radial-gradient(ellipse 58% 24% at 8% 20%,rgba(173,132,62,.24),transparent 72%),radial-gradient(ellipse 54% 25% at 92% 34%,rgba(224,195,130,.2),transparent 72%),radial-gradient(ellipse 60% 30% at 50% 86%,rgba(126,91,38,.22),transparent 72%)}
        .vera-core-visual.is-gold{filter:drop-shadow(0 0 14px rgba(200,169,107,.42)) drop-shadow(0 0 28px rgba(155,115,45,.22))}
        .vera-chat-head.is-welcome .vera-core-visual.is-gold{filter:drop-shadow(0 0 24px rgba(218,185,112,.55))}
        .vera-core-visual.is-gold:before{background:radial-gradient(ellipse at 29% 19%,rgba(255,255,255,.99) 0%,rgba(255,239,195,.96) 8%,rgba(239,205,130,.95) 20%,rgba(190,145,62,.97) 42%,rgba(111,77,29,.99) 69%,#24190b 100%);box-shadow:inset 2px 3px 8px rgba(255,255,255,.7),inset -7px -9px 15px rgba(27,17,5,.76),inset 3px -2px 9px rgba(255,226,163,.26),0 0 20px rgba(200,169,107,.5),0 0 42px rgba(155,115,45,.3)}
        .vera-core-visual.is-gold:after{border-color:rgba(230,204,148,.55)}
        .vera-core-visual.is-gold .vera-core-depth{background:radial-gradient(ellipse at 68% 72%,rgba(38,25,8,.88),rgba(116,80,26,.42) 32%,transparent 68%)}
        .vera-core-visual.is-gold .vera-core-inner{background:radial-gradient(ellipse at 35% 30%,rgba(255,255,255,.99),rgba(255,231,174,.76) 15%,rgba(216,174,94,.3) 42%,rgba(128,87,29,.08) 68%,transparent 74%);box-shadow:0 0 16px rgba(255,226,163,.28)}
        .vera-core-visual.is-gold .vera-core-filament{border-color:rgba(255,236,192,.64);border-left-color:transparent;border-bottom-color:rgba(200,169,107,.18)}
        .vera-core-visual.is-gold .vera-core-particle{background:#fff0c9;box-shadow:0 0 9px rgba(255,226,163,.95)}
        .vera-gold-status{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(200,169,107,.34);border-radius:7px;background:linear-gradient(115deg,#17130d,#090a0d);color:#e1c78f;padding:7px 10px;font-size:9px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
        .vera-gold-status:before{content:"";width:5px;height:5px;border-radius:50%;background:#d8b76d;box-shadow:0 0 8px rgba(216,183,109,.8)}

        .vera-shell.is-gold{--line:rgba(200,169,107,.2);color:#f4eddd}
        .vera-shell.is-gold .vera-eyebrow,.vera-shell.is-gold .vera-hero h1 span,.vera-shell.is-gold .vera-welcome-phrase,.vera-shell.is-gold .vera-brand-copy strong,.vera-shell.is-gold .vera-starters-label,.vera-shell.is-gold .vera-thinking,.vera-shell.is-gold .vera-listening-label{color:#e2c78f;text-shadow:0 0 16px rgba(200,169,107,.12)}
        .vera-shell.is-gold .vera-brand-copy small,.vera-shell.is-gold .vera-sub,.vera-shell.is-gold .vera-privacy{color:#b8ad98}
        .vera-shell.is-gold .vera-chat-head,.vera-shell.is-gold .vera-chat,.vera-shell.is-gold .vera-compose{border-color:rgba(200,169,107,.2)}
        .vera-shell.is-gold .vera-history-toggle,.vera-shell.is-gold .vera-new-chat,.vera-shell.is-gold .vera-tool-trigger,.vera-shell.is-gold .vera-mic{border-color:rgba(200,169,107,.28);background:linear-gradient(145deg,#302719,#17130d);color:#ead7aa}
        .vera-shell.is-gold .vera-bubble.model{background:linear-gradient(145deg,#282116,#17130e);border-color:rgba(200,169,107,.2);color:#f0e8d8}
        .vera-shell.is-gold .vera-rich-content strong,.vera-shell.is-gold .vera-rich-content h3{color:#f1dba9;text-shadow:none}
        .vera-shell.is-gold .vera-rich-content li::marker{color:#d7b66e}
        .vera-shell.is-gold .vera-rich-content code{background:rgba(200,169,107,.12);color:#f0dcae}
        .vera-shell.is-gold .vera-bubble.user{background:linear-gradient(135deg,#9b7739,#6e5126);color:#fffaf0}
        .vera-shell.is-gold .vera-starter{border-color:rgba(200,169,107,.24);background:linear-gradient(145deg,rgba(200,169,107,.13),rgba(25,21,16,.94));color:#f0e5ce}
        .vera-shell.is-gold .vera-starter:before{background:rgba(200,169,107,.15);color:#efd79e;box-shadow:inset 0 0 0 1px rgba(200,169,107,.2)}
        .vera-shell.is-gold .vera-starter:hover{border-color:rgba(228,207,158,.6);background:linear-gradient(145deg,rgba(200,169,107,.22),rgba(35,29,20,.96))}
        .vera-shell.is-gold .vera-input{border-color:rgba(200,169,107,.26);background:linear-gradient(155deg,#211c14,#17130e);color:#f5f0e5}
        .vera-shell.is-gold .vera-input:focus{border-color:rgba(228,207,158,.7);box-shadow:0 0 0 3px rgba(200,169,107,.12),0 0 22px rgba(200,169,107,.1)}
        .vera-shell.is-gold .vera-send{border-color:rgba(255,239,199,.28);background:linear-gradient(145deg,#e4c77f,#99702f);color:#17120a;box-shadow:0 6px 17px rgba(155,115,45,.22)}
        .vera-shell.is-gold .vera-send.ready{background:linear-gradient(145deg,#f2dfae,#c59a4b 60%,#896126)}
        .vera-shell.is-gold .vera-mini-coin{background:radial-gradient(circle at 30% 25%,#fff0c9,#d7ae5b 42%,#76511e 80%);box-shadow:0 0 12px rgba(200,169,107,.4)}
        .vera-shell.is-gold .vera-dots i{background:#e8cf95}
        .vera-shell.is-gold .vera-financial-card{border-color:rgba(200,169,107,.26);background:radial-gradient(ellipse at 4% 0%,rgba(200,169,107,.16),transparent 48%),linear-gradient(145deg,rgba(39,31,19,.98),rgba(15,13,10,.98))}
        .vera-shell.is-gold .vera-financial-card-title,.vera-shell.is-gold .vera-financial-metric.net strong,.vera-shell.is-gold .vera-financial-insight strong{color:#ead39e}
        .vera-shell.is-gold .vera-financial-metric,.vera-shell.is-gold .vera-financial-comparison{border-color:rgba(200,169,107,.15)}
        .vera-shell.is-gold .vera-financial-fill.income,.vera-shell.is-gold .vera-financial-fill.expenses{background:linear-gradient(90deg,#987238,#e3c47c);box-shadow:0 0 12px rgba(200,169,107,.2)}
        .vera-shell.is-gold .vera-gold-trigger,.vera-shell.is-gold .vera-gold-status{border-color:rgba(200,169,107,.5)}
        .vera-shell.is-gold .vera-core-button:focus-visible{outline-color:#d7b66e}
        .vera-shell.is-gold .vera-period,.vera-shell.is-gold .vera-tools-period{border-color:rgba(200,169,107,.28);background:#211b11;color:#f0e5ce}
        .vera-shell.is-gold .vera-tools-menu{border-color:rgba(200,169,107,.25);background:linear-gradient(155deg,rgba(42,33,19,.98),rgba(14,12,9,.98))}
        .vera-shell.is-gold .vera-tools-title,.vera-shell.is-gold .vera-tools-label{color:#d8bf83}
        .vera-shell.is-gold .vera-tools-action{color:#eee3cb}
        .vera-shell.is-gold .vera-tools-action:hover{background:rgba(200,169,107,.12);border-color:rgba(200,169,107,.2)}
        .vera-shell.is-gold .vera-core-panel{border-color:rgba(200,169,107,.2);background:linear-gradient(110deg,rgba(200,169,107,.13),rgba(20,18,14,.9))}
        .vera-shell.is-gold .vera-core-panel strong,.vera-shell.is-gold .vera-core-panel button{color:#ead7aa}
        .vera-shell.is-gold .vera-core-panel button{border-color:rgba(200,169,107,.24);background:#2b2214}
        .vera-shell.is-gold .vera-error{color:#e9b8a9}
        .vera-page.is-gold-active .vera-drawer{background:linear-gradient(165deg,#211b11,#0d0b08 70%);border-color:rgba(200,169,107,.25)}
        .vera-page.is-gold-active .vera-drawer-top strong{color:#f0e5ce}
        .vera-page.is-gold-active .vera-drawer-close,.vera-page.is-gold-active .vera-history-action{color:#d8bf83}
        .vera-page.is-gold-active .vera-drawer-new,.vera-page.is-gold-active .vera-drawer-tab.active{border-color:rgba(200,169,107,.3);background:linear-gradient(120deg,rgba(200,169,107,.2),rgba(76,57,25,.18));color:#f0e5ce}
        .vera-page.is-gold-active .vera-drawer-tab{border-color:rgba(200,169,107,.16);background:#17130d;color:#b9ad93}
        .vera-page.is-gold-active .vera-history-item.selected{border-color:rgba(200,169,107,.3);background:rgba(200,169,107,.1)}
        .vera-page.is-gold-active .vera-history-open{color:#eee3cb}
        .vera-page.is-gold-active .vera-history-date,.vera-page.is-gold-active .vera-history-empty{color:#a99d83}
        .vera-page.is-gold-active .vera-history-edit input{border-color:rgba(200,169,107,.25);background:#100e09;color:#f5f3fa}
        .vera-page.is-gold-active .vera-history-edit button{border-color:rgba(200,169,107,.22);background:rgba(200,169,107,.15);color:#ead7aa}

        .vera-shell.is-gold .vera-compose:focus-within{background:linear-gradient(110deg,rgba(57,43,20,.55),rgba(10,9,7,.72));box-shadow:inset 0 1px 0 rgba(200,169,107,.12),0 -8px 28px rgba(155,115,45,.08)}
        @media(max-width:520px){.vera-gold-panel-price{align-items:stretch;flex-direction:column}.vera-gold-buy{text-align:center}}
        .vera-gold-cinematic{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(ellipse at 50% 48%,rgba(83,59,23,.24),transparent 42%),#050505;color:#f5edda;animation:vera-gold-screen-in .9s ease both}
        .vera-gold-cinematic:before{content:"";position:absolute;inset:-30%;background:radial-gradient(ellipse at center,rgba(200,169,107,.14),transparent 38%);animation:vera-gold-aura 4.8s ease-in-out both}
        .vera-gold-cinematic-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px}
        .vera-gold-cinematic-core{width:112px;height:112px;margin-bottom:30px;animation:vera-gold-core-arrive 2s cubic-bezier(.2,.8,.2,1) both}
        .vera-gold-cinematic-core .vera-core-visual{width:100%;height:100%}
        .vera-gold-cinematic-kicker{color:#d7bc7e;font-size:10px;font-weight:750;letter-spacing:.34em;text-transform:uppercase;opacity:0;animation:vera-gold-text-in .8s 1.7s ease forwards}
        .vera-gold-cinematic h2{margin:12px 0 8px;color:#f5edda;font-size:clamp(30px,7vw,54px);font-weight:500;letter-spacing:.12em;opacity:0;animation:vera-gold-text-in 1s 2s ease forwards}
        .vera-gold-cinematic p{max-width:330px;margin:0;color:#b8ad97;font-size:13px;line-height:1.7;opacity:0;animation:vera-gold-text-in 1s 2.35s ease forwards}
        .vera-gold-skip{position:absolute;z-index:3;right:20px;top:20px;border:1px solid rgba(200,169,107,.3);border-radius:8px;background:rgba(10,10,10,.72);color:#dfc78f;padding:9px 12px;font-size:11px;cursor:pointer}
        .vera-gold-sparks{position:absolute;inset:0;overflow:hidden;pointer-events:none}
        .vera-gold-sparks i{position:absolute;top:-12%;left:var(--x);width:2px;height:var(--h);border-radius:99px;background:linear-gradient(180deg,transparent,#f4d99a,transparent);opacity:0;filter:drop-shadow(0 0 5px rgba(238,204,132,.9));animation:vera-gold-fall var(--duration) var(--delay) linear both}
        .vera-gold-sparks i:nth-child(1){--x:8%;--h:26px;--duration:3.4s;--delay:.1s}.vera-gold-sparks i:nth-child(2){--x:17%;--h:17px;--duration:4s;--delay:.5s}.vera-gold-sparks i:nth-child(3){--x:28%;--h:32px;--duration:3.7s;--delay:.2s}.vera-gold-sparks i:nth-child(4){--x:39%;--h:20px;--duration:4.2s;--delay:.8s}.vera-gold-sparks i:nth-child(5){--x:51%;--h:28px;--duration:3.5s;--delay:.4s}.vera-gold-sparks i:nth-child(6){--x:62%;--h:18px;--duration:4.1s;--delay:.1s}.vera-gold-sparks i:nth-child(7){--x:73%;--h:30px;--duration:3.8s;--delay:.7s}.vera-gold-sparks i:nth-child(8){--x:84%;--h:22px;--duration:4.3s;--delay:.3s}.vera-gold-sparks i:nth-child(9){--x:94%;--h:27px;--duration:3.6s;--delay:.9s}
        @keyframes vera-gold-screen-in{from{opacity:0}to{opacity:1}}@keyframes vera-gold-aura{0%{transform:scale(.55);opacity:0}45%{opacity:1}100%{transform:scale(1.18);opacity:.75}}@keyframes vera-gold-core-arrive{0%{transform:scale(.18) rotate(-35deg);opacity:0;filter:brightness(2)}58%{transform:scale(1.12) rotate(8deg);opacity:1;filter:brightness(1.8)}100%{transform:scale(1) rotate(0);opacity:1;filter:brightness(1)}}@keyframes vera-gold-text-in{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes vera-gold-fall{0%{transform:translateY(0);opacity:0}12%{opacity:.9}85%{opacity:.65}100%{transform:translateY(120vh);opacity:0}}

        @media(max-width:650px){.vera-page{padding-top:2px}.vera-hero{padding:23px 17px 17px;border-radius:0}.vera-chat{border-radius:0}.vera-messages{min-height:220px;padding:16px 12px}.vera-bubble{max-width:92%}.vera-chat-head{padding:11px;align-items:flex-start}.vera-chat-head small{max-width:145px}.vera-head-actions{gap:5px;flex-wrap:wrap;justify-content:flex-end}.vera-history-toggle,.vera-new-chat{padding:8px}.vera-starters{grid-template-columns:1fr;padding:0 12px 16px;gap:8px}.vera-starter{min-height:50px}.vera-compose{padding:11px}.vera-period{max-width:112px}}
        @media(prefers-reduced-motion:reduce){.vera-gold-cinematic,.vera-gold-cinematic:before,.vera-gold-cinematic-core,.vera-gold-cinematic-kicker,.vera-gold-cinematic h2,.vera-gold-cinematic p,.vera-gold-sparks i{animation:none!important;opacity:1!important;transform:none!important}.vera-shell:before,.vera-shell:after,.vera-core-visual:before,.vera-core-visual:after,.vera-core-inner,.vera-core-depth,.vera-core-filament,.vera-core-glint,.vera-core-particle,.vera-mini-coin,.vera-dots i,.vera-mic.is-listening,.vera-tools-menu,.vera-gold-panel,.vera-bubble,.vera-thinking,.vera-drawer,.vera-welcome-phrase{animation:none!important}}
        .vera-page.gold-demo-unstable{animation:vera-demo-shake .2s ease-in-out 4}
        .vera-core-button .vera-core-3d.is-demo-unstable{animation:vera-demo-core-flicker .42s steps(2,end) 4;filter:drop-shadow(0 0 18px rgba(139,92,246,.52))}
        .vera-core-button .vera-core-3d.is-demo-gold canvas{filter:sepia(1) saturate(1.55) hue-rotate(350deg);transition:filter 1.6s ease}
        .vera-demo-focus{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;background:rgba(3,3,5,.97);animation:vera-demo-focus-in .7s ease both}
        .vera-demo-focus-core{width:118px;height:118px;filter:drop-shadow(0 0 18px rgba(200,169,107,.25))}
        .vera-demo-transform{position:fixed;z-index:1190;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(200,169,107,.09),transparent 56%);animation:vera-demo-transform-fade 2.9s ease both}
        .vera-demo-welcome{position:fixed;z-index:1210;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;pointer-events:none;text-align:center;color:#f2e8d0;animation:vera-demo-welcome-in 1.5s ease both}
        .vera-demo-welcome small{color:#d3b879;font-size:10px;letter-spacing:.28em;font-weight:700}
        .vera-demo-welcome h2{margin:12px 0 0;font-size:clamp(26px,6vw,42px);font-weight:500;letter-spacing:.02em}
        .vera-demo-continue{pointer-events:auto;padding:10px 17px;border:1px solid rgba(200,169,107,.4);border-radius:7px;background:rgba(10,10,10,.78);color:#e8d7ae;font-size:12px}
        @keyframes vera-demo-focus-in{from{opacity:0}to{opacity:1}}
        @keyframes vera-demo-transform-fade{0%{opacity:1}100%{opacity:0}}
        @keyframes vera-demo-welcome-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){.vera-page.gold-demo-unstable,.vera-core-button .vera-core-3d,.vera-demo-focus,.vera-demo-transform,.vera-demo-welcome{animation:none!important}}
      `}</style>

      {goldDemoPhase === "focus" && <div className="vera-demo-focus" aria-hidden="true">
        <div className="vera-demo-focus-core"><VeraCore3D variant="gold" label="Núcleo dorado de VERA" /></div>
      </div>}
      {goldDemoPhase === "transform" && <div className="vera-demo-transform" aria-hidden="true" />}
      {goldDemoPhase === "complete" && <div className="vera-demo-welcome" role="dialog" aria-label="Bienvenido a FINANCE PLUS">
        <div><small>UNA NUEVA ETAPA</small><h2>Bienvenido a FINANCE PLUS</h2></div>
        <button className="vera-demo-continue" type="button" onClick={() => setGoldDemoPhase("dismissed")}>Continuar</button>
      </div>}

      {showGoldWelcome && isGold && <div className="vera-gold-cinematic" role="dialog" aria-modal="true" aria-label="Bienvenida a FINANCE PLUS" onClick={() => setShowGoldWelcome(false)}>
        <button className="vera-gold-skip" type="button" onClick={() => setShowGoldWelcome(false)}>Omitir animación</button>
        <div className="vera-gold-sparks" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
        <div className="vera-gold-cinematic-content">
          <div className="vera-gold-cinematic-core"><span className="vera-core-visual is-gold" aria-hidden="true"><span className="vera-core-depth" /><span className="vera-core-inner" /><span className="vera-core-filament" /><span className="vera-core-glint" /><span className="vera-core-particle one" /><span className="vera-core-particle two" /></span></div>
          <div className="vera-gold-cinematic-kicker">Una nueva etapa</div>
          <h2>FINANCE PLUS</h2>
          <p>La misma VERA. Más profundidad para entender tu dinero y acompañar tus objetivos.</p>
        </div>
      </div>}

      {showHistory && <div className="vera-drawer-backdrop" onClick={() => setShowHistory(false)}>
        <aside className="vera-drawer" aria-label="Historial de conversaciones" onClick={(event) => event.stopPropagation()}>
          <div className="vera-drawer-top"><strong>Tu historial</strong><button className="vera-drawer-close" type="button" onClick={() => setShowHistory(false)} aria-label="Cerrar historial">×</button></div>
          <button className="vera-drawer-new" type="button" onClick={newConversation}>＋ Nueva conversación</button>
          <div className="vera-drawer-tabs">
            <button type="button" className={showArchived ? "vera-drawer-tab" : "vera-drawer-tab active"} onClick={() => setShowArchived(false)}>Recientes</button>
            <button type="button" className={showArchived ? "vera-drawer-tab active" : "vera-drawer-tab"} onClick={() => setShowArchived(true)}>Archivadas</button>
          </div>
          <label className="vera-filter-label" htmlFor="vera-period-filter">Período de análisis</label>
          <select id="vera-period-filter" className="vera-period vera-period-drawer" aria-label="Período de análisis" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {historyLoading ? <div className="vera-history-empty">Cargando conversaciones…</div> : visibleConversations.length === 0 ? <div className="vera-history-empty">{showArchived ? "Todavía no hay conversaciones archivadas." : "Tus conversaciones aparecerán acá cuando charles con VERA."}</div> : visibleConversations.map((conversation) => (
            <div className={`vera-history-item${conversationId === conversation.id ? " selected" : ""}`} key={conversation.id}>
              {editingConversationId === conversation.id ? (
                <form className="vera-history-edit" onSubmit={(event) => { event.preventDefault(); void renameConversation(conversation.id); }}>
                  <input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} maxLength={64} aria-label="Nuevo título de la conversación" autoFocus />
                  <button type="submit" disabled={!editingTitle.trim() || savingTitle}>Guardar</button>
                  <button type="button" onClick={() => { setEditingConversationId(null); setEditingTitle(""); }}>Cancelar</button>
                </form>
              ) : (
                <>
                  <button className="vera-history-open" type="button" onClick={() => void openConversation(conversation.id)}>
                    {conversation.title}<span className="vera-history-date">{new Date(conversation.last_message_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>
                  </button>
                  <div className="vera-history-actions">
                    <button className="vera-history-action" type="button" onClick={() => { setEditingConversationId(conversation.id); setEditingTitle(conversation.title); }}>Editar título</button>
                    <button className="vera-history-action" type="button" onClick={() => void changeArchive(conversation.id, showArchived ? "restore" : "archive")}>{showArchived ? "Restaurar" : "Archivar"}</button>
                    <button className="vera-history-action delete" type="button" onClick={() => void deleteConversation(conversation.id)}>Eliminar</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </aside>
      </div>}

      <section className={`vera-shell${sending ? " is-thinking" : ""}${isGold || ["transform", "complete", "dismissed"].includes(goldDemoPhase) ? " is-gold" : ""}`} aria-label="Asistente financiera VERA">

        <section className="vera-chat" aria-label="Conversación con VERA">
          <div className="vera-gold-entry">
            {isGold ? <span className="vera-gold-status" aria-label="Plan FINANCE PLUS activo">FINANCE PLUS</span> : <button className="vera-gold-trigger" type="button" aria-expanded={showGoldPanel} aria-controls="vera-gold-panel" onClick={() => setShowGoldPanel((current) => !current)}>✦ Mejorar a FINANCE PLUS</button>}
          </div>
          {showGoldPanel && <section className="vera-gold-panel" id="vera-gold-panel" aria-label="Comparación de planes VERA">
            <div className="vera-gold-panel-head"><div><span className="vera-gold-panel-mark">FINANCETRACK / VERA</span><h2>Elegí cómo querés usar VERA.</h2><p className="vera-gold-panel-intro">VERA sigue siendo útil en Free. FINANCE PLUS suma más capacidad y análisis más profundos.</p></div><button className="vera-gold-close" type="button" onClick={() => setShowGoldPanel(false)} aria-label="Cerrar comparación">×</button></div>
            <div className="vera-gold-compare-wrap"><table className="vera-gold-compare"><thead><tr><th>Beneficio</th><th>VERA</th><th>FINANCE PLUS</th></tr></thead><tbody>
              <tr><td>Consultas financieras habituales</td><td>✓</td><td>✓</td></tr>
              <tr><td>Resumen y análisis de gastos</td><td>✓</td><td>✓</td></tr>
              <tr><td>Más capacidad para conversar</td><td>—</td><td>✓</td></tr>
              <tr><td>Comparaciones y análisis profundos</td><td>Básico</td><td>✓</td></tr>
              <tr><td>Documentos y planificación avanzada</td><td>—</td><td>En preparación</td></tr>
            </tbody></table></div>
            <div className="vera-gold-panel-price"><div><strong>FINANCE PLUS desde USD 3,99/mes</strong><span>Plan anual propuesto: USD 39,99</span></div><a className="vera-gold-buy" href="/vera/gold">Ver precio y medios de pago <span aria-hidden="true">→</span></a></div>
            <p className="vera-gold-panel-note">Precios orientativos. La compra se habilitará cuando el cobro esté integrado y verificado.</p>
          </section>}
          <header className={`vera-chat-head${messages.length === 0 ? " is-welcome" : ""}`}>
            <div className="vera-brand">
              <button className="vera-core-button" type="button" aria-label="Ver estado de VERA" aria-controls="vera-core-panel" aria-expanded={showCorePanel} onClick={() => setShowCorePanel((current) => !current)}>
                <VeraCore3D variant={isGold || ["transform", "complete", "dismissed"].includes(goldDemoPhase) ? "gold" : "violet"} className={`${sending ? "is-thinking" : ""} ${goldDemoPhase === "unstable" ? "is-demo-unstable" : ""} ${goldDemoPhase === "nucleus-gold" || goldDemoPhase === "focus" ? "is-demo-gold" : ""}`} label="Núcleo 3D de VERA" />
              </button>
              {messages.length > 0 && <div className="vera-brand-copy"><strong>VERA</strong><small>Entendé tu dinero</small></div>}
            </div>
            <div className="vera-head-actions">
              <button className="vera-history-toggle" type="button" aria-label="Abrir historial y filtros" title="Historial y filtros" onClick={() => { setShowHistory(true); void loadHistory(); }}>☰</button>
              <button className="vera-new-chat" type="button" onClick={newConversation}>＋</button>
            </div>
          </header>
          {showCorePanel && <div className="vera-core-panel" id="vera-core-panel" role="status" aria-live="polite">
            <div><strong>{sending ? "VERA está procesando" : "VERA está disponible"}</strong><p>{sending ? "Estoy analizando tu consulta." : "El núcleo acompaña visualmente la actividad de VERA."}</p></div>
            <button type="button" onClick={() => setShowCorePanel(false)}>Cerrar</button>
          </div>}
          {messages.length === 0 && <header className="vera-hero" aria-labelledby="vera-title">
            <div className="vera-eyebrow">Tu asistente financiera</div>
            <h1 id="vera-title">Hola, soy <span>VERA.</span></h1>
            <p className="vera-sub">Estoy acá para ayudarte a entender tu dinero, descubrir oportunidades y tomar decisiones con más claridad.</p>
            <p className="vera-welcome-phrase" key={welcomePhrase}>{welcomePhrase}</p>
          </header>}
          <div className="vera-messages" aria-live="polite">
            {messages.length > 0 && messages.map((message, index) => <div className={`vera-bubble ${message.role === "user" ? "user" : "model"}`} key={index}>{message.role === "model" ? <>{renderModelContent(message.content)}{message.financialSummary && (() => { const summary = message.financialSummary; const comparison = getFinancialComparison(summary); return <div className="vera-financial-card" aria-label="Comparación de ingresos y gastos del período"><div className="vera-financial-card-head"><span className="vera-financial-card-title">Tu período en cifras</span><span className="vera-financial-card-period">{periodLabels[summary.period]}</span></div><div className="vera-financial-grid"><div className="vera-financial-metric"><span>Ingresos</span><strong>{formatFinancialAmount(summary.income, summary.currency)}</strong></div><div className="vera-financial-metric"><span>Gastos</span><strong>{formatFinancialAmount(summary.expenses, summary.currency)}</strong></div><div className="vera-financial-metric net"><span>Balance neto</span><strong>{formatFinancialAmount(summary.netBalance, summary.currency)}</strong></div></div><div className="vera-financial-comparison"><div className="vera-financial-comparison-head"><strong>Ingresos vs. gastos</strong><span>{comparison.expenseRatio === null ? "Sin ingresos para comparar" : `${comparison.expenseRatio.toLocaleString("es-AR",{maximumFractionDigits:1})}% de los ingresos`}</span></div><div className="vera-financial-bar-row"><span className="vera-financial-bar-label">Ingresos</span><div className="vera-financial-track"><div className="vera-financial-fill income" style={{width:`${comparison.incomeWidth}%`}} /></div></div><div className="vera-financial-bar-row"><span className="vera-financial-bar-label">Gastos</span><div className="vera-financial-track"><div className="vera-financial-fill expenses" style={{width:`${comparison.expensesWidth}%`}} /></div></div><div className="vera-financial-insight"><strong>{comparison.outcome}.</strong> {comparison.difference > 0 ? `${summary.netBalance > 0 ? "Quedaron" : "Faltaron"} ${formatFinancialAmount(comparison.difference,summary.currency)} en el período.` : "El total de ingresos y gastos fue el mismo."}</div></div><div className="vera-financial-foot">{summary.movementsCount} movimientos registrados · {summary.currency}</div></div>; })()}</> : message.content}</div>)}
            {sending && <div className="vera-thinking" role="status"><span className="vera-mini-coin" aria-hidden="true" /><span>VERA está pensando</span><span className="vera-dots" aria-hidden="true"><i /><i /><i /></span></div>}
          </div>
          {messages.length === 0 && <div className="vera-starters"><div className="vera-starters-label">Algunas ideas para empezar</div>{starters.map((starter) => <button className="vera-starter" key={starter} type="button" disabled={sending} onClick={() => void sendMessage(starter)}>{starter}</button>)}</div>}
          {error && <div className="vera-error" role="alert">{error}</div>}
          <div className="vera-compose">
            <input ref={attachmentRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" style={{ display: "none" }} onChange={async (event) => {
              const file = event.target.files?.[0]; event.target.value = "";
              if (!file || attachmentBusy) return;
              if (file.size > 4 * 1024 * 1024) { setError("El archivo debe pesar menos de 4 MB."); return; }
              setAttachmentBusy(true); setError("");
              try {
                const token = await getToken(); const form = new FormData(); form.append("file", file);
                const response = await fetch("/api/vera/documents/analyze", { method: "POST", headers: { Authorization: "Bearer " + token }, body: form });
                const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "No pude analizar el archivo.");
                const rows = (payload.transactions ?? []).slice(0, 20).map((item: { date: string; description: string; amount: number; currency: string; type: string; category: string }, index: number) => (index + 1) + ". " + item.date + " · " + item.description.slice(0, 70) + " · " + (item.type === "income" ? "Ingreso" : "Gasto") + " · " + item.amount + " " + item.currency + " · " + item.category).join("\n");
                await sendMessage("Analizá el documento " + file.name + ". Se detectaron " + (payload.summary?.count ?? 0) + " movimientos. No importes ni guardes nada. Revisá patrones e inconsistencias usando estos datos extraídos:\n" + rows);
              } catch (cause) { setError(cause instanceof Error ? cause.message : "No pude analizar el archivo."); }
              finally { setAttachmentBusy(false); }
            }} />
            <form onSubmit={handleSubmit}>
              <div className="vera-compose-tools">
                <button className="vera-tool-trigger" type="button" aria-label="Abrir herramientas" aria-expanded={showTools} onClick={() => setShowTools((current) => !current)} disabled={sending}>＋</button>
                {showTools && <div className="vera-tools-menu" role="group" aria-label="Herramientas rápidas">
                  <button className="vera-tools-close" type="button" aria-label="Cerrar herramientas" onClick={() => setShowTools(false)}>×</button>
                  <VeraIsotype className="vera-menu-isotype" /><strong className="vera-tools-title">Funciones disponibles</strong>
                  <section className="vera-tools-group">
                    <VeraIsotype className="vera-menu-isotype" /><span className="vera-tools-group-title">VERA FREE</span>
                    <button className="vera-tools-action" type="button" onClick={() => { setShowTools(false); void sendMessage("Analizá mis principales gastos del período seleccionado y explicame qué patrones encontrás."); }}><span className="vera-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 19V11M10 19V5M16 19v-7M22 19V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M2.5 21h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></span>Analizar mis gastos</button>
                    <button className="vera-tools-action" type="button" onClick={() => { setShowTools(false); void sendMessage("Ayudame a revisar mi progreso financiero en el período seleccionado."); }}><span className="vera-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 18.5 9 13l3.5 3.2L20 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M14.8 7H20v5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Revisar mi progreso</button>
                  </section>
                  <section className="vera-tools-group gold">
                    <VeraIsotype className="vera-menu-isotype" /><span className="vera-tools-group-title">FINANCE PLUS</span>
                    {isGold ? <>
                      <button className="vera-tools-action gold" type="button" title="Compara ingresos, gastos y categorías con el período anterior equivalente; muestra variaciones y tendencias respaldadas por tus movimientos." onClick={() => { setShowTools(false); void sendMessage("Analizá mis finanzas en profundidad comparando el período seleccionado con el anterior equivalente. Identificá los principales cambios en ingresos, gastos y categorías, explicá qué datos respaldan cada conclusión y señalá cualquier límite de la información disponible."); }}><span className="vera-tool-icon" aria-hidden="true">✦</span>Análisis comparativo avanzado</button>
                      <button className="vera-tools-action gold" type="button" onClick={() => { setShowTools(false); setGoldWorkspaceMode("actions"); }}><span className="vera-tool-icon" aria-hidden="true">◇</span>Simulador de acciones</button>
                      <button className="vera-tools-action gold" type="button" onClick={() => { setShowTools(false); setGoldWorkspaceMode("planning"); }}><span className="vera-tool-icon" aria-hidden="true">✧</span>Planificación personalizada</button>
                      <button className="vera-tools-action gold" type="button" onClick={() => { setShowTools(false); attachmentRef.current?.click(); }}><span className="vera-tool-icon" aria-hidden="true">▤</span>Elegir imagen o documento</button>
                    </> : <div className="vera-tools-locked">Análisis avanzado, simulaciones y documentos se habilitan con FINANCE PLUS.
                        {accountId && <button type="button" className="vera-tools-action gold" onClick={() => { void navigator.clipboard?.writeText(accountId); setError("ID de cuenta copiado. Enviámelo para habilitar FINANCE PLUS de prueba solo en Preview."); }}>Copiar ID para habilitar prueba FINANCE PLUS</button>}
                      </div>}
                  </section>
                  <label className="vera-tools-label" htmlFor="vera-compose-period">Período para el análisis</label>
                  <select id="vera-compose-period" className="vera-tools-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
                    {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>}
              </div>
              <textarea ref={composeRef} className="vera-input" rows={1} value={draft} onChange={(event) => handleDraftChange(event.target.value)} placeholder="Escribile a VERA…" aria-label="Mensaje para VERA" maxLength={3000} disabled={sending} />
              <button className={`vera-mic${listening ? " is-listening" : ""}`} type="button" onClick={toggleDictation} aria-label={listening ? "Detener dictado" : "Dictar mensaje"} aria-pressed={listening} disabled={sending}>{listening ? "◉" : "⌁"}</button>
              <button className={`vera-send${draft.trim() ? " ready" : ""}`} type="submit" aria-label="Enviar mensaje" disabled={sending || !draft.trim()}><span className="vera-send-arrow">↑</span></button>
            </form>
            {listening && <p className="vera-listening-label" role="status">Escuchando… hablá con claridad. Tocá el micrófono para terminar.</p>}
            <p className="vera-privacy">{attachmentBusy ? "VERA está analizando tu archivo…" : "VERA analiza los movimientos registrados en FINANCETRACK. No realiza operaciones ni modifica tus cuentas."}</p>
          </div>
        </section>
      </section>
      {goldWorkspaceMode && <VeraGoldWorkspace mode={goldWorkspaceMode} onClose={() => setGoldWorkspaceMode(null)} onSend={(text) => { setGoldWorkspaceMode(null); void sendMessage(text); }} />}
    </div>
  );
}
