const express = require('express');
const router = express.Router();
const provaController = require('../controllers/provaController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);

// Banco de provas reutilizáveis
router.get('/modelos', permitir('ADMIN', 'SUPERVISOR'), provaController.listarModelos);
router.get('/modelos/:id', permitir('ADMIN', 'SUPERVISOR'), provaController.detalharModelo);
router.post('/modelos', permitir('ADMIN', 'SUPERVISOR'), provaController.criarModelo);

// Realização da prova pelo corretor
router.get('/treinamento/:treinamentoId/iniciar', permitir('CORRETOR'), provaController.iniciar);
router.post('/treinamento/:treinamentoId/responder', permitir('CORRETOR'), provaController.responder);

module.exports = router;
