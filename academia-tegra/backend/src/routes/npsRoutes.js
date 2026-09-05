const express = require('express');
const router = express.Router();
const npsController = require('../controllers/npsController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);

router.get('/pendentes', permitir('CORRETOR'), npsController.listarPendentes);
router.get('/link/:treinamentoId', permitir('CORRETOR'), npsController.consultarPorLink);
router.post('/:treinamentoId', permitir('CORRETOR'), npsController.enviar);
router.post('/:treinamentoId/adiar', permitir('CORRETOR'), npsController.adiar);
router.get('/treinamento/:id', permitir('ADMIN', 'SUPERVISOR'), npsController.listarPorTreinamento);
router.get('/', permitir('ADMIN', 'SUPERVISOR'), npsController.listarResumo);

module.exports = router;
