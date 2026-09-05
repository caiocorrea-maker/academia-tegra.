const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);
router.get('/treinamentos', permitir('ADMIN', 'SUPERVISOR'), exportController.exportarTreinamentos);
router.get('/presencas', permitir('ADMIN', 'SUPERVISOR'), exportController.exportarPresencas);
router.get('/corretores-aptos', permitir('ADMIN', 'SUPERVISOR'), exportController.exportarCorretoresAptos);
router.get('/avaliacoes-nps', permitir('ADMIN', 'SUPERVISOR'), exportController.exportarAvaliacoesNps);

module.exports = router;
