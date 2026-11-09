'use strict';

/* ════════════════════════════════════════════════════════════════════════
   1. CONFIGURATION : adresse de l'API
   ────────────────────────────────────────────────────────────────────────
   - Page servie par Express (http://localhost:8086/)  → même origine.
   - Page ouverte avec Live Server (port 5500) ou en file:// → on appelle
     http://localhost:8086 : c'est un appel "cross-origin" autorisé par CORS.
   L'URL est modifiable dans l'en-tête (ex. passer par la Gateway plus tard).
   ════════════════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'sportbook.apiBase';
const TIMEOUT_MS = 8000;

function defaultApiBase() {
  const servedByApi = location.protocol.startsWith('http') && location.port !== '5500';
  return servedByApi ? location.origin : 'http://localhost:8086';
}
function readStoredApiBase() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
let API_BASE = readStoredApiBase() || defaultApiBase();

// Microservice Python (stats-service) : via la Gateway (8085) si on l'utilise,
// sinon directement sur son port 8088.
function statsBase() {
  try {
    const u = new URL(API_BASE);
    return u.port === '8085' ? API_BASE : `${u.protocol}//${u.hostname}:8088`;
  } catch { return 'http://localhost:8088'; }
}

/* ════════════════════════════════════════════════════════════════════════
   2. COUCHE D'ACCÈS À L'API : un seul endroit pour fetch() et les erreurs
   ════════════════════════════════════════════════════════════════════════ */

// Erreur HTTP "lisible" : status = 0 signifie "pas de réponse du serveur"
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = Array.isArray(details) ? details : [];
  }
}

const STATUS_TITLES = {
  400: 'Requête invalide',
  404: 'Ressource introuvable',
  409: 'Conflit',
  500: 'Erreur interne du serveur',
  503: 'Service indisponible',
};

/**
 * Appelle l'API REST et renvoie le JSON de la réponse.
 *   api('GET', '/api/teams')
 *   api('POST', '/api/teams', { name: 'Team Alpha' })
 * Lève une HttpError dans TOUS les cas d'échec :
 *   - serveur arrêté / réseau / CORS  → status 0
 *   - délai dépassé                   → status 0
 *   - 4xx / 5xx                       → message du serveur ({ message, details })
 */
async function api(method, path, body, base = API_BASE) {
  const isMainApi = base === API_BASE;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // fetch() ne rejette QUE si aucune réponse HTTP n'est reçue
    if (isMainApi) setConnection(false);
    if (err.name === 'AbortError') {
      throw new HttpError(0, `Le serveur ne répond pas (plus de ${TIMEOUT_MS / 1000} s).`);
    }
    throw new HttpError(0, `Impossible de joindre le serveur ${base}. Vérifiez qu'il est démarré (npm start) et que l'URL est correcte.`);
  } finally {
    clearTimeout(timer);
  }
  if (isMainApi) setConnection(true);

  // 204 No Content (ex. DELETE) : pas de corps à lire
  if (res.status === 204) return null;

  // On ne lit du JSON que si le serveur en annonce
  let data = null;
  if ((res.headers.get('Content-Type') || '').includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  }

  // fetch() NE rejette PAS sur 404 ou 500 : il faut tester res.ok nous-mêmes
  if (!res.ok) {
    const title = STATUS_TITLES[res.status] || `Erreur HTTP ${res.status}`;
    const serverMsg = data && data.message;
    let message = serverMsg && serverMsg !== title ? `${title} : ${serverMsg}` : title;
    if (res.status >= 500) message += ' Réessayez dans quelques instants.';
    throw new HttpError(res.status, message, data && data.details);
  }
  if (data === null) throw new HttpError(res.status, 'Réponse inattendue : le serveur n\'a pas renvoyé de JSON.');
  return data;
}

/* ════════════════════════════════════════════════════════════════════════
   3. AFFICHAGE DES MESSAGES ET OUTILS
   ════════════════════════════════════════════════════════════════════════ */
const $ = (sel, root = document) => root.querySelector(sel);

// Échappe le HTML : protège contre l'injection (XSS) des données affichées
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function notify(type, message, details = []) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <strong>${type === 'error' ? 'Erreur' : 'Succès'}</strong>
    <span>${esc(message)}</span>
    ${details.length ? `<ul>${details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    <button class="toast-close" aria-label="Fermer">×</button>`;
  toast.querySelector('.toast-close').onclick = () => toast.remove();
  $('#toasts').appendChild(toast);
  setTimeout(() => toast.remove(), type === 'error' ? 10000 : 4000);
}

