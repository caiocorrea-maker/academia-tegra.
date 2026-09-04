require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const corretorRoutes = require('./routes/corretorRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const treinamentoRoutes = require('./routes/treinamentoRoutes');
const provaRoutes = require('./routes/provaRoutes');
const certificadoRoutes = require('./routes/certificadoRoutes');
const exportRoutes = require('./routes/exportRoutes');
const cronRoutes = require('./routes/cronRoutes');
const bibliotecaRoutes = require('./routes/bibliotecaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const temaOficialRoutes = require('./routes/temaOficialRoutes');
const npsRoutes = require('./routes/npsRoutes');

const app = express();

// O Render (e a maioria dos provedores de hospedagem) coloca a aplicação atrás de um
// proxy reverso. Sem isso, o express-rate-limit não consegue identificar corretamente o
// IP de quem está fazendo a requisição a partir do cabeçalho X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '2mb' }));

// Limite geral de requisições por IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/corretores', corretorRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/produtos', produtoRoutes);
app.use('/api/treinamentos', treinamentoRoutes);
app.use('/api/provas', provaRoutes);
app.use('/api/certificados', certificadoRoutes);
app.use('/api/exportar', exportRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/biblioteca', bibliotecaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/temas-oficiais', temaOficialRoutes);
app.use('/api/nps', npsRoutes);

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Academia Tegra API rodando na porta ${PORT}`);
});
