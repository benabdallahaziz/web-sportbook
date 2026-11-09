/**
 * Génère postman/tournament-events.postman_collection.json
 * (format Postman v2.1, importable aussi dans Thunder Client).
 *
 *   node scripts/build-postman.js
 *
 * Les requêtes s'enchaînent : chaque POST mémorise l'id créé dans une
 * variable de collection ({{tournamentId}}, {{teamId}}…) réutilisée ensuite.
 */
const fs = require('fs');
const path = require('path');

// "{{teamId}}" → {{teamId}} : les ids sont envoyés comme nombres JSON, pas comme chaînes
const json = (obj) => ({
  mode: 'raw',
  raw: JSON.stringify(obj, null, 2).replace(/"(\{\{\w+\}\})"/g, '$1'),
  options: { raw: { language: 'json' } },
});

function req(name, method, url, { body, rawBody, status, checks = [], save, as } = {}) {
  const exec = [
    `pm.test("Status ${status}", () => pm.response.to.have.status(${status}));`,
  ];
  if (status !== 204) {
    exec.push('pm.test("Réponse JSON", () => pm.response.to.be.json);');
  } else {
    exec.push('pm.test("Pas de corps", () => pm.expect(pm.response.text()).to.eql(""));');
  }
  if (status >= 400) {
    exec.push('pm.test("Format d\'erreur { status, message }", () => {',
      '  const b = pm.response.json();',
      `  pm.expect(b.status).to.eql(${status});`,
      '  pm.expect(b.message).to.be.a("string");',
      '});');
  }
  exec.push(...checks);
  if (save) {
    exec.push(`if (pm.response.code === ${status}) pm.collectionVariables.set("${save}", pm.response.json().id);`);
  }

  // Utilisateur courant (en attendant JWT) : admin par défaut, ou "as" pour simuler un utilisateur
  const headers = [
    { key: 'Accept', value: 'application/json' },
    { key: 'X-User-Id', value: as ? String(as.id) : '{{userId}}' },
    { key: 'X-User-Roles', value: as ? as.roles : '{{userRoles}}' },
  ];
  let reqBody;
  if (body !== undefined || rawBody !== undefined) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
    reqBody = rawBody !== undefined ? { mode: 'raw', raw: rawBody } : json(body);
  }

  return {
    name,
    event: [{ listen: 'test', script: { type: 'text/javascript', exec } }],
    request: {
      method,
      header: headers,
      body: reqBody,
      url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.split('?')[0].split('/').filter(Boolean),
        ...(url.includes('?') ? { query: url.split('?')[1].split('&').map((q) => { const [key, value] = q.split('='); return { key, value }; }) } : {}) },
    },
  };
}

const folder = (name, item) => ({ name, item });
const USER = { id: 9001, roles: 'SPORTIF' };
const OTHER = { id: 9002, roles: 'SPORTIF' };