function handleError(err) {
  if (err instanceof HttpError) notify('error', err.message, err.details);
  else { console.error(err); notify('error', `Erreur inattendue dans la page : ${err.message}`); }
}

// Exécute une action asynchrone : bouton désactivé pendant l'appel + gestion d'erreur
async function run(action, { button, success } = {}) {
  if (button) button.disabled = true;
  try {
    const result = await action();
    if (success) notify('success', success);
    return result;
  } catch (err) {
    handleError(err);
    return undefined;
  } finally {
    if (button) button.disabled = false;
  }
}

function setConnection(up) {
  const badge = $('#api-status');
  badge.className = `badge ${up ? 'badge-up' : 'badge-down'}`;
  badge.textContent = up ? 'Connecté' : 'Hors ligne';
}

const STATUS_LABELS = {
  PLANNED: 'Planifié', ONGOING: 'En cours', FINISHED: 'Terminé', SCHEDULED: 'Programmé',
};
const pill = (s) => `<span class="pill pill-${esc(s)}">${esc(STATUS_LABELS[s] || s)}</span>`;
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`;
const options = (items, label, placeholder) =>
  (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
  items.map((it) => `<option value="${it.id}">${esc(label(it))}</option>`).join('');

// Valeur d'un champ de formulaire : '' → null ; nombre si demandé
function field(form, name, { number = false } = {}) {
  const v = form.elements[name].value.trim();
  if (v === '') return null;
  return number ? Number(v) : v;
}

// Passe un formulaire en mode "création" ou "édition"
function setFormMode(form, editingId) {
  form.dataset.editingId = editingId ?? '';
  const title = form.querySelector('h2');
  title.textContent = editingId ? `${title.dataset.titleEdit} #${editingId}` : title.dataset.titleCreate;
  form.querySelector('[type=submit]').textContent = editingId ? 'Enregistrer' : 'Ajouter';
  form.querySelector('[data-action=cancel]').hidden = !editingId;
  form.classList.toggle('editing', Boolean(editingId));
}

/* ════════════════════════════════════════════════════════════════════════
   4. ÉTAT (données chargées depuis l'API)
   ════════════════════════════════════════════════════════════════════════ */
const state = { tournaments: [], teams: [], matches: [], selectedTournament: null };

/* ════════════════════════════════════════════════════════════════════════
   5. TOURNOIS
   ════════════════════════════════════════════════════════════════════════ */
const tournamentForm = $('#tournament-form');

async function loadTournaments() {
  state.tournaments = await api('GET', '/api/tournaments');
  renderTournaments();
  fillTournamentSelects();
}

