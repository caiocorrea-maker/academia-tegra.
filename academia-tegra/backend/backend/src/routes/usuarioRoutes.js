const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);

// Aba "Supervisores": Admin e Supervisor podem visualizar
router.get('/supervisores', permitir('ADMIN', 'SUPERVISOR'), usuarioController.listarSupervisoresComEstatisticas);
router.get('/supervisores/:id', permitir('ADMIN', 'SUPERVISOR'), usuarioController.detalharSupervisor);

// Painel do Administrador: gestão de administradores e supervisores
router.get('/internos', permitir('ADMIN'), usuarioController.listarInternos);
router.post('/internos', permitir('ADMIN'), usuarioController.criarInterno);
router.put('/internos/:id', permitir('ADMIN'), usuarioController.editarInterno);

module.exports = router;
