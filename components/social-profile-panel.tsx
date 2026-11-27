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
  { id: "avatar-11", emoji: "🦋", label: "Mariposa" }, { id: "avatar-12", emoji: "🐬", label: "Delfín" },
  { id: "avatar-13", emoji: "🐶", label: "Perro" }, { id: "avatar-14", emoji: "🐱", label: "Gato" },
  { id: "avatar-15", emoji: "🐭", label: "Ratón" }, { id: "avatar-16", emoji: "🐹", label: "Hámster" },
  { id: "avatar-17", emoji: "🫎", label: "Alce" }, { id: "avatar-18", emoji: "🦧", label: "Orangután" },
  { id: "avatar-19", emoji: "🦭", label: "Foca" }
];

const tierLabels = { bronze: "Bronce", silver: "Plata", gold: "Oro" };
const tierColors = { bronze: "#B77945", silver: "#9CA3AF", gold: "#D6A928" };

export default function SocialProfilePanel() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [friendAliases, setFriendAliases] = useState<Record<string, string>>({});
  const [editingAliasFor, setEditingAliasFor] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState("");
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
  const [activeTab, setActiveTab] = useState<"profile" | "friends">("profile");
  const [editing, setEditing] = useState(true);
  const [showAddFriend, setShowAddFriend] = useState(false);

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
    setEditing(!current);
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
    const { data: directoryPeople, error: directoryError } = otherIds.length
      ? await supabase.from("social_directory").select("user_id,username,display_name,avatar_id").in("user_id", otherIds)
      : { data: [], error: null };
    if (directoryError) { setError("No pudimos cargar los perfiles de tus contactos."); return; }

    const acceptedIds = [...new Set(rows.filter(row => row.status === "accepted").map(row => row.requester_id === id ? row.addressee_id : row.requester_id))];
    const { data: detailedProfiles, error: detailedProfilesError } = acceptedIds.length
      ? await supabase.from("social_profiles").select("user_id,username,display_name,avatar_id,bio").in("user_id", acceptedIds)
      : { data: [] as SocialProfile[], error: null };
    if (detailedProfilesError) { setError("No pudimos cargar los perfiles de tus amigos."); return; }

    const peopleMap = new Map(((directoryPeople ?? []) as Array<Omit<SocialProfile, "bio">>).map(person => [person.user_id, { ...person, bio: "" } as SocialProfile]));
    for (const person of (detailedProfiles ?? []) as SocialProfile[]) peopleMap.set(person.user_id, person);
    const acceptedFriends = rows.filter(row => row.status === "accepted").map(row => peopleMap.get(row.requester_id === id ? row.addressee_id : row.requester_id)).filter(Boolean) as SocialProfile[];
    setFriends(acceptedFriends);
    const { data: aliases, error: aliasesError } = await supabase.from("friend_aliases").select("friend_id,alias").eq("user_id", id);
    if (aliasesError) { setError("No pudimos cargar los nombres personalizados de tus amigos."); return; }
    setFriendAliases(Object.fromEntries((aliases ?? []).map((item: { friend_id: string; alias: string }) => [item.friend_id, item.alias])));
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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setBusy(false);
      setError("Tu sesión no está disponible. Volvé a iniciar sesión e intentá guardar de nuevo.");
      return;
    }
    const payload = { user_id: authData.user.id, username: username.trim().toLowerCase(), display_name: displayName.trim(), avatar_id: avatarId, bio: bio.trim(), updated_at: new Date().toISOString() };
    const { error: saveError } = await supabase.from("social_profiles").upsert(payload, { onConflict: "user_id" });
    setBusy(false);
    if (saveError) {
      console.error("No se pudo guardar el perfil social:", saveError);
      if (saveError.code === "23505") setError("Ese nombre de usuario ya está en uso.");
      else if (saveError.code === "23514") setError("El avatar o alguno de los datos no está habilitado. Actualizá la página y probá otra vez.");
      else if (saveError.code === "42501") setError("La base de datos rechazó el guardado por permisos. Revisá que tu sesión siga activa e intentá nuevamente.");
      else setError(`No pudimos guardar tu perfil (${saveError.code ?? "sin código"}): ${saveError.message}`);
      return;
    }
    setUserId(authData.user.id);
    setNotice("Perfil social actualizado."); setEditing(false); await load();
  }

  async function findUser() {
    setSearchResult(null); setError(""); setNotice("");
    const term = search.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(term)) { setError("Ingresá un nombre de usuario válido."); return; }
    const { data, error: searchError } = await supabase.from("social_directory")
      .select("user_id,username,display_name,avatar_id").eq("username", term).maybeSingle();
    if (searchError) { setError("No pudimos realizar la búsqueda."); return; }
    if (!data || data.user_id === userId) { setNotice("No encontramos otro perfil con ese usuario."); return; }
    setSearchResult({ ...data, bio: "" } as SocialProfile);
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

  async function saveFriendAlias(friendId: string) {
    const alias = aliasDraft.trim();
    if (!alias || alias.length > 32) { setError("El nombre personalizado debe tener entre 1 y 32 caracteres."); return; }
    setBusy(true); setError(""); setNotice("");
    const { error: aliasError } = await supabase.from("friend_aliases").upsert(
      { user_id: userId, friend_id: friendId, alias, updated_at: new Date().toISOString() },
      { onConflict: "user_id,friend_id" }
    );
    setBusy(false);
    if (aliasError) { setError("No pudimos guardar el nombre personalizado."); return; }
    setFriendAliases(current => ({ ...current, [friendId]: alias }));
    setEditingAliasFor(null); setAliasDraft(""); setNotice("Nombre personalizado guardado.");
  }

  async function clearFriendAlias(friendId: string) {
    setBusy(true); setError(""); setNotice("");
    const { error: aliasError } = await supabase.from("friend_aliases").delete().eq("user_id", userId).eq("friend_id", friendId);
    setBusy(false);
    if (aliasError) { setError("No pudimos quitar el nombre personalizado."); return; }
    setFriendAliases(current => { const next = { ...current }; delete next[friendId]; return next; });
    setEditingAliasFor(null); setAliasDraft(""); setNotice("Se restauró el nombre del perfil.");
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
    <div className="social-heading">
      <div><p className="social-eyebrow">FINANCE FRIENDS</p><h2 className="section-title">Tu perfil social</h2><p className="card-note">Conectá con amigos sin compartir tus movimientos ni tus saldos.</p></div>
      <div className="social-avatar-preview">{myAvatar}</div>
    </div>

    <div className="social-tabs" role="tablist" aria-label="Secciones sociales">
      <button type="button" className={activeTab === "profile" ? "active" : ""} onClick={() => { setActiveTab("profile"); setSelectedFriend(null); }}>Mi perfil</button>
      <button type="button" className={activeTab === "friends" ? "active" : ""} onClick={() => { setActiveTab("friends"); setSelectedFriend(null); }}>Amigos <span>{friends.length}</span></button>
    </div>

    {activeTab === "profile" && <>
      {profile && !editing ? <div className="social-profile-summary">
        <div><span className="social-summary-label">Nombre visible</span><strong>{profile.display_name}</strong></div>
        <div><span className="social-summary-label">Nombre de usuario</span><strong>@{profile.username}</strong></div>
        {profile.bio && <p>{profile.bio}</p>}
        <button type="button" className="social-secondary-button" onClick={() => setEditing(true)}>Editar perfil</button>
      </div> : <>
        <div className="social-profile-form">
          <div className="social-field"><label htmlFor="social-username">Nombre de usuario</label><div className="social-username-input"><span>@</span><input id="social-username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,20))} placeholder="tu_usuario" maxLength={20}/></div><small>Único · 3 a 20 caracteres. Compartilo para que puedan encontrarte.</small></div>
          <div className="social-field"><label htmlFor="social-display-name">Nombre visible</label><input id="social-display-name" value={displayName} onChange={e => setDisplayName(e.target.value.slice(0,32))} maxLength={32} placeholder="Cómo te van a ver tus amigos"/></div>
          <div className="social-field"><label htmlFor="social-bio">Presentación (opcional)</label><input id="social-bio" value={bio} onChange={e => setBio(e.target.value.slice(0,120))} maxLength={120} placeholder="Una breve descripción"/></div>
        </div>
        <div className="social-field"><label>Elegí tu avatar</label><div className="social-avatar-grid">{avatars.map(item => <button type="button" key={item.id} className={avatarId === item.id ? "social-avatar-option selected" : "social-avatar-option"} onClick={() => setAvatarId(item.id)} aria-label={item.label} aria-pressed={avatarId === item.id}><span>{item.emoji}</span><small>{item.label}</small></button>)}</div></div>
        <div className="social-edit-actions"><button type="button" className="primary-button social-save" onClick={saveProfile} disabled={busy || !userId}>{busy ? "Guardando..." : "Guardar perfil"}</button>{profile && <button type="button" className="social-text-button" onClick={() => { setEditing(false); setUsername(profile.username ?? ""); setDisplayName(profile.display_name); setBio(profile.bio); setAvatarId(profile.avatar_id); }}>Cancelar</button>}</div>
      </>}
      <div className="social-privacy-note"><strong>Tu privacidad está protegida.</strong> Ser amigos permite ver tu perfil social y tus logros. No habilita el acceso a cuentas, saldos, movimientos, ingresos ni gastos.</div>
    </>}

    {activeTab === "friends" && <>
      {selectedFriend ? <div className="social-friend-detail">
        <button type="button" className="social-text-button" onClick={() => setSelectedFriend(null)}>← Volver a amigos</button>
        <div className="social-friend-detail-head"><span className="social-person-avatar social-gold-avatar">{avatars.find(a => a.id === selectedFriend.avatar_id)?.emoji ?? "👤"}</span><div><strong>{friendAliases[selectedFriend.user_id] ?? selectedFriend.display_name}</strong><small>{friendAliases[selectedFriend.user_id] ? `${selectedFriend.display_name} · ` : ""}@{selectedFriend.username}</small></div></div>
        {selectedFriend.bio && <p>{selectedFriend.bio}</p>}
        <h4>Logros</h4>
        {friendAchievements.length === 0 ? <small>Este perfil todavía no tiene logros desbloqueados.</small> : <div className="social-achievements-grid">{friendAchievements.map(item => item.catalog && <article className="social-achievement" key={item.achievement_id}><span style={{ color: tierColors[item.catalog.tier] }}>✦</span><div><strong>{item.catalog.name}</strong><small>{item.catalog.description}</small><em>{tierLabels[item.catalog.tier]}</em></div></article>)}</div>}
      </div> : <>
        <div className="social-friends-actions"><h3 className="social-section-title">Tu comunidad</h3><button type="button" className="social-secondary-button" onClick={() => { setShowAddFriend(value => !value); setSearchResult(null); }}>{showAddFriend ? "Cerrar búsqueda" : "Agregar amigos"}</button></div>
        {showAddFriend && <><div className="social-search-row"><input aria-label="Buscar por nombre de usuario" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void findUser(); }} placeholder="Buscar por @usuario"/><button type="button" className="primary-button" onClick={findUser}>Buscar</button></div>
        {searchResult && <div className="social-person-row"><span className="social-person-avatar social-gold-avatar">{avatars.find(a => a.id === searchResult.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{searchResult.display_name}</strong><small>@{searchResult.username}</small></div><button type="button" className="social-secondary-button" onClick={sendRequest} disabled={busy}>Agregar</button></div>}</>}
        <div className="social-section-block"><h3 className="social-section-title">Solicitudes recibidas <span>{incoming.length}</span></h3>
          {incoming.length === 0 ? <p className="card-note">No tenés solicitudes pendientes.</p> : incoming.map(item => <div className="social-person-row" key={item.id}><span className="social-person-avatar social-gold-avatar">{avatars.find(a => a.id === item.profile?.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{item.profile?.display_name ?? "Usuario"}</strong><small>@{item.profile?.username ?? "sin_usuario"}</small></div><button className="social-secondary-button" onClick={() => acceptRequest(item.id)} disabled={busy}>Aceptar</button><button className="social-text-button" onClick={() => removeRequest(item.id)} disabled={busy}>Rechazar</button></div>)}
        </div>
        <div className="social-section-block"><h3 className="social-section-title">Solicitudes enviadas <span>{outgoing.length}</span></h3>
          {outgoing.length === 0 ? <p className="card-note">No tenés solicitudes enviadas.</p> : outgoing.map(item => <div className="social-person-row" key={item.id}><span className="social-person-avatar social-gold-avatar">{avatars.find(a => a.id === item.profile?.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{item.profile?.display_name ?? "Usuario"}</strong><small>@{item.profile?.username ?? "sin_usuario"} · Pendiente</small></div><button className="social-text-button" onClick={() => removeRequest(item.id)} disabled={busy}>Cancelar</button></div>)}
        </div>
        <div className="social-section-block"><h3 className="social-section-title">Mis amigos <span>{friends.length}</span></h3>
          {friends.length === 0 ? <p className="card-note">Cuando acepten tus solicitudes, van a aparecer acá.</p> : friends.map(friend => <div className="social-person-row" key={friend.user_id}><span className="social-person-avatar social-gold-avatar">{avatars.find(a => a.id === friend.avatar_id)?.emoji ?? "👤"}</span><div className="social-person-info"><strong>{friendAliases[friend.user_id] ?? friend.display_name}</strong><small>{friendAliases[friend.user_id] ? `${friend.display_name} · ` : ""}@{friend.username}</small></div><button className="social-text-button" onClick={() => { setEditingAliasFor(friend.user_id); setAliasDraft(friendAliases[friend.user_id] ?? friend.display_name); }}>Agendar</button><button className="social-text-button" onClick={() => void viewFriend(friend)}>Ver perfil</button><button className="social-text-button" onClick={() => void removeRequestFromFriend(friend.user_id)} disabled={busy}>Eliminar</button>{editingAliasFor === friend.user_id && <div className="social-alias-editor"><input aria-label="Nombre personalizado del amigo" value={aliasDraft} onChange={e => setAliasDraft(e.target.value.slice(0,32))} maxLength={32} placeholder="Ej. Mamá"/><button className="primary-button" onClick={() => void saveFriendAlias(friend.user_id)} disabled={busy}>Guardar</button>{friendAliases[friend.user_id] && <button className="social-text-button" onClick={() => void clearFriendAlias(friend.user_id)} disabled={busy}>Restaurar</button>}<button className="social-text-button" onClick={() => setEditingAliasFor(null)}>Cancelar</button></div>}</div>)}
        </div>
      </>}
    </>}

    {error && <p className="social-error" role="alert">{error}</p>}{notice && <p className="social-notice" role="status">{notice}</p>}
    {activeTab === "profile" && <><div className="social-divider"/><h3 className="social-section-title">Tus logros <span>{achievements.length}</span></h3>
      {achievements.length === 0 ? <p className="card-note">Tus medallas aparecerán cuando desbloquees logros por tu actividad en FINANCE.TRACK.</p> : <div className="social-achievements-grid">{achievements.map(item => item.catalog && <article className="social-achievement" key={item.achievement_id}><span style={{ color: tierColors[item.catalog.tier] }}>✦</span><div><strong>{item.catalog.name}</strong><small>{item.catalog.description}</small><em>{tierLabels[item.catalog.tier]}</em></div></article>)}</div>}
    </>}

    {consentAction && <div className="social-consent-backdrop" role="presentation"><div className="social-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="social-consent-title"><h3 id="social-consent-title">Antes de conectar</h3><p>Tu usuario, nombre visible y avatar pueden aparecer en búsquedas para personas con sesión iniciada. Al aceptar la amistad, ambos podrán ver también la presentación de perfil y los logros que desbloquees.</p><p><strong>No se comparten</strong> tus cuentas, saldos, movimientos, ingresos ni gastos. La amistad no concede acceso a tu información financiera.</p><div><button type="button" className="social-text-button" onClick={() => setConsentAction(null)}>Cancelar</button><button type="button" className="primary-button" disabled={busy} onClick={() => consentAction.type === "send" ? void confirmSendRequest() : consentAction.id ? void confirmAcceptRequest(consentAction.id) : undefined}>{consentAction.type === "send" ? "Enviar solicitud" : "Aceptar solicitud"}</button></div></div></div>}
  </section>;
}