function renderTournaments() {
  const rows = state.tournaments.map((t) => `
    <tr>
      <td class="muted">${t.id}</td>
      <td>${esc(t.name)}</td>
      <td class="muted">${esc(t.start_date || '?')} → ${esc(t.end_date || '?')}</td>
      <td>
        <select data-action="tournament-status" data-id="${t.id}" aria-label="Statut">
          ${['PLANNED', 'ONGOING', 'FINISHED'].map((s) =>
            `<option value="${s}" ${s === t.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </td>
      <td class="right">
        <button class="btn btn-ghost btn-sm" data-action="tournament-detail" data-id="${t.id}">Gérer</button>
        <button class="btn btn-ghost btn-sm" data-action="tournament-edit" data-id="${t.id}">Modifier</button>
        <button class="btn btn-danger btn-sm" data-action="tournament-delete" data-id="${t.id}">Supprimer</button>
      </td>
    </tr>`).join('');
  $('#tournament-rows').innerHTML = rows || emptyRow(5, 'Aucun tournoi pour le moment.');
}

tournamentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = tournamentForm.dataset.editingId;
  const body = {
    name: field(tournamentForm, 'name'),
    start_date: field(tournamentForm, 'start_date'),
    end_date: field(tournamentForm, 'end_date'),
    status: field(tournamentForm, 'status'),
  };
  run(async () => {
    if (id) await api('PUT', `/api/tournaments/${id}`, body);   // remplacement complet
    else await api('POST', '/api/tournaments', body);           // création
    tournamentForm.reset();
    setFormMode(tournamentForm, null);
    await loadTournaments();
  }, { button: e.submitter, success: id ? 'Tournoi modifié.' : 'Tournoi créé.' });
});

function editTournament(id) {
  const t = state.tournaments.find((x) => x.id === id);
  if (!t) return;
  const f = tournamentForm.elements;
  f.name.value = t.name;
  f.start_date.value = t.start_date || '';
  f.end_date.value = t.end_date || '';
  f.status.value = t.status;
  setFormMode(tournamentForm, id);
  f.name.focus();
}

async function changeTournamentStatus(select) {
  const id = select.dataset.id;
  // PATCH : on n'envoie QUE le champ modifié
  const ok = await run(() => api('PATCH', `/api/tournaments/${id}`, { status: select.value }),
    { success: 'Statut mis à jour.' });
  if (ok === undefined) await run(loadTournaments); // échec → on réaffiche la vraie valeur
}

async function deleteTournament(id, button) {
  if (!confirm(`Supprimer le tournoi #${id} ? Ses tours, matchs et inscriptions seront aussi supprimés.`)) return;
  await run(async () => {
    await api('DELETE', `/api/tournaments/${id}`);
    if (state.selectedTournament === id) closeDetail();
    await Promise.all([loadTournaments(), loadMatches()]);
  }, { button, success: 'Tournoi supprimé.' });
}

/* ── Détail : équipes inscrites + tours ── */
async function openDetail(id) {
  state.selectedTournament = id;
  const t = state.tournaments.find((x) => x.id === id);
  $('#detail-title').textContent = `${t ? t.name : 'Tournoi'} (#${id})`;
  $('#tournament-detail').hidden = false;
  await run(refreshDetail);
  $('#tournament-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDetail() {
  state.selectedTournament = null;
  $('#tournament-detail').hidden = true;
}

async function refreshDetail() {
  const id = state.selectedTournament;
  if (!id) return;
  const [registered, rounds] = await Promise.all([
    api('GET', `/api/tournaments/${id}/teams`),
    api('GET', `/api/tournaments/${id}/rounds`),
  ]);

  const registeredIds = new Set(registered.map((t) => t.id));
  const available = state.teams.filter((t) => !registeredIds.has(t.id));
  $('#register-form select').innerHTML = available.length
    ? options(available, (t) => t.name, 'Choisir une équipe…')
    : '<option value="">Aucune équipe disponible</option>';

  $('#registered-teams').innerHTML = registered.map((t) => `
    <li><span>${esc(t.name)} <span class="muted">· ${esc(t.registration_status)}</span></span>
      <button class="btn btn-danger btn-sm" data-action="unregister" data-id="${t.id}">Retirer</button></li>`).join('')
    || '<li class="muted">Aucune équipe inscrite.</li>';

  $('#rounds').innerHTML = rounds.map((r) =>
    `<li><span>${esc(r.round_order)}. ${esc(r.name)}</span><span class="muted">#${r.id}</span></li>`).join('')
    || '<li class="muted">Aucun tour. Ajoutez-en un pour pouvoir créer des matchs.</li>';
}

$('#register-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const team_id = field(e.target, 'team_id', { number: true });
  run(async () => {
    await api('POST', `/api/tournaments/${state.selectedTournament}/teams`, { team_id });
    await refreshDetail();
  }, { button: e.submitter, success: 'Équipe inscrite.' });
});

$('#round-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const body = { name: field(e.target, 'name'), round_order: field(e.target, 'round_order', { number: true }) };
  run(async () => {
    await api('POST', `/api/tournaments/${state.selectedTournament}/rounds`, body);
    e.target.reset();
    await refreshDetail();
  }, { button: e.submitter, success: 'Tour ajouté.' });
});

/* ════════════════════════════════════════════════════════════════════════
   6. ÉQUIPES
   ════════════════════════════════════════════════════════════════════════ */
const teamForm = $('#team-form');

async function loadTeams() {
  state.teams = await api('GET', '/api/teams');
  renderTeams();
  fillTeamSelects();
}

function renderTeams() {
  $('#team-rows').innerHTML = state.teams.map((t) => `
    <tr>
      <td class="muted">${t.id}</td>
      <td>${esc(t.name)}</td>
      <td>${esc(t.members)}</td>
      <td class="right">
        <button class="btn btn-ghost btn-sm" data-action="team-edit" data-id="${t.id}">Modifier</button>
        <button class="btn btn-danger btn-sm" data-action="team-delete" data-id="${t.id}">Supprimer</button>
      </td>
    </tr>`).join('') || emptyRow(4, 'Aucune équipe pour le moment.');
}

teamForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = teamForm.dataset.editingId;
  const body = { name: field(teamForm, 'name'), members: field(teamForm, 'members', { number: true }) };
  run(async () => {
    if (id) await api('PUT', `/api/teams/${id}`, body);
    else await api('POST', '/api/teams', body);
    teamForm.reset();
    setFormMode(teamForm, null);
    await loadTeams();
  }, { button: e.submitter, success: id ? 'Équipe modifiée.' : 'Équipe créée.' });
});

