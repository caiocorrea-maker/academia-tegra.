const prisma = require('../config/prisma');

const MESES_VALIDADE_CERTIFICADO = 6;

// ---- Helpers de data ----

function inicioMesAtual() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1, 0, 0, 0));
}

function fimMesAtual() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59));
}

// Se dataInicio/dataFim vierem, usa esse período. Caso contrário, se padraoMesAtual for
// true, usa o mês vigente; senão, não aplica filtro de período (todo o histórico).
function resolverPeriodo(dataInicio, dataFim, padraoMesAtual) {
  if (dataInicio && dataFim) {
    return { gte: new Date(`${dataInicio}T00:00:00Z`), lte: new Date(`${dataFim}T23:59:59Z`) };
  }
  if (padraoMesAtual) return { gte: inicioMesAtual(), lte: fimMesAtual() };
  return undefined;
}

function certificadoValido(emitidoEm) {
  const validoAte = new Date(emitidoEm);
  validoAte.setMonth(validoAte.getMonth() + MESES_VALIDADE_CERTIFICADO);
  return new Date() < validoAte;
}

// ---- 1) Tabela por produto: treinamentos realizados, presentes, aptos ----
// Filtros: empresaId (opcional), dataInicio/dataFim (opcional, sem padrão = todo histórico)
async function tabelaProdutos(req, res) {
  const { empresaId, dataInicio, dataFim } = req.query;
  const periodo = resolverPeriodo(dataInicio, dataFim, false);
  const agora = new Date();

  const produtos = await prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });

  const treinamentos = await prisma.treinamento.findMany({
    where: { status: { not: 'CANCELADO' }, ...(periodo && { data: periodo }) },
    select: { produtoId: true, data: true },
  });

  const presencas = await prisma.presenca.findMany({
    where: {
      treinamento: { status: { not: 'CANCELADO' }, ...(periodo && { data: periodo }) },
      ...(empresaId && { corretor: { empresaId } }),
    },
    select: { treinamento: { select: { produtoId: true } } },
  });

  const certificados = await prisma.certificado.findMany({
    where: { ...(empresaId && { corretor: { empresaId } }) },
    select: { corretorId: true, emitidoEm: true, treinamento: { select: { produtoId: true } } },
  });

  const treinamentosRealizadosPorProduto = {};
  for (const t of treinamentos) {
    if (new Date(t.data) > agora) continue; // conta só treinamentos que já aconteceram
    treinamentosRealizadosPorProduto[t.produtoId] = (treinamentosRealizadosPorProduto[t.produtoId] || 0) + 1;
  }

  const presentesPorProduto = {};
  for (const p of presencas) {
    const produtoId = p.treinamento.produtoId;
    presentesPorProduto[produtoId] = (presentesPorProduto[produtoId] || 0) + 1;
  }

  const validosPorProdutoCorretor = {};
  for (const c of certificados) {
    if (!certificadoValido(c.emitidoEm)) continue;
    const produtoId = c.treinamento.produtoId;
    validosPorProdutoCorretor[produtoId] ??= {};
    validosPorProdutoCorretor[produtoId][c.corretorId] = (validosPorProdutoCorretor[produtoId][c.corretorId] || 0) + 1;
  }

  const linhas = produtos.map((p) => {
    const porCorretor = validosPorProdutoCorretor[p.id] || {};
    const aptos = Object.values(porCorretor).filter((qtd) => qtd >= p.certificadosNecessarios).length;
    return {
      produtoId: p.id,
      nome: p.nome,
      cor: p.corCalendario,
      treinamentosRealizados: treinamentosRealizadosPorProduto[p.id] || 0,
      presentes: presentesPorProduto[p.id] || 0,
      aptos,
    };
  });

  res.json(linhas);
}

