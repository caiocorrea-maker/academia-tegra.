const express = require('express');
const router = express.Router();
const corretorController = require('../controllers/corretorController');
const { autenticar, permitir } = require('../middleware/auth');

// Cadastro público (o próprio corretor se cadastra)
router.post('/cadastro', corretorController.cadastrar);

router.use(autenticar);

router.get('/', permitir('ADMIN', 'SUPERVISOR'), corretorController.listar);
router.get('/:id', corretorController.detalhar); // controller valida se é o próprio perfil
router.put('/perfil/me', permitir('CORRETOR'), corretorController.editarProprio);

module.exports = router;
