const express = require('express');
const router = express.Router();
const certificadoController = require('../controllers/certificadoController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);

router.get('/meus', permitir('CORRETOR'), certificadoController.listarMeusCertificados);
router.get('/:id/url', certificadoController.obterUrlDownload);

module.exports = router;
