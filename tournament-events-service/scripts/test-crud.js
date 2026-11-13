/**
 * Script de test CRUD complet - Tournament & Events Service
 * Lance le serveur d'abord : npm start
 * Puis exécute : node scripts/test-crud.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8086';

let results = { passed: 0, failed: 0 };
let createdTournamentId, createdTeamId1, createdTeamId2, createdMatchId;

// ─── Utilitaires ─────────────────────────────────────────────────────────────

// Utilisateurs simulés (en-têtes transmis par le front, en attendant JWT)
const ADMIN = { 'X-User-Id': '1', 'X-User-Roles': 'ADMIN' };
const USER  = { 'X-User-Id': '9001', 'X-User-Roles': 'SPORTIF' };
const OTHER = { 'X-User-Id': '9002', 'X-User-Roles': 'SPORTIF' };

async function request(method, path, body = null, user = ADMIN) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...user }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    results.passed++;
  } else {
    console.log(`  ❌ ${label} ${detail ? '→ ' + detail : ''}`);
    results.failed++;
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  🏆  ${title}`);
  console.log('═'.repeat(55));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testHealth() {
  section('HEALTH CHECK');
  const { status, data } = await request('GET', '/health');
  ok('Serveur UP (200)',           status === 200);
  ok('Status = UP',                data.status === 'UP');
  ok('Service name correct',       data.service === 'tournament-events-service');
}

// ── TOURNAMENTS ──────────────────────────────────────────────────────────────

async function testTournamentCreate() {
  section('TOURNAMENTS — CREATE (POST)');
  const { status, data } = await request('POST', '/api/tournaments', {
    name: 'Tournoi Test SportBook 2027',
    start_date: '2027-04-01',
    end_date: '2027-04-15',
    status: 'PLANNED'
  });
  ok('Status 201 Created',         status === 201);
  ok('ID retourné',                !!data.id);
  ok('Nom correct',                data.name === 'Tournoi Test SportBook 2027');
  ok('Status = PLANNED',           data.status === 'PLANNED');
  createdTournamentId = data.id;

  // Test champ obligatoire manquant
  const { status: s2 } = await request('POST', '/api/tournaments', {});
  ok('400 si name manquant',       s2 === 400);
}

async function testTournamentGetAll() {
  section('TOURNAMENTS — GET ALL (GET)');
  const { status, data } = await request('GET', '/api/tournaments');
  ok('Status 200',                 status === 200);
  ok('Retourne un tableau',        Array.isArray(data));
  ok('Au moins 1 tournoi',         data.length >= 1);
}

async function testTournamentGetById() {
  section('TOURNAMENTS — GET BY ID (GET)');
  const { status, data } = await request('GET', `/api/tournaments/${createdTournamentId}`);
  ok('Status 200',                 status === 200);
  ok('ID correspond',              data.id === createdTournamentId);
  ok('Nom correct',                data.name === 'Tournoi Test SportBook 2027');

  // ID inexistant
  const { status: s2 } = await request('GET', '/api/tournaments/999999');
  ok('404 si ID inexistant',       s2 === 404);
}

async function testTournamentUpdate() {
  section('TOURNAMENTS — UPDATE (PUT)');
  const { status } = await request('PUT', `/api/tournaments/${createdTournamentId}`, {
    name: 'Tournoi Test SportBook 2027 (modifié)',
    start_date: '2027-04-05',
    end_date: '2027-04-20',
    status: 'ONGOING'
  });
  ok('Status 200',                 status === 200);

  // Vérification en base
  const { data } = await request('GET', `/api/tournaments/${createdTournamentId}`);
  ok('Nom bien mis à jour',        data.name === 'Tournoi Test SportBook 2027 (modifié)');
  ok('Status bien mis à jour',     data.status === 'ONGOING');

  // ID inexistant
  const { status: s2 } = await request('PUT', '/api/tournaments/999999', { name: 'X', status: 'PLANNED' });
  ok('404 si ID inexistant',       s2 === 404);
}

// ── TEAMS ─────────────────────────────────────────────────────────────────────

async function testTeamCreate() {
  section('TEAMS — CREATE (POST)');
  const { status: s1, data: d1 } = await request('POST', '/api/teams', { name: 'Team Alpha', members: 5 });
  ok('Status 201 (Team Alpha)',     s1 === 201);
  ok('ID retourné',                !!d1.id);
  ok('Nom correct',                d1.name === 'Team Alpha');
  createdTeamId1 = d1.id;

  const { status: s2, data: d2 } = await request('POST', '/api/teams', { name: 'Team Beta', members: 6 });
  ok('Status 201 (Team Beta)',      s2 === 201);
  createdTeamId2 = d2.id;

  // Champ obligatoire manquant
  const { status: s3 } = await request('POST', '/api/teams', {});
  ok('400 si name manquant',       s3 === 400);
}

async function testTeamGetAll() {
  section('TEAMS — GET ALL (GET)');
  const { status, data } = await request('GET', '/api/teams');
  ok('Status 200',                 status === 200);
  ok('Retourne un tableau',        Array.isArray(data));
  ok('Au moins 2 équipes',         data.length >= 2);
}

async function testTeamGetById() {
  section('TEAMS — GET BY ID (GET)');
  const { status, data } = await request('GET', `/api/teams/${createdTeamId1}`);
  ok('Status 200',                 status === 200);
  ok('Nom correct',                data.name === 'Team Alpha');

  const { status: s2 } = await request('GET', '/api/teams/999999');
  ok('404 si ID inexistant',       s2 === 404);
}

async function testTeamUpdate() {
  section('TEAMS — UPDATE (PUT)');
  const { status } = await request('PUT', `/api/teams/${createdTeamId1}`, { name: 'Team Alpha Pro', members: 8 });
  ok('Status 200',                 status === 200);

  const { data } = await request('GET', `/api/teams/${createdTeamId1}`);
  ok('Nom bien mis à jour',        data.name === 'Team Alpha Pro');
  ok('Members bien mis à jour',    data.members === 8);
}

// ── REGISTRATION ──────────────────────────────────────────────────────────────

async function testRegistration() {
  section('INSCRIPTION — Équipe dans Tournoi');
  // Inscrire Team 1
  const { status: s1, data: d1 } = await request('POST', `/api/tournaments/${createdTournamentId}/teams`, { team_id: createdTeamId1 });
  ok('Status 201 (Team 1 inscrite)',  s1 === 201);
  ok('tournament_id correct',         parseInt(d1.tournament_id) === createdTournamentId);
  ok('team_id correct',               d1.team_id === createdTeamId1);

  // Inscrire Team 2
  const { status: s2 } = await request('POST', `/api/tournaments/${createdTournamentId}/teams`, { team_id: createdTeamId2 });
  ok('Status 201 (Team 2 inscrite)',  s2 === 201);

  // Double inscription (doit retourner 409)
  const { status: s3 } = await request('POST', `/api/tournaments/${createdTournamentId}/teams`, { team_id: createdTeamId1 });
  ok('409 si déjà inscrite',          s3 === 409);

  // Lister les équipes du tournoi
  const { status: s4, data: teams } = await request('GET', `/api/tournaments/${createdTournamentId}/teams`);
  ok('Status 200 (liste équipes)',     s4 === 200);
  ok('2 équipes inscrites',            teams.length === 2);
}

// ── MATCHES ───────────────────────────────────────────────────────────────────

async function testMatchCreate() {
  section('MATCHES — CREATE (POST)');

  // Créer un tour via l'API (sous-ressource du tournoi)
  const { status: sr, data: round } = await request('POST', `/api/tournaments/${createdTournamentId}/rounds`, {
    name: 'Finale', round_order: 1
  });
  ok('Tour créé via API (201)', sr === 201 && !!round.id);
  const roundId = round.id;

  // Créer un match
  const { status, data } = await request('POST', '/api/matches', {
    date: '2027-04-15',
    score: null,
    status: 'SCHEDULED',
    round_id: roundId,
    team1_id: createdTeamId1,
    team2_id: createdTeamId2
  });
  ok('Status 201',                 status === 201);
  ok('ID retourné',                !!data.id);
  ok('Status = SCHEDULED',         data.status === 'SCHEDULED');
  createdMatchId = data.id;

  // Champs obligatoires manquants
  const { status: s2 } = await request('POST', '/api/matches', { date: '2027-04-15' });
  ok('400 si round/team manquants', s2 === 400);
}

async function testMatchGetAll() {
  section('MATCHES — GET ALL (GET)');
  const { status, data } = await request('GET', '/api/matches');
  ok('Status 200',                 status === 200);
  ok('Retourne un tableau',        Array.isArray(data));
  ok('Au moins 1 match',           data.length >= 1);
  ok('Contient team1_name',        data[0] && !!data[0].team1_name);
  ok('Contient team2_name',        data[0] && !!data[0].team2_name);
  ok('Contient round_name',        data[0] && !!data[0].round_name);
}

async function testMatchGetById() {
  section('MATCHES — GET BY ID (GET)');
  const { status, data } = await request('GET', `/api/matches/${createdMatchId}`);
  ok('Status 200',                 status === 200);
  ok('ID correspond',              data.id === createdMatchId);

  const { status: s2 } = await request('GET', '/api/matches/999999');
  ok('404 si ID inexistant',       s2 === 404);
}

async function testMatchUpdateScore() {
  section('MATCHES — UPDATE SCORE (PATCH)');
  const { status, data } = await request('PATCH', `/api/matches/${createdMatchId}/score`, {
    score: '3-1',
    status: 'FINISHED'
  });
  ok('Status 200',                 status === 200);
  ok('Score retourné',             data.score === '3-1');
  ok('Status = FINISHED',          data.status === 'FINISHED');

  // Vérification en base
  const { data: match } = await request('GET', `/api/matches/${createdMatchId}`);
  ok('Score en base = 3-1',        match.score === '3-1');
  ok('Status en base = FINISHED',  match.status === 'FINISHED');
}

// ── CIRCUIT DE VALIDATION ─────────────────────────────────────────────────────

async function testApprovalWorkflow() {
  section('VALIDATION — proposition utilisateur → décision admin');

  // 1. Un utilisateur propose un tournoi
  const { status, data: t } = await request('POST', '/api/tournaments',
    { name: 'Proposition utilisateur', start_date: '2027-06-01', end_date: '2027-06-05' }, USER);
  ok('201 : tournoi proposé',                       status === 201);
  ok('Statut de validation PENDING',                 t.approval_status === 'PENDING');
  ok('created_by = auteur',                          t.created_by === 9001);
  ok('Invisible pour un autre utilisateur (404)',    (await request('GET', `/api/tournaments/${t.id}`, null, OTHER)).status === 404);
  ok('Absent de la liste d’un autre utilisateur',    !(await request('GET', '/api/tournaments', null, OTHER)).data.some((x) => x.id === t.id));
  ok('Visible pour son auteur',                      (await request('GET', `/api/tournaments/${t.id}`, null, USER)).status === 200);
  ok('L’auteur peut modifier sa proposition',        (await request('PATCH', `/api/tournaments/${t.id}`, { name: 'Proposition modifiée' }, USER)).status === 200);
  ok('Inscriptions fermées tant que non validé (409)',
    (await request('POST', `/api/tournaments/${t.id}/teams`, { team_id: createdTeamId1 }, USER)).status === 409);

  // 2. L'organisateur planifie un tour et un match
  const round = await request('POST', `/api/tournaments/${t.id}/rounds`, { name: 'Finale', round_order: 1 }, USER);
  ok('L’organisateur ajoute un tour (201)',          round.status === 201);
  const m = await request('POST', '/api/matches', {
    round_id: round.data.id, team1_id: createdTeamId1, team2_id: createdTeamId2,
    date: '2027-06-02', score: '9-0', status: 'FINISHED',
  }, USER);
  ok('Match proposé (201, PENDING)',                 m.status === 201 && m.data.approval_status === 'PENDING');
  ok('Score/statut envoyés par l’utilisateur ignorés', m.data.score === null && m.data.status === 'SCHEDULED');
  ok('L’utilisateur ne saisit pas de score (403)',   (await request('PATCH', `/api/matches/${m.data.id}/score`, { score: '1-0' }, USER)).status === 403);
  ok('L’utilisateur ne se valide pas lui-même (403)', (await request('PATCH', `/api/tournaments/${t.id}/approval`, { decision: 'APPROVED' }, USER)).status === 403);
  ok('Match non validable avant son tournoi (409)',  (await request('PATCH', `/api/matches/${m.data.id}/approval`, { decision: 'APPROVED' })).status === 409);

  // 3. L'admin refuse, l'utilisateur corrige et re-soumet
  const rej = await request('PATCH', `/api/tournaments/${t.id}/approval`, { decision: 'REJECTED', reason: 'Dates à revoir' });
  ok('Admin refuse avec un motif',                   rej.data.approval_status === 'REJECTED' && rej.data.rejection_reason === 'Dates à revoir');
  const resub = await request('PATCH', `/api/tournaments/${t.id}`, { start_date: '2027-06-10', end_date: '2027-06-12' }, USER);
  ok('Correction par l’auteur → de nouveau PENDING',  resub.data.approval_status === 'PENDING' && resub.data.rejection_reason === null);

  // 4. L'admin valide : le tournoi devient public et figé pour l'auteur
  const appr = await request('PATCH', `/api/tournaments/${t.id}/approval`, { decision: 'APPROVED' });
  ok('Admin valide le tournoi',                      appr.data.approval_status === 'APPROVED');
  ok('Validé → l’auteur ne peut plus le modifier (403)', (await request('PATCH', `/api/tournaments/${t.id}`, { name: 'X' }, USER)).status === 403);
  ok('Visible par tous une fois validé',             (await request('GET', `/api/tournaments/${t.id}`, null, OTHER)).status === 200);
  ok('Admin valide le match',                        (await request('PATCH', `/api/matches/${m.data.id}/approval`, { decision: 'APPROVED' })).data.approval_status === 'APPROVED');
  ok('Admin saisit le score (200)',                  (await request('PATCH', `/api/matches/${m.data.id}/score`, { score: '2-1' })).status === 200);

  // 5. Équipes : chacun gère SES équipes
  const myTeam = (await request('POST', '/api/teams', { name: 'Équipe de l’utilisateur', members: 6 }, USER)).data;
  ok('L’utilisateur crée son équipe (propriétaire)', myTeam.created_by === 9001);
  ok('Il modifie son équipe (200)',                  (await request('PATCH', `/api/teams/${myTeam.id}`, { members: 7 }, USER)).status === 200);
  ok('Il ne modifie pas l’équipe d’un autre (403)',  (await request('PATCH', `/api/teams/${createdTeamId1}`, { members: 1 }, USER)).status === 403);
  ok('Un autre ne supprime pas son équipe (403)',    (await request('DELETE', `/api/teams/${myTeam.id}`, null, OTHER)).status === 403);
  ok('Il n’inscrit pas l’équipe d’un autre (403)',   (await request('POST', `/api/tournaments/${t.id}/teams`, { team_id: createdTeamId1 }, USER)).status === 403);

  // 6. Inscriptions : l'utilisateur inscrit SON équipe, l'admin confirme
  const reg = await request('POST', `/api/tournaments/${t.id}/teams`, { team_id: myTeam.id }, USER);
  ok('Inscription utilisateur → PENDING',            reg.status === 201 && reg.data.status === 'PENDING');
  ok('Un autre ne peut pas la retirer (403)',        (await request('DELETE', `/api/tournaments/${t.id}/teams/${myTeam.id}`, null, OTHER)).status === 403);
  const queue = await request('GET', '/api/tournaments/registrations?status=PENDING');
  ok('La file de l’admin contient l’inscription',     queue.data.some((r) => r.tournament_id === t.id && r.team_id === myTeam.id));
  ok('File interdite à un utilisateur (403)',        (await request('GET', '/api/tournaments/registrations', null, USER)).status === 403);
  ok('Admin confirme l’inscription',                 (await request('PATCH', `/api/tournaments/${t.id}/teams/${myTeam.id}`, { status: 'CONFIRMED' })).data.status === 'CONFIRMED');

  await request('DELETE', `/api/tournaments/${t.id}`);
  ok('Le propriétaire supprime son équipe (204)',    (await request('DELETE', `/api/teams/${myTeam.id}`, null, USER)).status === 204);
}

// ── SUPPRESSION (cleanup) ─────────────────────────────────────────────────────

async function testDelete() {
  section('DELETE — Nettoyage (DELETE)');

  const { status: sm } = await request('DELETE', `/api/matches/${createdMatchId}`);
  ok('Match supprimé (204)',         sm === 204);
  const { status: sm2 } = await request('GET', `/api/matches/${createdMatchId}`);
  ok('Match introuvable après delete (404)', sm2 === 404);

  const { status: st } = await request('DELETE', `/api/tournaments/${createdTournamentId}`);
  ok('Tournoi supprimé (204)',        st === 204);
  const { status: st2 } = await request('GET', `/api/tournaments/${createdTournamentId}`);
  ok('Tournoi introuvable après delete (404)', st2 === 404);

  const { status: sq1 } = await request('DELETE', `/api/teams/${createdTeamId1}`);
  ok('Team 1 supprimée (204)',        sq1 === 204);
  const { status: sq2 } = await request('DELETE', `/api/teams/${createdTeamId2}`);
  ok('Team 2 supprimée (204)',        sq2 === 204);
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function runAll() {
  console.log('\n🚀  Démarrage des tests CRUD — Tournament & Events Service');
  console.log(`📡  URL: ${BASE_URL}\n`);

  try {
    await testHealth();
    await testTournamentCreate();
    await testTournamentGetAll();
    await testTournamentGetById();
    await testTournamentUpdate();
    await testTeamCreate();
    await testTeamGetAll();
    await testTeamGetById();
    await testTeamUpdate();
    await testRegistration();
    await testMatchCreate();
    await testMatchGetAll();
    await testMatchGetById();
    await testMatchUpdateScore();
    await testApprovalWorkflow();
    await testDelete();
  } catch (err) {
    console.error('\n💥 Erreur inattendue:', err.message);
  }

  // Résumé final
  const total = results.passed + results.failed;
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  📊  RÉSULTATS FINAUX`);
  console.log('═'.repeat(55));
  console.log(`  Total  : ${total} tests`);
  console.log(`  ✅  Réussis : ${results.passed}`);
  console.log(`  ❌  Échoués : ${results.failed}`);
  console.log(`  Score  : ${Math.round((results.passed / total) * 100)}%`);
  console.log('═'.repeat(55));

  if (results.failed === 0) {
    console.log('\n  🎉  TOUS LES TESTS SONT PASSÉS ! Service prêt.\n');
  } else {
    console.log('\n  ⚠️   Certains tests ont échoué. Vérifie les logs ci-dessus.\n');
  }

  process.exit(results.failed === 0 ? 0 : 1);
}

runAll();