// ---- 2) Pizza: corretores aptos a tirar plantão, por empresa de venda ----
// "Apto" aqui = apto em pelo menos um produto (mesma regra do selo ✔ do perfil do corretor).
async function pizzaAptosEmpresa(req, res) {
  const empresas = await prisma.empresaVenda.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  const corretores = await prisma.usuario.findMany({
    where: { perfil: 'CORRETOR', ativo: true },
    select: { id: true, empresaId: true },
  });
  const produtos = await prisma.produto.findMany({ where: { ativo: true }, select: { id: true, certificadosNecessarios: true } });
  const necessariosPorProduto = Object.fromEntries(produtos.map((p) => [p.id, p.certificadosNecessarios]));

  const certificados = await prisma.certificado.findMany({
    select: { corretorId: true, emitidoEm: true, treinamento: { select: { produtoId: true } } },
  });

  const contagem = {}; // corretorId -> produtoId -> qtd válidos
  for (const c of certificados) {
    const produtoId = c.treinamento.produtoId;
    if (!(produtoId in necessariosPorProduto)) continue;
    if (!certificadoValido(c.emitidoEm)) continue;
    contagem[c.corretorId] ??= {};
    contagem[c.corretorId][produtoId] = (contagem[c.corretorId][produtoId] || 0) + 1;
  }

  const corretorApto = new Set();
  for (const [corretorId, porProduto] of Object.entries(contagem)) {
    for (const [produtoId, qtd] of Object.entries(porProduto)) {
      if (qtd >= necessariosPorProduto[produtoId]) {
        corretorApto.add(corretorId);
        break;
      }
    }
  }

  const grupos = {};
  for (const c of corretores) {
    const chave = c.empresaId || 'sem-empresa';
    grupos[chave] ??= { total: 0, aptos: 0 };
    grupos[chave].total++;
    if (corretorApto.has(c.id)) grupos[chave].aptos++;
  }

  const resultado = empresas
    .map((e) => ({ empresaId: e.id, nome: e.nome, aptos: grupos[e.id]?.aptos || 0, totalCorretores: grupos[e.id]?.total || 0 }))
    .filter((e) => e.totalCorretores > 0);

  if (grupos['sem-empresa']) {
    resultado.push({
      empresaId: null,
      nome: 'Sem empresa',
      aptos: grupos['sem-empresa'].aptos,
      totalCorretores: grupos['sem-empresa'].total,
    });
  }

  res.json(resultado);
}

