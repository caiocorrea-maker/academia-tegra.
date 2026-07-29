const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);
router.get('/treinamentos', permitir('ADMIN', 'SUPERVISOR'), exportController.exportarTreinamentos);

module.exports = router;
