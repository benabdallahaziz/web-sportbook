const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/team.controller');

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Lister toutes les équipes
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: Liste des équipes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Team' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *       503: { $ref: '#/components/responses/Unavailable' }
 *   post:
 *     summary: Créer une équipe
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TeamInput' }
 *     responses:
 *       201:
 *         description: Équipe créée. L'en-tête Location contient son URL.
 *         headers:
 *           Location: { schema: { type: string }, example: /api/teams/3 }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Team' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.route('/')
  .get(ctrl.getAll)
  .post(ctrl.create);

/**
 * @swagger
 * /api/teams/{id}:
 *   parameters:
 *     - $ref: '#/components/parameters/IdPath'
 *   get:
 *     summary: Obtenir une équipe par son ID
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: Équipe trouvée
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Team' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   put:
 *     summary: Remplacer complètement une équipe
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TeamInput' }
 *     responses:
 *       200:
 *         description: Équipe mise à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Team' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   patch:
 *     summary: Modifier partiellement une équipe
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TeamPatch' }
 *     responses:
 *       200:
 *         description: Équipe mise à jour
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Team' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   delete:
 *     summary: Supprimer une équipe
 *     tags: [Teams]
 *     responses:
 *       204: { $ref: '#/components/responses/NoContent' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.route('/:id')
  .get(ctrl.getById)
  .put(ctrl.replace)
  .patch(ctrl.patch)
  .delete(ctrl.remove);

module.exports = router;
