const express = require('express');
const router = express.Router();
const bibliotecaController = require('../controllers/bibliotecaController');
const { autenticar, permitir } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(autenticar);

// Visualização — todos os perfis
router.get('/', bibliotecaController.listar);
router.get('/:id/url', bibliotecaController.obterUrlDownload);

// Cadastro/edição/exclusão — Admin e Supervisor (produtos vinculados)
router.post('/', permitir('ADMIN', 'SUPERVISOR'), upload.uploadMaterial.single('arquivo'), bibliotecaController.criar);
router.put('/:id', permitir('ADMIN', 'SUPERVISOR'), upload.uploadMaterial.single('arquivo'), bibliotecaController.editar);
router.delete('/:id', permitir('ADMIN', 'SUPERVISOR'), bibliotecaController.excluir);

module.exports = router;
