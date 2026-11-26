"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SocialProfile = { user_id: string; username: string | null; display_name: string; avatar_id: string; bio: string };
type Friendship = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted"; created_at: string };
type Achievement = { achievement_id: string; unlocked_at: string; catalog: { id: string; name: string; description: string; tier: "bronze" | "silver" | "gold" } | null };

const avatars = [
  { id: "avatar-01", emoji: "🦊", label: "Zorro" }, { id: "avatar-02", emoji: "🐼", label: "Panda" },
  { id: "avatar-03", emoji: "🐸", label: "Rana" }, { id: "avatar-04", emoji: "🦉", label: "Búho" },
  { id: "avatar-05", emoji: "🐯", label: "Tigre" }, { id: "avatar-06", emoji: "🐙", label: "Pulpo" },
  { id: "avatar-07", emoji: "🐧", label: "Pingüino" }, { id: "avatar-08", emoji: "🐻", label: "Oso" },
  { id: "avatar-09", emoji: "🦁", label: "León" }, { id: "avatar-10", emoji: "🐨", label: "Koala" },
  { id: "avatar-11", emoji: "🦋", label: "Mariposa" }, { id: "avatar-12", emoji: "🐬", label: "Delfín" }
];

const tierLabels = { bronze: "Bronce", silver: "Plata", gold: "Oro" };
const tierColors = { bronze: "#B77945", silver: "#9CA3AF", gold: "#D6A928" };

