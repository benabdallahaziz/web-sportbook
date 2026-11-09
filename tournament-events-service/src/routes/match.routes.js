const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/match.controller');

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: Lister les matchs (avec noms des équipes et du tour)
 *     tags: [Matches]
 *     parameters:
 *       - in: query
 *         name: tournament_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         description: Filtrer les matchs d'un tournoi
 *     responses:
 *       200:
 *         description: Liste des matchs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Match' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   post:
 *     summary: Créer un match
 *     tags: [Matches]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MatchInput' }
 *     responses:
 *       201:
 *         description: Match créé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Match' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.route('/')
  .get(ctrl.getAll)
  .post(ctrl.create);

/**
 * @swagger
 * /api/matches/{id}:
 *   parameters:
 *     - $ref: '#/components/parameters/IdPath'
 *   get:
 *     summary: Obtenir un match par son ID
 *     tags: [Matches]
 *     responses:
 *       200:
 *         description: Match trouvé
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Match' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   put:
 *     summary: Remplacer complètement un match
 *     tags: [Matches]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MatchInput' }
 *     responses:
 *       200:
 *         description: Match mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Match' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   patch:
 *     summary: Modifier partiellement un match
 *     tags: [Matches]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MatchPatch' }
 *     responses:
 *       200:
 *         description: Match mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Match' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   delete:
 *     summary: Supprimer un match
 *     tags: [Matches]
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
 * /api/matches/{id}/score:
 *   patch:
 *     summary: Saisir le score d'un match (statut FINISHED par défaut)
 *     tags: [Matches]
 *     parameters:
 *       - $ref: '#/components/parameters/IdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ScoreInput' }
 *     responses:
 *       200:
 *         description: Score mis à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Match' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.patch('/:id/score', ctrl.updateScore);

module.exports = router;
