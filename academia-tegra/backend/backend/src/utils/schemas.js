const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

const criarUsuarioInternoSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  perfil: z.enum(['ADMIN', 'SUPERVISOR']),
  senha: z.string().min(6),
  produtoIds: z.array(z.string().uuid()).optional(),
});

const editarUsuarioInternoSchema = z.object({
  nome: z.string().min(3).optional(),
  email: z.string().email().optional(),
  ativo: z.boolean().optional(),
  produtoIds: z.array(z.string().uuid()).optional(),
});

const cadastroCorretorSchema = z.object({
  nome: z.string().min(3),
  empresaId: z.string().uuid(),
  cpf: z.string().min(11),
  email: z.string().email(),
  senha: z.string().min(6),
  gerente: z.string().optional(),
  diretor: z.string().optional(),
});

const editarCorretorSchema = z.object({
  nome: z.string().min(3).optional(),
  empresaId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  senha: z.string().min(6).optional(),
  gerente: z.string().optional(),
  diretor: z.string().optional(),
});

const empresaSchema = z.object({
  nome: z.string().min(2),
});

const produtoSchema = z.object({
  nome: z.string().min(2),
  corCalendario: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar em formato hexadecimal, ex: #FF5733'),
});

const alternativaSchema = z.object({
  texto: z.string().min(1),
  correta: z.boolean(),
});

const questaoSchema = z.object({
  enunciado: z.string().min(1),
  alternativas: z.array(alternativaSchema).length(4, 'Cada questão deve ter exatamente 4 alternativas.'),
}).refine((q) => q.alternativas.filter((a) => a.correta).length === 1, {
  message: 'Cada questão deve ter exatamente 1 alternativa correta.',
});

const provaModeloSchema = z.object({
  titulo: z.string().min(3),
  produtoId: z.string().uuid(),
  questoes: z.array(questaoSchema).length(10, 'A prova deve conter exatamente 10 questões.'),
});

const treinamentoSchema = z.object({
  produtoId: z.string().uuid(),
  supervisorId: z.string().uuid().optional(),
  data: z.string(), // ISO date
  horario: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário no formato HH:MM'),
  tema: z.string().min(3),
  planoTreinamento: z.string().min(3),
  temProva: z.boolean(),
  provaId: z.string().uuid().nullable().optional(),
});

const responderProvaSchema = z.object({
  respostas: z.array(
    z.object({
      questaoId: z.string().uuid(),
      alternativaId: z.string().uuid(),
    })
  ),
});

const esqueciSenhaSchema = z.object({
  email: z.string().email(),
});

const redefinirSenhaSchema = z.object({
  token: z.string().min(10),
  novaSenha: z.string().min(6),
});

module.exports = {
  loginSchema,
  criarUsuarioInternoSchema,
  editarUsuarioInternoSchema,
  cadastroCorretorSchema,
  editarCorretorSchema,
  empresaSchema,
  produtoSchema,
  provaModeloSchema,
  treinamentoSchema,
  responderProvaSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
};
