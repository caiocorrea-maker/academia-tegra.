# Academia Tegra

Sistema de controle executivo de treinamentos da equipe de vendas: agendamento em calendário, gestão de supervisores e corretores, controle de presença, provas com correção automática, certificados em PDF e exportação para Excel.

## Estrutura do projeto

```
academia-tegra/
├── backend/     # API REST (Node.js + Express + Prisma + PostgreSQL)
└── frontend/    # Aplicação web (React + Vite)
```

## Passo a passo de deploy

### 1. Banco de dados PostgreSQL

Crie um banco Postgres em um destes serviços (todos têm plano gratuito/inicial barato):
- **Railway** (railway.app) — mais simples, cria o banco com 1 clique
- **Render** (render.com)
- **Supabase** (supabase.com)
- **Neon** (neon.tech)

Copie a **connection string** (`DATABASE_URL`) fornecida.

### 2. Armazenamento de arquivos (bucket S3-compatível)

Recomendado: **Cloudflare R2** (cloudflare.com) — tem camada gratuita generosa e não cobra por saída de dados.

1. Crie uma conta na Cloudflare e ative o R2.
2. Crie um bucket (ex: `academia-tegra`).
3. Em "Manage R2 API Tokens", crie um token com permissão de leitura/escrita e anote:
   - `Account ID` → usado para montar o `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`
   - `Access Key ID` e `Secret Access Key`
4. (Opcional, recomendado) Conecte um domínio customizado ao bucket para servir os arquivos publicamente via `S3_PUBLIC_URL` (ex: `https://arquivos.seudominio.com.br`). Sem isso, o sistema usa URLs assinadas temporárias automaticamente.

Alternativas equivalentes: AWS S3, Backblaze B2 (todos compatíveis com a mesma configuração).

### 3. E-mail transacional (recuperação de senha)

Recomendado: **Resend** (resend.com) — tem SMTP compatível e camada gratuita.
Alternativas: SendGrid, Amazon SES, ou o SMTP do seu provedor de e-mail corporativo.

### 4. Backend

Hospede em **Railway** ou **Render** (Web Service):

1. Suba a pasta `backend/` para um repositório Git (GitHub/GitLab).
2. No serviço de hospedagem, conecte o repositório e configure:
   - **Build command**: `npm install && npx prisma generate`
   - **Start command**: `npx prisma migrate deploy && npm start`
3. Configure todas as variáveis de ambiente listadas em `backend/.env.example`.
4. Após o primeiro deploy, rode o script de seed para criar o administrador inicial:
   ```bash
   npm run seed
   ```
   (Railway/Render permitem rodar comandos únicos via terminal do próprio painel, ou você pode rodar localmente apontando `DATABASE_URL` para o banco de produção.)
5. Anote a URL pública gerada pelo serviço (ex: `https://academia-tegra-api.up.railway.app`) — ela será o `VITE_API_URL` do frontend (adicionando `/api` no final).

### 5. Frontend

Hospede em **Vercel** ou **Netlify** (ambos com plano gratuito):

1. Suba a pasta `frontend/` para o mesmo repositório ou um separado.
2. Configure:
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
3. Configure a variável de ambiente `VITE_API_URL` apontando para a URL do backend + `/api` (ex: `https://academia-tegra-api.up.railway.app/api`).
4. Após o deploy, copie a URL pública do frontend (ex: `https://academia-tegra.vercel.app`) e configure-a como `FRONTEND_URL` nas variáveis de ambiente do **backend** (necessário para CORS e para os links de e-mail/QR Code funcionarem corretamente). Redeploy o backend após essa alteração.

### 6. Primeiro acesso

Acesse a URL do frontend e faça login com o e-mail/senha definidos em `SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA`. Recomenda-se trocar a senha imediatamente pelo próprio sistema.

## Desenvolvimento local

### Backend
```bash
cd backend
cp .env.example .env   # preencha com um banco Postgres local ou de testes
npm install
npx prisma migrate dev
npm run seed
npm run dev             # roda em http://localhost:3333
```

### Frontend
```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:3333/api
npm install
npm run dev              # roda em http://localhost:5173
```

## Principais fluxos implementados

- **Agenda**: calendário mensal com eventos coloridos por produto, navegação de mês/ano, modal de detalhes.
- **Interesse do corretor**: botão "Tenho Interesse", disponível até o horário do treinamento, uma marcação por corretor, cancelável.
- **Treinamentos**: cadastro com produto, supervisor, data, horário, tema, plano, prova (ou QR/link de presença sem prova), evidências anexadas por edição posterior.
- **Banco de provas reutilizável**: 10 questões obrigatórias, 4 alternativas, 1 correta; reutilizável entre treinamentos do mesmo produto, independente do supervisor.
- **Liberação e prazo de 1h**: tanto a prova quanto a confirmação de presença sem prova expiram 1 hora após a liberação pelo supervisor.
- **Correção automática**: aprovação com 70% ou mais de acertos (7 de 10).
- **Certificados**: PDF gerado automaticamente para aprovados, armazenado no bucket e listado no perfil do corretor (mais recente primeiro).
- **Métricas**: interessados, presentes e aprovados calculados automaticamente por treinamento.
- **Histórico e exportação**: filtros por produto/supervisor/período; exportação para Excel sem as evidências.
- **Perfis e permissões**: Administrador, Supervisor (restrito aos produtos vinculados) e Corretor (autocadastro e edição dos próprios dados), conforme a matriz de permissões definida no escopo.
