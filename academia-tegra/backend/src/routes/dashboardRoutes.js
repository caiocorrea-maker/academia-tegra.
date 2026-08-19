const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { autenticar, permitir } = require('../middleware/auth');

router.use(autenticar);
router.use(permitir('ADMIN', 'SUPERVISOR'));

router.get('/tabela-produtos', dashboardController.tabelaProdutos);
router.get('/pizza-aptos-empresa', dashboardController.pizzaAptosEmpresa);
router.get('/coluna-empresa', dashboardController.colunaEmpresa);
router.get('/treinamentos-por-produto', dashboardController.treinamentosPorProduto);
router.get('/coluna-produto', dashboardController.colunaProduto);

module.exports = router;
