const express = require('express');
const router = express.Router();
const temaOficialController = require('../controllers/temaOficialController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);

router.get('/', permitir('ADMIN', 'SUPERVISOR'), temaOficialController.listarPorProduto);
router.post('/', permitir('ADMIN', 'SUPERVISOR'), temaOficialController.salvar);

module.exports = router;
