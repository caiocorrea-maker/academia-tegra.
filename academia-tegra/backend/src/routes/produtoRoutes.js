const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);

router.get('/', produtoController.listar); // todos os perfis podem visualizar
router.post('/', permitir('ADMIN'), produtoController.criar);
router.put('/:id', permitir('ADMIN'), produtoController.editar);
router.delete('/:id', permitir('ADMIN'), produtoController.inativar);

module.exports = router;
