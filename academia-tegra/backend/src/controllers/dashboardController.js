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

// Fim do dia de hoje (23:59:59 UTC). Usado como limite de "até hoje" em vez do instante
// exato de "agora": como os treinamentos são salvos ancorados ao meio-dia UTC
// (ver ancorarData em utils/datas.js), comparar contra o instante exato de "agora" fazia um
// treinamento datado de hoje ser tratado como "futuro" (e ficar de fora dos gráficos) se a
// consulta acontecesse antes das ~09h de Brasília (12h UTC). Comparando contra o fim do dia
// de hoje, um treinamento datado de hoje já conta como realizado assim que o dia começa,
// independente do horário em que o dashboard for consultado.
function fimDiaAtual() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 23, 59, 59));
}

// Se dataInicio/dataFim vierem (filtro explícito do usuário), usa esse período exatamente
// como informado. Caso contrário: se padraoMesAtual for true, usa o mês vigente (mas nunca
// além de hoje); senão, considera todo o histórico até hoje. Em ambos os casos "sem filtro"
// nunca inclui treinamentos futuros (de amanhã em diante) — mas SEMPRE inclui os de hoje.
function resolverPeriodo(dataInicio, dataFim, padraoMesAtual) {
  const fimHoje = fimDiaAtual();

  if (dataInicio && dataFim) {
    return { gte: new Date(`${dataInicio}T00:00:00Z`), lte: new Date(`${dataFim}T23:59:59Z`) };
  }

  if (padraoMesAtual) {
    const fimMes = fimMesAtual();
    return { gte: inicioMesAtual(), lte: fimMes < fimHoje ? fimMes : fimHoje };
  }

  return { lte: fimHoje };
}

function certificadoValido(emitidoEm) {
  const validoAte = new Date(emitidoEm);
  validoAte.setMonth(validoAte.getMonth() + MESES_VALIDADE_CERTIFICADO);
  return new Date() < validoAte;
}

// "Apto" em um produto = ter certificado válido em CADA Tema Oficial ativo do produto. Como
// o Certificado agora é único por (temaOficialId + corretorId), contar quantos Temas
// Oficiais ativos e distintos têm certificado válido — e comparar com o total de Temas
// Oficiais ativos do produto — é equivalente a checar "um certificado por insígnia", sem
// precisar percorrer produto a produto: certificadosNecessarios é sempre igual à
// quantidade de Temas Oficiais ativos daquele produto (mantidos em sincronia pela tela de
// cadastro do Produto).

