const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');

// Limita tentativas de login para mitigar força bruta
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/login', loginLimiter, authController.login);
router.post('/esqueci-senha', loginLimiter, authController.esqueciSenha);
router.post('/redefinir-senha', authController.redefinirSenha);

router.get('/me', autenticar, authController.me);
router.post('/trocar-senha', autenticar, authController.trocarSenhaLogado);

module.exports = router;
