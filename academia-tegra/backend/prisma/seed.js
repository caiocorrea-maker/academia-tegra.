require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const nome = process.env.SEED_ADMIN_NOME || 'Administrador';
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_SENHA;

  if (!email || !senha) {
    console.error('Defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA no .env antes de rodar o seed.');
    process.exit(1);
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`Já existe um usuário com o e-mail ${email}. Nada a fazer.`);
    return;
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  await prisma.usuario.create({
    data: { nome, email, senhaHash, perfil: 'ADMIN' },
  });

  console.log(`Administrador inicial criado: ${email}`);
  console.log('IMPORTANTE: troque essa senha no primeiro acesso.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
