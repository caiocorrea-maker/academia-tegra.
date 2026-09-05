const express = require('express');
const router = express.Router();
const treinamentoController = require('../controllers/treinamentoController');
const { autenticar, permitir } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(autenticar);

// Agenda / histórico — todos os perfis podem visualizar
router.get('/agenda', treinamentoController.listarAgenda);
router.get('/historico', treinamentoController.listarHistorico);

// Sugestão de nome / preenchimento automático ao cadastrar treinamento (Admin/Supervisor)
router.get('/sugestoes', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.sugestoesPorProduto);

router.get('/:id', treinamentoController.detalhar);

// Cadastro/edição — Admin e Supervisor
router.post('/', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.criar);
router.put('/:id', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.editar);
router.delete('/:id', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.excluir);

// Evidências (anexadas depois, como edição)
router.post('/:id/evidencias', permitir('ADMIN', 'SUPERVISOR'), upload.array('arquivos'), treinamentoController.adicionarEvidencias);
router.delete('/:id/evidencias/:evidenciaId', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.removerEvidencia);

// Interesse do corretor
router.post('/:id/interesse', permitir('CORRETOR'), treinamentoController.demonstrarInteresse);
router.delete('/:id/interesse', permitir('CORRETOR'), treinamentoController.cancelarInteresse);

// Liberação de prova (válida por 1h)
router.post('/:id/liberar', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.liberar);

// Confirmação manual de presença (Admin/Supervisor), a partir da lista de interessados
router.put('/:id/presencas/:corretorId', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.definirPresenca);
router.put('/:id/presencas', permitir('ADMIN', 'SUPERVISOR'), treinamentoController.definirPresencasEmLote);

module.exports = router;