function editTeam(id) {
  const t = state.teams.find((x) => x.id === id);
  if (!t) return;
  teamForm.elements.name.value = t.name;
  teamForm.elements.members.value = t.members;
  setFormMode(teamForm, id);
  teamForm.elements.name.focus();
}

async function deleteTeam(id, button) {
  if (!confirm(`Supprimer l'équipe #${id} ?`)) return;
  // Si l'équipe joue un match, le serveur répond 409 → message affiché par run()
  await run(async () => {
    await api('DELETE', `/api/teams/${id}`);
    await loadTeams();
    if (state.selectedTournament) await refreshDetail();
  }, { button, success: 'Équipe supprimée.' });
}

/* ════════════════════════════════════════════════════════════════════════
   7. MATCHS
   ════════════════════════════════════════════════════════════════════════ */
const matchForm = $('#match-form');

async function loadMatches() {
  const filter = $('#match-filter').value;
  const query = filter ? `?tournament_id=${encodeURIComponent(filter)}` : '';
  state.matches = await api('GET', `/api/matches${query}`);
  renderMatches();
}

function renderMatches() {
  $('#match-rows').innerHTML = state.matches.map((m) => `
    <tr>
      <td class="muted">${m.id}</td>
      <td>${esc(m.team1_name)} <span class="muted">vs</span> ${esc(m.team2_name)}</td>
      <td>${esc(m.round_name)}</td>
      <td class="muted">${esc(m.date || '?')}</td>
      <td>${pill(m.status)}</td>
      <td>
        <form class="score-cell" data-action="score" data-id="${m.id}" novalidate>
          <input name="score" value="${esc(m.score || '')}" placeholder="3-1" aria-label="Score">
          <button class="btn btn-ghost btn-sm" type="submit">OK</button>
        </form>
      </td>
      <td class="right">
        <button class="btn btn-ghost btn-sm" data-action="match-edit" data-id="${m.id}">Modifier</button>
        <button class="btn btn-danger btn-sm" data-action="match-delete" data-id="${m.id}">Supprimer</button>
      </td>
    </tr>`).join('') || emptyRow(7, 'Aucun match.');
}

// Charge les tours du tournoi choisi dans le formulaire de match
async function loadRoundOptions(tournamentId, selectedRound) {
  const select = matchForm.elements.round_id;
  if (!tournamentId) {
    select.innerHTML = '<option value="">Choisissez d\'abord un tournoi</option>';
    return;
  }
  const rounds = await api('GET', `/api/tournaments/${tournamentId}/rounds`);
  select.innerHTML = rounds.length
    ? options(rounds, (r) => `${r.round_order}. ${r.name}`, 'Choisir un tour…')
    : '<option value="">Aucun tour : créez-en un dans l\'onglet Tournois</option>';
  if (selectedRound) select.value = String(selectedRound);
}

matchForm.elements.tournament_id.addEventListener('change', (e) => {
  run(() => loadRoundOptions(e.target.value));
});

matchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = matchForm.dataset.editingId;
  const existing = id ? state.matches.find((m) => String(m.id) === id) : null;
  const body = {
    round_id: field(matchForm, 'round_id', { number: true }),
    team1_id: field(matchForm, 'team1_id', { number: true }),
    team2_id: field(matchForm, 'team2_id', { number: true }),
    date: field(matchForm, 'date'),
    status: field(matchForm, 'status'),
    score: existing ? existing.score : null, // PUT remplace tout : on renvoie le score actuel
  };
  run(async () => {
    if (id) await api('PUT', `/api/matches/${id}`, body);
    else await api('POST', '/api/matches', body);
    resetMatchForm();
    await loadMatches();
  }, { button: e.submitter, success: id ? 'Match modifié.' : 'Match créé.' });
});

