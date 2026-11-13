const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tournament.controller');

/**
 * @swagger
 * /api/tournaments:
 *   get:
 *     summary: Lister tous les tournois
 *     tags: [Tournaments]
 *     responses:
 *       200:
 *         description: Liste des tournois (tableau éventuellement vide)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Tournament' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *       503: { $ref: '#/components/responses/Unavailable' }
 *   post:
 *     summary: Créer un tournoi
 *     tags: [Tournaments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TournamentInput' }
 *     responses:
 *       201:
 *         description: Tournoi créé. L'en-tête Location contient son URL.
 *         headers:
 *           Location: { schema: { type: string }, example: /api/tournaments/7 }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tournament' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.route('/')
  .get(ctrl.getAll)
  .post(ctrl.create);

/**
 * @swagger
 * /api/tournaments/registrations:
 *   get:
 *     summary: "(Admin) File des inscriptions d'équipes à valider"
 *     tags: [Validation]
 *     parameters:
 *       - $ref: '#/components/parameters/UserRoles'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, REJECTED], default: PENDING }
 *     responses:
 *       200:
 *         description: Inscriptions avec le nom du tournoi et de l'équipe
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/PendingRegistration' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// Déclarée AVANT /:id, sinon "registrations" serait lu comme un id
router.get('/registrations', ctrl.listRegistrations);

/**
 * @swagger
 * /api/tournaments/{id}/approval:
 *   patch:
 *     summary: "(Admin) Valider ou refuser un tournoi proposé"
 *     tags: [Validation]
 *     parameters:
 *       - $ref: '#/components/parameters/IdPath'
 *       - $ref: '#/components/parameters/UserRoles'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ApprovalInput' }
 *     responses:
 *       200:
 *         description: Tournoi avec son nouveau statut de validation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tournament' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/approval', ctrl.decide);

/**
 * @swagger
 * /api/tournaments/{id}/teams/{teamId}:
 *   patch:
 *     summary: "(Admin) Confirmer ou refuser l'inscription d'une équipe"
 *     tags: [Validation]
 *     parameters:
 *       - $ref: '#/components/parameters/IdPath'
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - $ref: '#/components/parameters/UserRoles'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [CONFIRMED, REJECTED] }
 *     responses:
 *       200: { description: Inscription mise à jour }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/teams/:teamId', ctrl.decideRegistration);

/**
 * @swagger
 * /api/tournaments/{id}:
 *   parameters:
 *     - $ref: '#/components/parameters/IdPath'
 *   get:
 *     summary: Obtenir un tournoi par son ID
 *     tags: [Tournaments]
 *     responses:
 *       200:
 *         description: Tournoi trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tournament' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   put:
 *     summary: Remplacer complètement un tournoi
 *     description: Tous les champs sont renvoyés ; un champ optionnel absent est remis à null (ou à sa valeur par défaut).
 *     tags: [Tournaments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TournamentInput' }
 *     responses:
 *       200:
 *         description: Tournoi mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tournament' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   patch:
 *     summary: Modifier partiellement un tournoi
 *     description: Seuls les champs envoyés sont modifiés (ex. uniquement le statut).
 *     tags: [Tournaments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TournamentPatch' }
 *     responses:
 *       200:
 *         description: Tournoi mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tournament' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   delete:
 *     summary: Supprimer un tournoi (et ses tours, matchs et inscriptions)
 *     tags: [Tournaments]
 *     responses:
 *       204: { $ref: '#/components/responses/NoContent' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.route('/:id')
  .get(ctrl.getById)
  .put(ctrl.replace)
  .patch(ctrl.patch)
  .delete(ctrl.remove);

/**
 * @swagger
 * /api/tournaments/{id}/teams:
 *   parameters:
 *     - $ref: '#/components/parameters/IdPath'
 *   get:
 *     summary: Lister les équipes inscrites à un tournoi
 *     tags: [Tournaments]
 *     responses:
 *       200:
 *         description: Équipes inscrites avec leur statut d'inscription
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/RegisteredTeam' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   post:
 *     summary: Inscrire une équipe au tournoi
 *     tags: [Tournaments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201:
 *         description: Équipe inscrite
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Registration' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.route('/:id/teams')
  .get(ctrl.getTournamentTeams)
  .post(ctrl.registerTeam);

/**
 * @swagger
 * /api/tournaments/{id}/teams/{teamId}:
 *   delete:
 *     summary: Désinscrire une équipe du tournoi
 *     tags: [Tournaments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdPath'
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       204: { $ref: '#/components/responses/NoContent' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.delete('/:id/teams/:teamId', ctrl.unregisterTeam);

/**
 * @swagger
 * /api/tournaments/{id}/register:
 *   post:
 *     deprecated: true
 *     summary: "(Ancienne URL) Inscrire une équipe : utiliser POST /api/tournaments/{id}/teams"
 *     tags: [Tournaments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201: { description: Équipe inscrite }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
// Ancienne URL (un verbe dans l'URL n'est pas REST) conservée pour ne rien casser.
router.post('/:id/register', ctrl.registerTeam);

/**
 * @swagger
 * /api/tournaments/{id}/rounds:
 *   parameters:
 *     - $ref: '#/components/parameters/IdPath'
 *   get:
 *     summary: Lister les tours d'un tournoi (Quarts, Demi-finales, Finale…)
 *     tags: [Tournaments]
 *     responses:
 *       200:
 *         description: Tours triés par ordre
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Round' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   post:
 *     summary: Ajouter un tour au tournoi
 *     tags: [Tournaments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RoundInput' }
 *     responses:
 *       201:
 *         description: Tour créé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Round' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.route('/:id/rounds')
  .get(ctrl.getRounds)
  .post(ctrl.createRound);

module.exports = router;