// ---- 3) Coluna vertical por empresa: total de corretores treinados (presença confirmada) ----
// Padrão: mês vigente. Filtro opcional por período.
async function colunaEmpresa(req, res) {
  const { dataInicio, dataFim } = req.query;
  const periodo = resolverPeriodo(dataInicio, dataFim, true);

  const empresas = await prisma.empresaVenda.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });

  const presencas = await prisma.presenca.findMany({
    where: { treinamento: { status: { not: 'CANCELADO' }, ...(periodo && { data: periodo }) } },
    select: {
      corretor: { select: { empresaId: true } },
      treinamento: { select: { id: true, produtoId: true, produto: { select: { nome: true } } } },
    },
  });

  const porEmpresa = {};
  for (const p of presencas) {
    const chave = p.corretor.empresaId || 'sem-empresa';
    const produtoId = p.treinamento.produtoId;
    const treinamentoId = p.treinamento.id;

    porEmpresa[chave] ??= { total: 0, treinamentos: new Set(), porProduto: {} };
    porEmpresa[chave].total++;
    porEmpresa[chave].treinamentos.add(treinamentoId);

    porEmpresa[chave].porProduto[produtoId] ??= { nome: p.treinamento.produto.nome, total: 0, treinamentos: new Set() };
    porEmpresa[chave].porProduto[produtoId].total++;
    porEmpresa[chave].porProduto[produtoId].treinamentos.add(treinamentoId);
  }

  function montarLinha(chave, nome, empresaId) {
    const dados = porEmpresa[chave];
    if (!dados) return { empresaId, nome, total: 0, mediaPresencaPorTreinamento: 0, porProduto: [] };
    return {
      empresaId,
      nome,
      total: dados.total,
      mediaPresencaPorTreinamento: dados.treinamentos.size ? Number((dados.total / dados.treinamentos.size).toFixed(1)) : 0,
      porProduto: Object.values(dados.porProduto)
        .map((d) => ({
          nome: d.nome,
          total: d.total,
          mediaPresencaPorTreinamento: d.treinamentos.size ? Number((d.total / d.treinamentos.size).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  const resultado = empresas.map((e) => montarLinha(e.id, e.nome, e.id));
  if (porEmpresa['sem-empresa']) resultado.push(montarLinha('sem-empresa', 'Sem empresa', null));

  res.json({ periodo: periodo ? { inicio: periodo.gte, fim: periodo.lte } : null, dados: resultado });
}

// ---- 4) Coluna horizontal por produto: quantidade de treinamentos dados ----
async function treinamentosPorProduto(req, res) {
  const { dataInicio, dataFim } = req.query;
  const periodo = resolverPeriodo(dataInicio, dataFim, false);

  const produtos = await prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });

  const treinamentos = await prisma.treinamento.findMany({
    where: { status: { not: 'CANCELADO' }, ...(periodo && { data: periodo }) },
    select: { produtoId: true },
  });

  const contagem = {};
  for (const t of treinamentos) contagem[t.produtoId] = (contagem[t.produtoId] || 0) + 1;

  const resultado = produtos
    .map((p) => ({ produtoId: p.id, nome: p.nome, cor: p.corCalendario, quantidade: contagem[p.id] || 0 }))
    .sort((a, b) => b.quantidade - a.quantidade);

  res.json({ periodo: periodo ? { inicio: periodo.gte, fim: periodo.lte } : null, dados: resultado });
}

// ---- 5) Coluna vertical por produto: total de corretores treinados (presença confirmada) ----
// Padrão: mês vigente. Filtro opcional por período.
async function colunaProduto(req, res) {
  const { dataInicio, dataFim } = req.query;
  const periodo = resolverPeriodo(dataInicio, dataFim, true);

  const produtos = await prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });

  const presencas = await prisma.presenca.findMany({
    where: { treinamento: { status: { not: 'CANCELADO' }, ...(periodo && { data: periodo }) } },
    select: {
      corretor: { select: { empresaId: true, empresa: { select: { nome: true } } } },
      treinamento: { select: { id: true, produtoId: true } },
    },
  });

  const porProduto = {};
  for (const p of presencas) {
    const produtoId = p.treinamento.produtoId;
    const chaveEmpresa = p.corretor.empresaId || 'sem-empresa';
    const nomeEmpresa = p.corretor.empresa?.nome || 'Sem empresa';
    const treinamentoId = p.treinamento.id;

    porProduto[produtoId] ??= { total: 0, treinamentos: new Set(), porEmpresa: {} };
    porProduto[produtoId].total++;
    porProduto[produtoId].treinamentos.add(treinamentoId);

    porProduto[produtoId].porEmpresa[chaveEmpresa] ??= { nome: nomeEmpresa, total: 0, treinamentos: new Set() };
    porProduto[produtoId].porEmpresa[chaveEmpresa].total++;
    porProduto[produtoId].porEmpresa[chaveEmpresa].treinamentos.add(treinamentoId);
  }

  const resultado = produtos.map((p) => {
    const dados = porProduto[p.id];
    if (!dados) return { produtoId: p.id, nome: p.nome, total: 0, mediaPresencaPorTreinamento: 0, porEmpresa: [] };
    return {
      produtoId: p.id,
      nome: p.nome,
      total: dados.total,
      mediaPresencaPorTreinamento: dados.treinamentos.size ? Number((dados.total / dados.treinamentos.size).toFixed(1)) : 0,
      porEmpresa: Object.values(dados.porEmpresa)
        .map((d) => ({
          nome: d.nome,
          total: d.total,
          mediaPresencaPorTreinamento: d.treinamentos.size ? Number((d.total / d.treinamentos.size).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.total - a.total),
    };
  });

  res.json({ periodo: periodo ? { inicio: periodo.gte, fim: periodo.lte } : null, dados: resultado });
}

module.exports = { tabelaProdutos, pizzaAptosEmpresa, colunaEmpresa, treinamentosPorProduto, colunaProduto };