function resetMatchForm() {
  matchForm.reset();
  setFormMode(matchForm, null);
  loadRoundOptions(null);
}

async function editMatch(id) {
  const m = state.matches.find((x) => x.id === id);
  if (!m) return;
  const f = matchForm.elements;
  f.tournament_id.value = String(m.tournament_id);
  await run(() => loadRoundOptions(m.tournament_id, m.round_id));
  f.team1_id.value = String(m.team1_id);
  f.team2_id.value = String(m.team2_id);
  f.date.value = m.date || '';
  f.status.value = m.status;
  setFormMode(matchForm, id);
  matchForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveScore(form) {
  const score = field(form, 'score');
  // PATCH partiel sur la sous-ressource "score" ; le statut passe à FINISHED
  run(async () => {
    await api('PATCH', `/api/matches/${form.dataset.id}/score`, { score });
    await loadMatches();
  }, { button: form.querySelector('button'), success: 'Score enregistré.' });
}

async function deleteMatch(id, button) {
  if (!confirm(`Supprimer le match #${id} ?`)) return;
  await run(async () => {
    await api('DELETE', `/api/matches/${id}`);
    await loadMatches();
  }, { button, success: 'Match supprimé.' });
}

/* ════════════════════════════════════════════════════════════════════════
   7 bis. CLASSEMENT : appels au microservice Python stats-service
   ════════════════════════════════════════════════════════════════════════ */
const stats = (method, path, body) => api(method, path, body, statsBase());

async function loadRanking() {
  const params = new URLSearchParams({ order_by: $('#ranking-order').value });
  if ($('#ranking-filter').value) params.set('tournament_id', $('#ranking-filter').value);
  const data = await stats('GET', `/api/stats/ranking?${params}`);

  $('#stats-source').textContent = `${data.matches_counted} match(s) terminé(s) pris en compte · service Python sur ${statsBase()}`
    + (data.team_names_available ? '' : ' · noms indisponibles (service des tournois injoignable)');
  $('#ranking-rows').innerHTML = data.ranking.map((t) => `
    <tr>
      <td class="muted">${t.position}</td>
      <td>${esc(t.team_name || `Équipe #${t.team_id}`)}</td>
      <td class="elo">${t.elo.toFixed(0)}</td>
      <td>${t.played}</td><td>${t.wins}</td><td>${t.draws}</td><td>${t.losses}</td>
      <td>${t.goal_difference > 0 ? '+' : ''}${t.goal_difference}</td>
      <td><strong>${t.points}</strong></td>
      <td class="form-letters">${[...t.form].map((c) => `<span class="${c}">${c}</span>`).join('')}</td>
    </tr>`).join('') || emptyRow(10, "Aucun match terminé. Saisissez un score dans l'onglet Matchs.");
}

$('#predict-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const team1 = field(e.target, 'team1');
  const team2 = field(e.target, 'team2');
  run(async () => {
    const params = new URLSearchParams({ team1: team1 ?? '', team2: team2 ?? '' });
    const p = await stats('GET', `/api/stats/predict?${params}`);
    const p1 = Math.round(p.team1.win_probability * 100);
    const name = (side) => esc(side.team_name || `Équipe #${side.team_id}`);
    const box = $('#predict-result');
    box.innerHTML = `
      <div class="bar"><span class="b1" style="width:${p1}%">${p1} %</span><span class="b2" style="width:${100 - p1}%">${100 - p1} %</span></div>
      <div><strong>${name(p.team1)}</strong> (Elo ${p.team1.elo.toFixed(0)}) vs <strong>${name(p.team2)}</strong> (Elo ${p.team2.elo.toFixed(0)})</div>
      <div class="muted small">${p.favorite_team_id ? `Favori : ${p.favorite_team_id === p.team1.team_id ? name(p.team1) : name(p.team2)}` : 'Match équilibré'}. ${esc(p.explanation)}</div>`;
    box.hidden = false;
  }, { button: e.submitter });
});

