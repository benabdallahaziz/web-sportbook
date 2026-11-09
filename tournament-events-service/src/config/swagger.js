const path         = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');

const errorExample = (status, message, details) => ({
  'application/json': {
    schema: { $ref: details ? '#/components/schemas/ValidationError' : '#/components/schemas/Error' },
    example: details ? { status, message, details } : { status, message },
  },
});

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Tournament & Events Service',
      version: '1.1.0',
      description:
        'Microservice SportBook : gestion des tournois, équipes, tours et matchs.\n\n' +
        '**Port :** 8086 · **Nom Eureka :** tournament-events-service\n\n' +
        'Toutes les erreurs ont le format `{ status, message, details? }`.',
    },
    // URL relative : Swagger appelle le serveur qui l'a servi (pas de port en dur)
    servers: [{ url: '/', description: 'Ce service' }],
    tags: [
      { name: 'Tournaments', description: 'Tournois, inscriptions et tours' },
      { name: 'Teams',       description: 'Équipes' },
      { name: 'Matches',     description: 'Matchs et scores' },
    ],
    components: {
      parameters: {
        IdPath: {
          in: 'path', name: 'id', required: true,
          schema: { type: 'integer', minimum: 1 }, description: 'Identifiant numérique',
        },
      },
      responses: {
        NoContent:   { description: 'Supprimé, pas de corps de réponse' },
        BadRequest:  { description: 'Requête invalide (champ manquant, mauvais format, JSON mal formé, id non numérique)',
                       content: errorExample(400, 'Données invalides', ['"name" est obligatoire']) },
        NotFound:    { description: 'Ressource introuvable', content: errorExample(404, 'Tournoi 42 introuvable') },
        Conflict:    { description: 'Conflit avec l\'état actuel (doublon, ressource utilisée)',
                       content: errorExample(409, 'Cette équipe est déjà inscrite à ce tournoi') },
        ServerError: { description: 'Erreur interne du serveur', content: errorExample(500, 'Erreur interne du serveur') },
        Unavailable: { description: 'Base de données indisponible',
                       content: errorExample(503, 'Base de données indisponible. Réessayez plus tard.') },
      },
      schemas: {
        Tournament: {
          type: 'object',
          properties: {
            id:         { type: 'integer', example: 1 },
            name:       { type: 'string',  example: 'Tournoi Ramadan 2027' },
            start_date: { type: 'string',  format: 'date', nullable: true, example: '2027-03-01' },
            end_date:   { type: 'string',  format: 'date', nullable: true, example: '2027-03-15' },
            status:     { type: 'string',  enum: ['PLANNED', 'ONGOING', 'FINISHED'], example: 'PLANNED' },
          },
        },
        TournamentInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name:       { type: 'string', maxLength: 150, example: 'Tournoi Ramadan 2027' },
            start_date: { type: 'string', format: 'date', example: '2027-03-01' },
            end_date:   { type: 'string', format: 'date', example: '2027-03-15', description: '≥ start_date' },
            status:     { type: 'string', enum: ['PLANNED', 'ONGOING', 'FINISHED'], default: 'PLANNED' },
          },
        },
        TournamentPatch: {
          type: 'object',
          description: 'Au moins un champ',
          properties: {
            name:       { type: 'string', maxLength: 150 },
            start_date: { type: 'string', format: 'date' },
            end_date:   { type: 'string', format: 'date' },
            status:     { type: 'string', enum: ['PLANNED', 'ONGOING', 'FINISHED'] },
          },
          example: { status: 'ONGOING' },
        },
        Team: {
          type: 'object',
          properties: {
            id:      { type: 'integer', example: 1 },
            name:    { type: 'string',  example: 'Team Alpha' },
            members: { type: 'integer', example: 5 },
          },
        },
        TeamInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name:    { type: 'string',  maxLength: 100, example: 'Team Alpha' },
            members: { type: 'integer', minimum: 0, default: 0, example: 5 },
          },
        },
        TeamPatch: {
          type: 'object',
          properties: {
            name:    { type: 'string',  maxLength: 100 },
            members: { type: 'integer', minimum: 0 },
          },
          example: { members: 7 },
        },
        RegisteredTeam: {
          allOf: [
            { $ref: '#/components/schemas/Team' },
            {
              type: 'object',
              properties: {
                registration_date:   { type: 'string', format: 'date', example: '2026-11-09' },
                registration_status: { type: 'string', example: 'PENDING' },
              },
            },
          ],
        },
        RegisterInput: {
          type: 'object',
          required: ['team_id'],
          properties: { team_id: { type: 'integer', minimum: 1, example: 1 } },
        },
        Registration: {
          type: 'object',
          properties: {
            id:                { type: 'integer', example: 1 },
            tournament_id:     { type: 'integer', example: 1 },
            team_id:           { type: 'integer', example: 1 },
            registration_date: { type: 'string', format: 'date', example: '2026-11-09' },
            status:            { type: 'string', example: 'PENDING' },
          },
        },
        Round: {
          type: 'object',
          properties: {
            id:            { type: 'integer', example: 1 },
            name:          { type: 'string',  example: 'Finale' },
            round_order:   { type: 'integer', example: 3 },
            tournament_id: { type: 'integer', example: 1 },
          },
        },
        RoundInput: {
          type: 'object',
          required: ['name', 'round_order'],
          properties: {
            name:        { type: 'string',  maxLength: 100, example: 'Finale' },
            round_order: { type: 'integer', minimum: 1, example: 3 },
          },
        },
        Match: {
          type: 'object',
          properties: {
            id:            { type: 'integer', example: 1 },
            date:          { type: 'string',  format: 'date', nullable: true, example: '2027-03-10' },
            score:         { type: 'string',  nullable: true, example: '3-1' },
            status:        { type: 'string',  enum: ['SCHEDULED', 'ONGOING', 'FINISHED'], example: 'SCHEDULED' },
            round_id:      { type: 'integer', example: 1 },
            team1_id:      { type: 'integer', example: 1 },
            team2_id:      { type: 'integer', example: 2 },
            team1_name:    { type: 'string',  example: 'Team Alpha' },
            team2_name:    { type: 'string',  example: 'Team Beta' },
            round_name:    { type: 'string',  example: 'Finale' },
            tournament_id: { type: 'integer', example: 1 },
          },
        },
        MatchInput: {
          type: 'object',
          required: ['round_id', 'team1_id', 'team2_id'],
          properties: {
            date:     { type: 'string',  format: 'date', example: '2027-03-10' },
            score:    { type: 'string',  nullable: true, pattern: '^\\d+-\\d+$', example: null },
            status:   { type: 'string',  enum: ['SCHEDULED', 'ONGOING', 'FINISHED'], default: 'SCHEDULED' },
            round_id: { type: 'integer', minimum: 1, example: 1 },
            team1_id: { type: 'integer', minimum: 1, example: 1 },
            team2_id: { type: 'integer', minimum: 1, example: 2, description: 'Différent de team1_id' },
          },
        },
        MatchPatch: {
          type: 'object',
          properties: {
            date:     { type: 'string',  format: 'date' },
            score:    { type: 'string',  pattern: '^\\d+-\\d+$' },
            status:   { type: 'string',  enum: ['SCHEDULED', 'ONGOING', 'FINISHED'] },
            round_id: { type: 'integer', minimum: 1 },
            team1_id: { type: 'integer', minimum: 1 },
            team2_id: { type: 'integer', minimum: 1 },
          },
          example: { date: '2027-03-12', status: 'ONGOING' },
        },
        ScoreInput: {
          type: 'object',
          required: ['score'],
          properties: {
            score:  { type: 'string', pattern: '^\\d+-\\d+$', example: '3-1' },
            status: { type: 'string', enum: ['SCHEDULED', 'ONGOING', 'FINISHED'], default: 'FINISHED' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status:  { type: 'integer', example: 404 },
            message: { type: 'string',  example: 'Ressource introuvable' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            status:  { type: 'integer', example: 400 },
            message: { type: 'string',  example: 'Données invalides' },
            details: { type: 'array', items: { type: 'string' }, example: ['"name" est obligatoire'] },
          },
        },
      },
    },
  },
  // Chemin absolu (fonctionne quel que soit le dossier où l'on lance node).
  // Le glob exige des "/" : on convertit les "\" de Windows.
  apis: [path.join(__dirname, '..', 'routes', '*.js').replace(/\\/g, '/')],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Tournament & Events API',
    customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
  }));
  // Spécification brute (importable dans Postman : Import > Link)
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
}

module.exports = { setupSwagger, swaggerSpec };