// ---- 1) Consolidado por produto: treinamentos realizados, presentes, aptos ----
// Filtros: empresaId (opcional), dataInicio/dataFim (opcional). Sem período informado,
// considera todo o histórico até hoje (nunca treinamentos futuros).
// Cada linha traz também "porEmpresa" para o drill-down (clique no produto).
async function tabelaProdutos(req, res) {
  const { empresaId, dataInicio, dataFim } = req.query;
  const periodo = resolverPeriodo(dataInicio, dataFim, false);
  const limiteHoje = fimDiaAtual();

  const produtos = await prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  const empresasAtivas = await prisma.empresaVenda.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  const nomeEmpresaPorId = Object.fromEntries(empresasAtivas.map((e) => [e.id, e.nome]));

  const treinamentos = await prisma.treinamento.findMany({
    where: { status: { not: 'CANCELADO' }, data: periodo },
    select: { produtoId: true, data: true },
  });

  const presencas = await prisma.presenca.findMany({
    where: {
      treinamento: { status: { not: 'CANCELADO' }, data: periodo },
      ...(empresaId && { corretor: { empresaId } }),
    },
    select: {
      treinamento: { select: { produtoId: true, data: true } },
      corretor: { select: { empresaId: true } },
    },
  });

  const certificados = await prisma.certificado.findMany({
    // Só conta certificados de Temas Oficiais ATIVOS: se uma insígnia foi removida (reduzindo
    // "Insígnias p/ aptidão" do produto), um certificado antigo dela não deve mais contar para
    // a aptidão, mesmo que ainda esteja dentro da validade de 6 meses.
    where: { temaOficialId: { not: null }, temaOficial: { ativo: true }, ...(empresaId && { corretor: { empresaId } }) },
    select: {
      corretorId: true,
      emitidoEm: true,
      temaOficial: { select: { produtoId: true } },
      corretor: { select: { empresaId: true } },
    },
  });

  const treinamentosRealizadosPorProduto = {};
  for (const t of treinamentos) {
    if (new Date(t.data) > limiteHoje) continue; // conta só treinamentos até hoje (nunca futuros)
    treinamentosRealizadosPorProduto[t.produtoId] = (treinamentosRealizadosPorProduto[t.produtoId] || 0) + 1;
  }

  const presentesPorProduto = {};
  const presentesPorProdutoEmpresa = {}; // produtoId -> chaveEmpresa -> qtd
  for (const p of presencas) {
    if (new Date(p.treinamento.data) > limiteHoje) continue;
    const produtoId = p.treinamento.produtoId;
    const chaveEmpresa = p.corretor.empresaId || 'sem-empresa';
    presentesPorProduto[produtoId] = (presentesPorProduto[produtoId] || 0) + 1;
    presentesPorProdutoEmpresa[produtoId] ??= {};
    presentesPorProdutoEmpresa[produtoId][chaveEmpresa] = (presentesPorProdutoEmpresa[produtoId][chaveEmpresa] || 0) + 1;
  }

  const validosPorProdutoCorretor = {};
  const validosPorProdutoEmpresaCorretor = {}; // produtoId -> chaveEmpresa -> corretorId -> qtd
  for (const c of certificados) {
    if (!certificadoValido(c.emitidoEm)) continue;
    const produtoId = c.temaOficial.produtoId;
    const chaveEmpresa = c.corretor.empresaId || 'sem-empresa';

    validosPorProdutoCorretor[produtoId] ??= {};
    validosPorProdutoCorretor[produtoId][c.corretorId] = (validosPorProdutoCorretor[produtoId][c.corretorId] || 0) + 1;

    validosPorProdutoEmpresaCorretor[produtoId] ??= {};
    validosPorProdutoEmpresaCorretor[produtoId][chaveEmpresa] ??= {};
    validosPorProdutoEmpresaCorretor[produtoId][chaveEmpresa][c.corretorId] =
      (validosPorProdutoEmpresaCorretor[produtoId][chaveEmpresa][c.corretorId] || 0) + 1;
  }

  const linhas = produtos.map((p) => {
    const porCorretor = validosPorProdutoCorretor[p.id] || {};
    const aptos = Object.values(porCorretor).filter((qtd) => qtd >= p.certificadosNecessarios).length;

    const chavesEmpresa = new Set([
      ...Object.keys(presentesPorProdutoEmpresa[p.id] || {}),
      ...Object.keys(validosPorProdutoEmpresaCorretor[p.id] || {}),
    ]);

    const porEmpresa = Array.from(chavesEmpresa)
      .map((chave) => {
        const nome = chave === 'sem-empresa' ? 'Sem empresa' : (nomeEmpresaPorId[chave] || 'Empresa inativa');
        const presentesEmpresa = (presentesPorProdutoEmpresa[p.id] || {})[chave] || 0;
        const porCorretorEmpresa = (validosPorProdutoEmpresaCorretor[p.id] || {})[chave] || {};
        const aptosEmpresa = Object.values(porCorretorEmpresa).filter((qtd) => qtd >= p.certificadosNecessarios).length;
        return { nome, presentes: presentesEmpresa, aptos: aptosEmpresa };
      })
      .sort((a, b) => b.presentes - a.presentes);

    return {
      produtoId: p.id,
      nome: p.nome,
      cor: p.corCalendario,
      treinamentosRealizados: treinamentosRealizadosPorProduto[p.id] || 0,
      presentes: presentesPorProduto[p.id] || 0,
      aptos,
      porEmpresa,
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
  const produtos = await prisma.produto.findMany({ where: { ativo: true }, select: { id: true, nome: true, certificadosNecessarios: true }, orderBy: { nome: 'asc' } });
  const necessariosPorProduto = Object.fromEntries(produtos.map((p) => [p.id, p.certificadosNecessarios]));

  const certificados = await prisma.certificado.findMany({
    // Mesma correção: só considera certificados de Temas Oficiais atualmente ativos.
    where: { temaOficialId: { not: null }, temaOficial: { ativo: true } },
    select: { corretorId: true, emitidoEm: true, temaOficial: { select: { produtoId: true } } },
  });

  const contagem = {}; // corretorId -> produtoId -> qtd válidos
  for (const c of certificados) {
    const produtoId = c.temaOficial.produtoId;
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

  // Detalhamento por produto (para o hover/clique do gráfico): quantos corretores de cada
  // empresa estão aptos em cada produto especificamente.
  const aptosPorEmpresaProduto = {}; // chaveEmpresa -> produtoId -> qtd
  for (const c of corretores) {
    const chaveEmpresa = c.empresaId || 'sem-empresa';
    const porProdutoCorretor = contagem[c.id] || {};
    for (const produto of produtos) {
      const qtd = porProdutoCorretor[produto.id] || 0;
      if (qtd >= produto.certificadosNecessarios) {
        aptosPorEmpresaProduto[chaveEmpresa] ??= {};
        aptosPorEmpresaProduto[chaveEmpresa][produto.id] = (aptosPorEmpresaProduto[chaveEmpresa][produto.id] || 0) + 1;
      }
    }
  }

  function detalhePorProduto(chave) {
    const mapa = aptosPorEmpresaProduto[chave] || {};
    return produtos
      .map((p) => ({ nome: p.nome, aptos: mapa[p.id] || 0 }))
      .filter((d) => d.aptos > 0)
      .sort((a, b) => b.aptos - a.aptos);
  }

  const resultado = empresas
    .map((e) => ({
      empresaId: e.id,
      nome: e.nome,
      aptos: grupos[e.id]?.aptos || 0,
      totalCorretores: grupos[e.id]?.total || 0,
      porProduto: detalhePorProduto(e.id),
    }))
    .filter((e) => e.totalCorretores > 0);

  if (grupos['sem-empresa']) {
    resultado.push({
      empresaId: null,
      nome: 'Sem empresa',
      aptos: grupos['sem-empresa'].aptos,
      totalCorretores: grupos['sem-empresa'].total,
      porProduto: detalhePorProduto('sem-empresa'),
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
    where: { treinamento: { status: { not: 'CANCELADO' }, data: periodo } },
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

  res.json({ periodo: { inicio: periodo.gte, fim: periodo.lte }, dados: resultado });
}

// ---- 4) Treinamentos realizados: coluna horizontal por produto ----
// Sem período informado, considera todo o histórico até hoje (nunca treinamentos futuros).
async function treinamentosPorProduto(req, res) {
  const { dataInicio, dataFim } = req.query;
  const periodo = resolverPeriodo(dataInicio, dataFim, false);
  const limiteHoje = fimDiaAtual();

  const produtos = await prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });

  const treinamentos = await prisma.treinamento.findMany({
    where: { status: { not: 'CANCELADO' }, data: periodo },
    select: { produtoId: true, data: true },
  });

  const contagem = {};
  for (const t of treinamentos) {
    if (new Date(t.data) > limiteHoje) continue; // "realizados" = até hoje, nunca futuros
    contagem[t.produtoId] = (contagem[t.produtoId] || 0) + 1;
  }

  const resultado = produtos
    .map((p) => ({ produtoId: p.id, nome: p.nome, cor: p.corCalendario, quantidade: contagem[p.id] || 0 }))
    .sort((a, b) => b.quantidade - a.quantidade);

  res.json({ periodo: { inicio: periodo.gte, fim: periodo.lte }, dados: resultado });
}

// ---- 5) Coluna vertical por produto: total de corretores treinados (presença confirmada) ----
// Padrão: mês vigente. Filtro opcional por período.
async function colunaProduto(req, res) {
  const { dataInicio, dataFim } = req.query;
  const periodo = resolverPeriodo(dataInicio, dataFim, true);

  const produtos = await prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });

  const presencas = await prisma.presenca.findMany({
    where: { treinamento: { status: { not: 'CANCELADO' }, data: periodo } },
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

  res.json({ periodo: { inicio: periodo.gte, fim: periodo.lte }, dados: resultado });
}

module.exports = { tabelaProdutos, pizzaAptosEmpresa, colunaEmpresa, treinamentosPorProduto, colunaProduto };