/* ── Listes déroulantes partagées ── */
function fillTournamentSelects() {
  const filter = $('#match-filter');
  const current = filter.value;
  filter.innerHTML = options(state.tournaments, (t) => t.name, 'Tous les tournois');
  filter.value = state.tournaments.some((t) => String(t.id) === current) ? current : '';

  const rf = $('#ranking-filter');
  const rcur = rf.value;
  rf.innerHTML = options(state.tournaments, (t) => t.name, 'Tous les tournois');
  rf.value = state.tournaments.some((t) => String(t.id) === rcur) ? rcur : '';

  const sel = matchForm.elements.tournament_id;
  const cur = sel.value;
  sel.innerHTML = options(state.tournaments, (t) => t.name, 'Choisir un tournoi…');
  sel.value = state.tournaments.some((t) => String(t.id) === cur) ? cur : '';
}

function fillTeamSelects() {
  for (const name of ['team1', 'team2']) {
    const sel = $('#predict-form').elements[name];
    const cur = sel.value;
    sel.innerHTML = options(state.teams, (t) => t.name, 'Choisir…');
    sel.value = state.teams.some((t) => String(t.id) === cur) ? cur : '';
  }
  for (const name of ['team1_id', 'team2_id']) {
    const sel = matchForm.elements[name];
    const cur = sel.value;
    sel.innerHTML = options(state.teams, (t) => t.name, 'Choisir…');
    sel.value = state.teams.some((t) => String(t.id) === cur) ? cur : '';
  }
}

/* ════════════════════════════════════════════════════════════════════════
   8. ÉVÉNEMENTS (délégation : un seul écouteur pour tous les boutons)
   ════════════════════════════════════════════════════════════════════════ */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM' || el.tagName === 'SELECT') return;
  const id = Number(el.dataset.id);

  switch (el.dataset.action) {
    case 'reload-tournaments': run(loadTournaments, { button: el }); break;
    case 'reload-teams':       run(loadTeams, { button: el }); break;
    case 'reload-matches':     run(loadMatches, { button: el }); break;
    case 'tournament-edit':    editTournament(id); break;
    case 'tournament-delete':  deleteTournament(id, el); break;
    case 'tournament-detail':  openDetail(id); break;
    case 'close-detail':       closeDetail(); break;
    case 'team-edit':          editTeam(id); break;
    case 'team-delete':        deleteTeam(id, el); break;
    case 'match-edit':         editMatch(id); break;
    case 'match-delete':       deleteMatch(id, el); break;
    case 'stats-sync':
      run(async () => {
        const r = await stats('POST', '/api/stats/sync');
        await loadRanking();
        return r;
      }, { button: el, success: 'Résultats resynchronisés depuis le service des tournois (REST).' });
      break;
    case 'unregister':
      run(async () => {
        await api('DELETE', `/api/tournaments/${state.selectedTournament}/teams/${id}`);
        await refreshDetail();
      }, { button: el, success: 'Équipe retirée du tournoi.' });
      break;
    case 'cancel': {
      const form = el.closest('form');
      if (form === matchForm) resetMatchForm();
      else { form.reset(); setFormMode(form, null); }
      break;
    }
    default: break;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'tournament-status') changeTournamentStatus(e.target);
  if (e.target.id === 'match-filter') run(loadMatches);
  if (e.target.id === 'ranking-filter' || e.target.id === 'ranking-order') run(loadRanking);
});

document.addEventListener('submit', (e) => {
  if (e.target.dataset.action === 'score') { e.preventDefault(); saveScore(e.target); }
});

// Onglets
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== `panel-${tab.dataset.tab}`; });
    if (tab.dataset.tab === 'ranking') run(loadRanking); // chargé seulement à l'ouverture de l'onglet
  });
});

// Changement d'URL de l'API + test de connexion (GET /health)
$('#api-base').value = API_BASE;
$('#api-form').addEventListener('submit', (e) => {
  e.preventDefault();
  API_BASE = $('#api-base').value.trim().replace(/\/+$/, '');
  try { localStorage.setItem(STORAGE_KEY, API_BASE); } catch { /* stockage indisponible */ }
  run(async () => { await api('GET', '/health'); await loadAll(); },
    { button: e.submitter, success: `Connecté à ${API_BASE}` });
});

/* ════════════════════════════════════════════════════════════════════════
   9. DÉMARRAGE
   ════════════════════════════════════════════════════════════════════════ */
async function loadAll() {
  await Promise.all([loadTournaments(), loadTeams()]);
  await loadMatches();
}

loadRoundOptions(null);
run(loadAll);
