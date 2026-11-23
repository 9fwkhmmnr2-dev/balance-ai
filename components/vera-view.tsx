"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type ChatMessage = { role: "user" | "model"; content: string };
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

function renderInlineMarkdown(text: string) {
  return text.split(/(\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}
function renderModelContent(content: string) {
  const lines = content.split(/\\r?\\n/);
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const heading = line.match(/^#{1,3}\\s+(.+)$/);
    if (heading) { blocks.push(<h3 key={i}>{renderInlineMarkdown(heading[1])}</h3>); i++; continue; }
    if (/^[-*]\\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\\s*[-*]\\s+/.test(lines[i])) { items.push(lines[i].replace(/^\\s*[-*]\\s+/, "")); i++; }
      blocks.push(<ul key={i}>{items.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}</ul>);
      continue;
    }
    if (/^\\d+[.)]\\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\\s*\\d+[.)]\\s+/.test(lines[i])) { items.push(lines[i].replace(/^\\s*\\d+[.)]\\s+/, "")); i++; }
      blocks.push(<ol key={i}>{items.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}</ol>);
      continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^\\s*(#{1,3}\\s+|[-*]\\s+|\\d+[.)]\\s+)/.test(lines[i])) { paragraph.push(lines[i].trim()); i++; }
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
  const [showTools, setShowTools] = useState(false);
  const [listening, setListening] = useState(false);
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

  function toggleDictation() {
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
    } catch {
      setListening(false);
      setError("No pude iniciar el dictado. Probá nuevamente.");
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
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const accessToken = await getToken();
      const response = await fetch("/api/vera/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: nextMessages.slice(-11).filter((message, index) => index > 0 || message.role === "user"), period }),
      });
      const payload = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "No pude recibir una respuesta de VERA.");
      const completedMessages = [...nextMessages, { role: "model" as const, content: payload.reply }];
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
    <div className="vera-page">
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
        .vera-tools-label{display:block;margin:0 2px 6px;color:#a99dbb;font-size:10px}
        .vera-tools-period{width:100%;margin-bottom:9px;max-width:none;background:#171320;border:1px solid rgba(196,181,253,.2);border-radius:9px;padding:9px;color:#eee5ff;font-size:12px}
        .vera-tools-action{display:flex;align-items:center;gap:9px;width:100%;padding:10px 9px;border:1px solid transparent;border-radius:10px;background:transparent;color:#e8defa;text-align:left;font-size:12px;cursor:pointer;transition:background .18s,border-color .18s,transform .18s}
        .vera-tools-action:hover{background:rgba(124,58,237,.17);border-color:rgba(196,181,253,.16);transform:translateX(2px)}
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
        @media(max-width:650px){.vera-page{padding-top:2px}.vera-hero{padding:23px 17px 17px;border-radius:0}.vera-chat{border-radius:0}.vera-messages{min-height:220px;padding:16px 12px}.vera-bubble{max-width:92%}.vera-chat-head{padding:11px;align-items:flex-start}.vera-chat-head small{max-width:145px}.vera-head-actions{gap:5px;flex-wrap:wrap;justify-content:flex-end}.vera-history-toggle,.vera-new-chat{padding:8px}.vera-starters{grid-template-columns:1fr;padding:0 12px 16px;gap:8px}.vera-starter{min-height:50px}.vera-compose{padding:11px}.vera-period{max-width:112px}}
        @media(prefers-reduced-motion:reduce){.vera-shell:before,.vera-shell:after,.vera-core-visual:before,.vera-core-visual:after,.vera-core-inner,.vera-core-depth,.vera-core-filament,.vera-core-glint,.vera-core-particle,.vera-mini-coin,.vera-dots i,.vera-mic.is-listening,.vera-tools-menu,.vera-bubble,.vera-thinking,.vera-drawer,.vera-welcome-phrase{animation:none!important}}
      `}</style>

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
              <button className="vera-history-open" type="button" onClick={() => void openConversation(conversation.id)}>
                {conversation.title}<span className="vera-history-date">{new Date(conversation.last_message_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>
              </button>
              <div className="vera-history-actions">
                <button className="vera-history-action" type="button" onClick={() => void changeArchive(conversation.id, showArchived ? "restore" : "archive")}>{showArchived ? "Restaurar" : "Archivar"}</button>
                <button className="vera-history-action delete" type="button" onClick={() => void deleteConversation(conversation.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </aside>
      </div>}

      <section className={`vera-shell${sending ? " is-thinking" : ""}`} aria-label="Asistente financiera VERA">

        <section className="vera-chat" aria-label="Conversación con VERA">
          <header className={`vera-chat-head${messages.length === 0 ? " is-welcome" : ""}`}>
            <div className="vera-brand">
              <button className="vera-core-button" type="button" aria-label="Ver estado de VERA" aria-controls="vera-core-panel" aria-expanded={showCorePanel} onClick={() => setShowCorePanel((current) => !current)}>
                <span className={`vera-core-visual${sending ? " is-thinking" : ""}`} aria-hidden="true">
                  <span className="vera-core-depth" />
                  <span className="vera-core-inner" />
                  <span className="vera-core-filament" />
                  <span className="vera-core-glint" />
                  <span className="vera-core-particle one" />
                  <span className="vera-core-particle two" />
                </span>
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
            {messages.length > 0 && messages.map((message, index) => <div className={`vera-bubble ${message.role === "user" ? "user" : "model"}`} key={index}>{message.role === "model" ? renderModelContent(message.content) : message.content}</div>)}
            {sending && <div className="vera-thinking" role="status"><span className="vera-mini-coin" aria-hidden="true" /><span>VERA está pensando</span><span className="vera-dots" aria-hidden="true"><i /><i /><i /></span></div>}
          </div>
          {messages.length === 0 && <div className="vera-starters"><div className="vera-starters-label">Algunas ideas para empezar</div>{starters.map((starter) => <button className="vera-starter" key={starter} type="button" disabled={sending} onClick={() => void sendMessage(starter)}>{starter}</button>)}</div>}
          {error && <div className="vera-error" role="alert">{error}</div>}
          <div className="vera-compose">
            <form onSubmit={handleSubmit}>
              <div className="vera-compose-tools">
                <button className="vera-tool-trigger" type="button" aria-label="Abrir herramientas" aria-expanded={showTools} onClick={() => setShowTools((current) => !current)} disabled={sending}>＋</button>
                {showTools && <div className="vera-tools-menu" role="group" aria-label="Herramientas rápidas">
                  <strong className="vera-tools-title">Accesos rápidos</strong>
                  <label className="vera-tools-label" htmlFor="vera-compose-period">Período para el análisis</label>
                  <select id="vera-compose-period" className="vera-tools-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
                    {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button className="vera-tools-action" type="button" onClick={() => { setShowTools(false); void sendMessage("Analizá mis principales gastos del período seleccionado y explicame qué patrones encontrás."); }}><span className="vera-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 19V11M10 19V5M16 19v-7M22 19V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M2.5 21h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></span>Analizar mis gastos</button>
                  <button className="vera-tools-action" type="button" onClick={() => { setShowTools(false); void sendMessage("Ayudame a revisar mi progreso financiero en el período seleccionado."); }}><span className="vera-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 18.5 9 13l3.5 3.2L20 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M14.8 7H20v5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>Revisar mi progreso</button>
                </div>}
              </div>
              <textarea ref={composeRef} className="vera-input" rows={1} value={draft} onChange={(event) => handleDraftChange(event.target.value)} placeholder="Escribile a VERA…" aria-label="Mensaje para VERA" maxLength={3000} disabled={sending} />
              <button className={`vera-mic${listening ? " is-listening" : ""}`} type="button" onClick={toggleDictation} aria-label={listening ? "Detener dictado" : "Dictar mensaje"} aria-pressed={listening} disabled={sending}>{listening ? "◉" : "⌁"}</button>
              <button className={`vera-send${draft.trim() ? " ready" : ""}`} type="submit" aria-label="Enviar mensaje" disabled={sending || !draft.trim()}><span className="vera-send-arrow">↑</span></button>
            </form>
            {listening && <p className="vera-listening-label" role="status">Escuchando… hablá con claridad. Tocá el micrófono para terminar.</p>}
            <p className="vera-privacy">VERA analiza los movimientos registrados en FINANCETRACK. No realiza operaciones ni modifica tus cuentas.</p>
          </div>
        </section>
      </section>
    </div>
  );
}