const collection = {
  info: {
    name: 'SportBook - Tournament & Events Service',
    description: 'Tests de tous les endpoints REST (cas nominaux + erreurs 400/404/409).\n' +
      'Lancer le dossier complet avec le Runner : les ids sont chaînés automatiquement.\n' +
      'baseUrl = http://localhost:8086 (direct) ou http://localhost:8085 (via API Gateway).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:8086' },
    { key: 'userId', value: '1' },
    { key: 'userRoles', value: 'ADMIN' },
    { key: 'proposalId', value: '' },
    { key: 'tournamentId', value: '' },
    { key: 'teamId', value: '' },
    { key: 'team2Id', value: '' },
    { key: 'roundId', value: '' },
    { key: 'matchId', value: '' },
  ],
  item: [
    folder('0. Santé', [
      req('Health check', 'GET', '/health', { status: 200,
        checks: ['pm.test("status = UP", () => pm.expect(pm.response.json().status).to.eql("UP"));'] }),
    ]),

    folder('1. Tournois', [
      req('Créer un tournoi', 'POST', '/api/tournaments', {
        status: 201, save: 'tournamentId',
        body: { name: 'Tournoi Postman 2027', start_date: '2027-04-01', end_date: '2027-04-15', status: 'PLANNED' },
        checks: [
          'pm.test("En-tête Location", () => pm.expect(pm.response.headers.get("Location")).to.match(/\\/api\\/tournaments\\/\\d+$/));',
          'pm.test("Ressource renvoyée", () => { const b = pm.response.json(); pm.expect(b.id).to.be.a("number"); pm.expect(b.start_date).to.eql("2027-04-01"); });',
        ],
      }),
      req('Lister les tournois', 'GET', '/api/tournaments', { status: 200,
        checks: ['pm.test("Tableau", () => pm.expect(pm.response.json()).to.be.an("array"));'] }),
      req('Obtenir un tournoi', 'GET', '/api/tournaments/{{tournamentId}}', { status: 200,
        checks: ['pm.test("Bon id", () => pm.expect(pm.response.json().id).to.eql(Number(pm.collectionVariables.get("tournamentId"))));'] }),
      req('Remplacer un tournoi (PUT)', 'PUT', '/api/tournaments/{{tournamentId}}', {
        status: 200,
        body: { name: 'Tournoi Postman 2027 (modifié)', start_date: '2027-04-05', end_date: '2027-04-20', status: 'PLANNED' },
        checks: ['pm.test("Nom modifié", () => pm.expect(pm.response.json().name).to.eql("Tournoi Postman 2027 (modifié)"));'],
      }),
      req('Modifier le statut (PATCH)', 'PATCH', '/api/tournaments/{{tournamentId}}', {
        status: 200, body: { status: 'ONGOING' },
        checks: ['pm.test("Statut ONGOING, nom conservé", () => { const b = pm.response.json(); pm.expect(b.status).to.eql("ONGOING"); pm.expect(b.name).to.include("modifié"); });'],
      }),
      req('Ajouter un tour', 'POST', '/api/tournaments/{{tournamentId}}/rounds', {
        status: 201, save: 'roundId', body: { name: 'Finale', round_order: 1 },
      }),
      req('Lister les tours', 'GET', '/api/tournaments/{{tournamentId}}/rounds', { status: 200,
        checks: ['pm.test("1 tour", () => pm.expect(pm.response.json()).to.have.lengthOf(1));'] }),
    ]),

    folder('2. Équipes', [
      req('Créer une équipe (A)', 'POST', '/api/teams', { status: 201, save: 'teamId', body: { name: 'Team Alpha', members: 5 } }),
      req('Créer une équipe (B)', 'POST', '/api/teams', { status: 201, save: 'team2Id', body: { name: 'Team Beta', members: 6 } }),
      req('Lister les équipes', 'GET', '/api/teams', { status: 200,
        checks: ['pm.test("Tableau", () => pm.expect(pm.response.json()).to.be.an("array"));'] }),
      req('Obtenir une équipe', 'GET', '/api/teams/{{teamId}}', { status: 200 }),
      req('Remplacer une équipe (PUT)', 'PUT', '/api/teams/{{teamId}}', { status: 200, body: { name: 'Team Alpha Pro', members: 8 },
        checks: ['pm.test("members = 8", () => pm.expect(pm.response.json().members).to.eql(8));'] }),
      req('Modifier les membres (PATCH)', 'PATCH', '/api/teams/{{teamId}}', { status: 200, body: { members: 9 },
        checks: ['pm.test("Nom conservé", () => pm.expect(pm.response.json().name).to.eql("Team Alpha Pro"));'] }),
    ]),

    folder('3. Inscriptions', [
      req('Inscrire équipe A', 'POST', '/api/tournaments/{{tournamentId}}/teams', { status: 201, body: { team_id: '{{teamId}}' } }),
      req('Inscrire équipe B', 'POST', '/api/tournaments/{{tournamentId}}/teams', { status: 201, body: { team_id: '{{team2Id}}' } }),
      req('Double inscription → 409', 'POST', '/api/tournaments/{{tournamentId}}/teams', { status: 409, body: { team_id: '{{teamId}}' } }),
      req('Équipes du tournoi', 'GET', '/api/tournaments/{{tournamentId}}/teams', { status: 200,
        checks: ['pm.test("2 équipes", () => pm.expect(pm.response.json()).to.have.lengthOf(2));'] }),
    ]),

    folder('4. Matchs', [
      req('Créer un match', 'POST', '/api/matches', {
        status: 201, save: 'matchId',
        body: { date: '2027-04-15', status: 'SCHEDULED', round_id: '{{roundId}}', team1_id: '{{teamId}}', team2_id: '{{team2Id}}' },
        checks: ['pm.test("Noms joints", () => pm.expect(pm.response.json().team1_name).to.eql("Team Alpha Pro"));'],
      }),
      req('Lister les matchs', 'GET', '/api/matches', { status: 200 }),
      req('Matchs d\'un tournoi (filtre)', 'GET', '/api/matches?tournament_id={{tournamentId}}', { status: 200,
        checks: ['pm.test("1 match", () => pm.expect(pm.response.json()).to.have.lengthOf(1));'] }),
      req('Obtenir un match', 'GET', '/api/matches/{{matchId}}', { status: 200 }),
      req('Remplacer un match (PUT)', 'PUT', '/api/matches/{{matchId}}', {
        status: 200,
        body: { date: '2027-04-16', status: 'ONGOING', score: null, round_id: '{{roundId}}', team1_id: '{{teamId}}', team2_id: '{{team2Id}}' },
      }),
      req('Modifier la date (PATCH)', 'PATCH', '/api/matches/{{matchId}}', { status: 200, body: { date: '2027-04-17' },
        checks: ['pm.test("Date modifiée", () => pm.expect(pm.response.json().date).to.eql("2027-04-17"));'] }),
      req('Saisir le score', 'PATCH', '/api/matches/{{matchId}}/score', { status: 200, body: { score: '3-1' },
        checks: ['pm.test("Score 3-1 et FINISHED", () => { const b = pm.response.json(); pm.expect(b.score).to.eql("3-1"); pm.expect(b.status).to.eql("FINISHED"); });'] }),
    ]),

    folder('5. Cas d\'erreur', [
      req('400 · tournoi sans nom', 'POST', '/api/tournaments', { status: 400, body: { start_date: '2027-01-01' },
        checks: ['pm.test("details[]", () => pm.expect(pm.response.json().details).to.be.an("array").that.is.not.empty);'] }),
      req('400 · date de fin avant début', 'POST', '/api/tournaments', { status: 400,
        body: { name: 'X', start_date: '2027-05-10', end_date: '2027-05-01' } }),
      req('400 · statut inconnu', 'PATCH', '/api/tournaments/{{tournamentId}}', { status: 400, body: { status: 'CANCELLED' } }),
      req('400 · PATCH vide', 'PATCH', '/api/teams/{{teamId}}', { status: 400, body: {} }),
      req('400 · JSON mal formé', 'POST', '/api/teams', { status: 400, rawBody: '{ "name": "Team", }' }),
      req('400 · id non numérique', 'GET', '/api/teams/abc', { status: 400 }),
      req('400 · même équipe deux fois', 'POST', '/api/matches', { status: 400,
        body: { round_id: '{{roundId}}', team1_id: '{{teamId}}', team2_id: '{{teamId}}' } }),
      req('400 · tour inexistant', 'POST', '/api/matches', { status: 400,
        body: { round_id: 999999, team1_id: '{{teamId}}', team2_id: '{{team2Id}}' } }),
      req('400 · score mal formé', 'PATCH', '/api/matches/{{matchId}}/score', { status: 400, body: { score: 'trois-un' } }),
      req('404 · tournoi inexistant', 'GET', '/api/tournaments/999999', { status: 404 }),
      req('404 · PUT équipe inexistante', 'PUT', '/api/teams/999999', { status: 404, body: { name: 'X' } }),
      req('404 · DELETE match inexistant', 'DELETE', '/api/matches/999999', { status: 404 }),
      req('404 · route inconnue', 'GET', '/api/inconnu', { status: 404 }),
      req('409 · supprimer une équipe qui joue un match', 'DELETE', '/api/teams/{{teamId}}', { status: 409 }),
    ]),

    folder('6. Validation (utilisateur → admin)', [
      req('Utilisateur : proposer un tournoi', 'POST', '/api/tournaments', {
        status: 201, save: 'proposalId', as: USER,
        body: { name: 'Proposition Postman', start_date: '2027-09-01', end_date: '2027-09-05' },
        checks: ['pm.test("PENDING", () => pm.expect(pm.response.json().approval_status).to.eql("PENDING"));'],
      }),
      req('Autre utilisateur : proposition invisible (404)', 'GET', '/api/tournaments/{{proposalId}}', { status: 404, as: OTHER }),
      req('Utilisateur : auto-validation interdite (403)', 'PATCH', '/api/tournaments/{{proposalId}}/approval', {
        status: 403, as: USER, body: { decision: 'APPROVED' },
      }),
      req('Admin : file des tournois en attente', 'GET', '/api/tournaments?approval=PENDING', { status: 200,
        checks: ['pm.test("contient la proposition", () => pm.expect(pm.response.json().some((t) => t.id === Number(pm.collectionVariables.get("proposalId")))).to.eql(true));'] }),
      req('Admin : refuser avec motif', 'PATCH', '/api/tournaments/{{proposalId}}/approval', {
        status: 200, body: { decision: 'REJECTED', reason: 'Dates à revoir' },
        checks: ['pm.test("REJECTED + motif", () => { const b = pm.response.json(); pm.expect(b.approval_status).to.eql("REJECTED"); pm.expect(b.rejection_reason).to.eql("Dates à revoir"); });'],
      }),
      req('Utilisateur : corriger → re-soumis', 'PATCH', '/api/tournaments/{{proposalId}}', {
        status: 200, as: USER, body: { end_date: '2027-09-06' },
        checks: ['pm.test("de nouveau PENDING", () => pm.expect(pm.response.json().approval_status).to.eql("PENDING"));'],
      }),
      req('Admin : valider', 'PATCH', '/api/tournaments/{{proposalId}}/approval', {
        status: 200, body: { decision: 'APPROVED' },
        checks: ['pm.test("APPROVED", () => pm.expect(pm.response.json().approval_status).to.eql("APPROVED"));'],
      }),
      req('Utilisateur : validé → plus modifiable (403)', 'PATCH', '/api/tournaments/{{proposalId}}', {
        status: 403, as: USER, body: { name: 'X' },
      }),
      req('Utilisateur : file des inscriptions interdite (403)', 'GET', '/api/tournaments/registrations', { status: 403, as: USER }),
      req('Admin : supprimer la proposition', 'DELETE', '/api/tournaments/{{proposalId}}', { status: 204 }),
    ]),

    folder('7. Suppressions (nettoyage)', [
      req('Supprimer le match', 'DELETE', '/api/matches/{{matchId}}', { status: 204 }),
      req('Match supprimé → 404', 'GET', '/api/matches/{{matchId}}', { status: 404 }),
      req('Désinscrire équipe B', 'DELETE', '/api/tournaments/{{tournamentId}}/teams/{{team2Id}}', { status: 204 }),
      req('Supprimer le tournoi', 'DELETE', '/api/tournaments/{{tournamentId}}', { status: 204 }),
      req('Supprimer équipe A', 'DELETE', '/api/teams/{{teamId}}', { status: 204 }),
      req('Supprimer équipe B', 'DELETE', '/api/teams/{{team2Id}}', { status: 204 }),
    ]),
  ],
};

const out = path.join(__dirname, '..', 'postman', 'tournament-events.postman_collection.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log(`✅ Collection générée : ${out}`);