export default function SocialProfilePanel() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [incoming, setIncoming] = useState<(Friendship & { profile: SocialProfile | null })[]>([]);
  const [outgoing, setOutgoing] = useState<(Friendship & { profile: SocialProfile | null })[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<SocialProfile | null>(null);
  const [friendAchievements, setFriendAchievements] = useState<Achievement[]>([]);
  const [consentAction, setConsentAction] = useState<{ type: "send" | "accept"; id?: string } | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarId, setAvatarId] = useState("avatar-01");
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState<SocialProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setError("No pudimos verificar tu sesión."); return; }
    const id = authData.user.id;
    setUserId(id);

    const { data: own, error: ownError } = await supabase.from("social_profiles")
      .select("user_id,username,display_name,avatar_id,bio").eq("user_id", id).maybeSingle();
    if (ownError) { setError("No pudimos cargar tu perfil social."); return; }
    const current = own as SocialProfile | null;
    setProfile(current);
    setUsername(current?.username ?? "");
    setDisplayName(current?.display_name ?? "");
    setBio(current?.bio ?? "");
    setAvatarId(current?.avatar_id ?? "avatar-01");

    const { data: relations, error: relationsError } = await supabase.from("friendships")
      .select("id,requester_id,addressee_id,status,created_at")
      .or(`requester_id.eq.${id},addressee_id.eq.${id}`).order("created_at", { ascending: false });
    if (relationsError) { setError("No pudimos cargar tus amistades."); return; }
    const rows = (relations ?? []) as Friendship[];
    const otherIds = [...new Set(rows.map(row => row.requester_id === id ? row.addressee_id : row.requester_id))];
    const { data: people } = otherIds.length
      ? await supabase.from("social_profiles").select("user_id,username,display_name,avatar_id,bio").in("user_id", otherIds)
      : { data: [] as SocialProfile[] };
    const peopleMap = new Map(((people ?? []) as SocialProfile[]).map(person => [person.user_id, person]));
    setFriends(rows.filter(row => row.status === "accepted").map(row => peopleMap.get(row.requester_id === id ? row.addressee_id : row.requester_id)).filter(Boolean) as SocialProfile[]);
    setIncoming(rows.filter(row => row.status === "pending" && row.addressee_id === id).map(row => ({ ...row, profile: peopleMap.get(row.requester_id) ?? null })));
    setOutgoing(rows.filter(row => row.status === "pending" && row.requester_id === id).map(row => ({ ...row, profile: peopleMap.get(row.addressee_id) ?? null })));

    const { data: unlocked } = await supabase.from("user_achievements")
      .select("achievement_id,unlocked_at, catalog:achievement_catalog(id,name,description,tier)")
      .eq("user_id", id).order("unlocked_at", { ascending: false });
    setAchievements((unlocked ?? []) as unknown as Achievement[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveProfile() {
    if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) {
      setError("El usuario debe tener entre 3 y 20 caracteres: letras, números o guion bajo."); return;
    }
    if (!displayName.trim() || displayName.trim().length > 32 || bio.length > 120) {
      setError("Completá un nombre de hasta 32 caracteres y una bio de hasta 120."); return;
    }
    setBusy(true); setError(""); setNotice("");
    const payload = { user_id: userId, username: username.trim().toLowerCase(), display_name: displayName.trim(), avatar_id: avatarId, bio: bio.trim(), updated_at: new Date().toISOString() };
    const { error: saveError } = await supabase.from("social_profiles").upsert(payload, { onConflict: "user_id" });
    setBusy(false);
    if (saveError) { setError(saveError.code === "23505" ? "Ese nombre de usuario ya está en uso." : "No pudimos guardar tu perfil."); return; }
    setNotice("Perfil social actualizado."); await load();
  }

  async function findUser() {
    setSearchResult(null); setError(""); setNotice("");
    const term = search.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(term)) { setError("Ingresá un nombre de usuario válido."); return; }
    const { data, error: searchError } = await supabase.from("social_profiles")
      .select("user_id,username,display_name,avatar_id,bio").eq("username", term).maybeSingle();
    if (searchError) { setError("No pudimos realizar la búsqueda."); return; }
    if (!data || data.user_id === userId) { setNotice("No encontramos otro perfil con ese usuario."); return; }
    setSearchResult(data as SocialProfile);
  }

  async function sendRequest() {
    if (!searchResult) return;
    setConsentAction({ type: "send" });
  }

  async function confirmSendRequest() {
    if (!searchResult) return;
    setBusy(true); setError(""); setNotice("");
    const { error: requestError } = await supabase.from("friendships").insert({ requester_id: userId, addressee_id: searchResult.user_id, status: "pending" });
    setBusy(false);
    if (requestError) { setError(requestError.code === "23505" ? "Ya existe una solicitud o amistad con esa persona." : "No se pudo enviar la solicitud."); return; }
    setNotice("Solicitud enviada."); setSearchResult(null); setConsentAction(null); await load();
  }

  async function acceptRequest(id: string) {
    setConsentAction({ type: "accept", id });
  }

  async function confirmAcceptRequest(id: string) {
    setBusy(true);
    const { error: actionError } = await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id);
    setBusy(false);
    if (actionError) { setError("No pudimos aceptar la solicitud."); return; }
    setNotice("Ahora son amigos."); setConsentAction(null); await load();
  }

  async function removeRequestFromFriend(friendId: string) {
    const { data } = await supabase.from("friendships").select("id").or(`and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`).eq("status", "accepted").maybeSingle();
    if (data?.id) await removeRequest(data.id);
  }

  async function viewFriend(friend: SocialProfile) {
    setSelectedFriend(friend); setFriendAchievements([]);
    const { data } = await supabase.from("user_achievements").select("achievement_id,unlocked_at,catalog:achievement_catalog(id,name,description,tier)").eq("user_id", friend.user_id).order("unlocked_at", { ascending: false });
    setFriendAchievements((data ?? []) as unknown as Achievement[]);
  }

  async function removeRequest(id: string) {
    setBusy(true);
    const { error: actionError } = await supabase.from("friendships").delete().eq("id", id);
    setBusy(false);
    if (actionError) { setError("No pudimos eliminar la solicitud o amistad."); return; }
    setNotice("Solicitud o amistad eliminada."); await load();
  }

  const myAvatar = avatars.find(item => item.id === profile?.avatar_id)?.emoji ?? "👤";

  return <section className="card social-profile-panel" style={{ marginBottom: 20 }}>
    <div className="social-heading"><div><p className="social-eyebrow">FINANCE FRIENDS</p><h2 className="section-title">Tu perfil social</h2><p className="card-note">Conectá con amigos sin compartir tus movimientos ni tus saldos.</p></div><div className="social-avatar-preview">{myAvatar}</div></div>

    <div className="social-profile-form">
      <div className="social-field"><label htmlFor="social-username">Nombre de usuario</label><div className="social-username-input"><span>@</span><input id="social-username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,20))} placeholder="tu_usuario" maxLength={20}/></div><small>Único · 3 a 20 caracteres. Compartilo para que puedan encontrarte.</small></div>
      <div className="social-field"><label htmlFor="social-display-name">Nombre visible</label><input id="social-display-name" value={displayName} onChange={e => setDisplayName(e.target.value.slice(0,32))} maxLength={32} placeholder="Cómo te van a ver tus amigos"/></div>
      <div className="social-field"><label htmlFor="social-bio">Presentación (opcional)</label><input id="social-bio" value={bio} onChange={e => setBio(e.target.value.slice(0,120))} maxLength={120} placeholder="Una breve descripción"/></div>
    </div>

    <div className="social-field"><label>Elegí tu avatar</label><div className="social-avatar-grid">{avatars.map(item => <button type="button" key={item.id} className={avatarId === item.id ? "social-avatar-option selected" : "social-avatar-option"} onClick={() => setAvatarId(item.id)} aria-label={item.label} aria-pressed={avatarId === item.id}><span>{item.emoji}</span><small>{item.label}</small></button>)}</div></div>
    <button type="button" className="primary-button social-save" onClick={saveProfile} disabled={busy || !userId}>{busy ? "Guardando..." : "Guardar perfil social"}</button>

    <div className="social-privacy-note"><strong>Tu privacidad está protegida.</strong> Ser amigos permite ver tu perfil social y tus logros. No habilita el acceso a cuentas, movimientos, saldos, ingresos ni gastos.</div>
    {error && <p className="social-error" role="alert">{error}</p>}{notice && <p className="social-notice" role="status">{notice}</p>}

    <div className="social-divider"/>
    <h3 className="social-section-title">Encontrar amigos</h3>
    <div className="social-search-row"><input aria-label="Buscar por nombre de usuario" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void findUser(); }} placeholder="Buscar por @usuario"/><button type="button" className="primary-button" onClick={findUser}>Buscar</button></div>
    {searchResult && <div className="social-person-row"><span className="social-person-avatar">{avatars.find(a => a.id === searchResult.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{searchResult.display_name}</strong><small>@{searchResult.username}</small></div><button type="button" className="social-secondary-button" onClick={sendRequest} disabled={busy}>Agregar</button></div>}

    <div className="social-section-block"><h3 className="social-section-title">Solicitudes recibidas <span>{incoming.length}</span></h3>
      {incoming.length === 0 ? <p className="card-note">No tenés solicitudes pendientes.</p> : incoming.map(item => <div className="social-person-row" key={item.id}><span className="social-person-avatar">{avatars.find(a => a.id === item.profile?.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{item.profile?.display_name ?? "Usuario"}</strong><small>@{item.profile?.username ?? "sin_usuario"}</small></div><button className="social-secondary-button" onClick={() => acceptRequest(item.id)} disabled={busy}>Aceptar</button><button className="social-text-button" onClick={() => removeRequest(item.id)} disabled={busy}>Rechazar</button></div>)}
    </div>
    <div className="social-section-block"><h3 className="social-section-title">Solicitudes enviadas <span>{outgoing.length}</span></h3>
      {outgoing.length === 0 ? <p className="card-note">No tenés solicitudes enviadas.</p> : outgoing.map(item => <div className="social-person-row" key={item.id}><span className="social-person-avatar">{avatars.find(a => a.id === item.profile?.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{item.profile?.display_name ?? "Usuario"}</strong><small>@{item.profile?.username ?? "sin_usuario"} · Pendiente</small></div><button className="social-text-button" onClick={() => removeRequest(item.id)} disabled={busy}>Cancelar</button></div>)}
    </div>
    <div className="social-section-block"><h3 className="social-section-title">Mis amigos <span>{friends.length}</span></h3>
      {friends.length === 0 ? <p className="card-note">Cuando acepten tus solicitudes, van a aparecer acá.</p> : friends.map(friend => <div className="social-person-row" key={friend.user_id}><span className="social-person-avatar">{avatars.find(a => a.id === friend.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{friend.display_name}</strong><small>@{friend.username}</small></div><button className="social-text-button" onClick={() => void viewFriend(friend)}>Ver perfil</button><button className="social-text-button" onClick={() => void removeRequestFromFriend(friend.user_id)} disabled={busy}>Eliminar</button></div>)}
    </div>

    {consentAction && <div className="social-consent-backdrop" role="presentation"><div className="social-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="social-consent-title"><h3 id="social-consent-title">Antes de conectar</h3><p>Al enviar o aceptar esta solicitud, la otra persona podrá ver tu perfil social (nombre visible, usuario, avatar y presentación) y los logros que desbloquees.</p><p><strong>No se comparten</strong> tus cuentas, saldos, movimientos, ingresos ni gastos. La amistad no concede acceso a tu información financiera.</p><div><button type="button" className="social-text-button" onClick={() => setConsentAction(null)}>Cancelar</button><button type="button" className="primary-button" disabled={busy} onClick={() => consentAction.type === "send" ? void confirmSendRequest() : consentAction.id ? void confirmAcceptRequest(consentAction.id) : undefined}>{consentAction.type === "send" ? "Enviar solicitud" : "Aceptar solicitud"}</button></div></div></div>}

    <div className="social-divider"/>
    <h3 className="social-section-title">Tus logros <span>{achievements.length}</span></h3>
    {achievements.length === 0 ? <p className="card-note">Tus medallas aparecerán cuando desbloquees logros por tu actividad en FINANCE.TRACK.</p> : <div className="social-achievements-grid">{achievements.map(item => item.catalog && <article className="social-achievement" key={item.achievement_id}><span style={{ color: tierColors[item.catalog.tier] }}>✦</span><div><strong>{item.catalog.name}</strong><small>{item.catalog.description}</small><em>{tierLabels[item.catalog.tier]}</em></div></article>)}</div>}
  </section>;
}
