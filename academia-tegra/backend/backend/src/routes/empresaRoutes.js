const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const { autenticar, permitir } = require('../middleware/auth');

// Listagem pública (necessária na tela de cadastro do corretor)
router.get('/', empresaController.listar);

router.use(autenticar);
router.post('/', permitir('ADMIN'), empresaController.criar);
router.put('/:id', permitir('ADMIN'), empresaController.editar);
router.delete('/:id', permitir('ADMIN'), empresaController.inativar);

module.exports = router;
