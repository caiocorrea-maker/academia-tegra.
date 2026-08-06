const express = require('express');
const router = express.Router();
const cronController = require('../controllers/cronController');

// Sem middleware de autenticação de usuário — protegida por uma chave secreta simples
// (header x-cron-secret), pensada para ser chamada por um serviço externo de agendamento.
router.post('/lembretes', cronController.executarLembretes);
router.get('/lembretes', cronController.executarLembretes);

module.exports = router;
