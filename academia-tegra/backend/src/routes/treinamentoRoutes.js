const express = require('express');
const router = express.Router();
const treinamentoController = require('../controllers/treinamentoController');
const { autenticar, permitir } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(autenticar);

// Agenda / histórico — todos os perfis podem visualizar
router.get('/agenda', treinamentoController.listarAgenda);
router.get('/historico', treinamentoController.listarHistorico);
router.get('/:id', treinamentoController.detalhar);

// Cadastro/edição — Admin e Supervisor
router.post('/', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.criar);
router.put('/:id', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.editar);

// Evidências (anexadas depois, como edição)
router.post('/:id/evidencias', permitir('ADMIN', 'SUPERVISOR'), upload.array('arquivos'), treinamentoController.adicionarEvidencias);
router.delete('/:id/evidencias/:evidenciaId', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.removerEvidencia);

// Interesse do corretor
router.post('/:id/interesse', permitir('CORRETOR'), treinamentoController.demonstrarInteresse);
router.delete('/:id/interesse', permitir('CORRETOR'), treinamentoController.cancelarInteresse);

// Liberação de prova/QR de presença
router.post('/:id/liberar', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.liberar);
router.post('/:id/confirmar-presenca', permitir('CORRETOR'), treinamentoController.confirmarPresenca);

module.exports = router;
