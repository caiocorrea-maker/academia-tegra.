import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import Layout from '../components/Layout';
import api from '../services/api';

const PALETA = ['#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0d9488', '#db2777'];

function corPor(indice) {
  return PALETA[indice % PALETA.length];
}

// Tooltip customizado para os gráficos de coluna com detalhamento (itens 3 e 5)
function TooltipDetalhado({ active, payload, rotuloDetalhe }) {
  if (!active || !payload?.length) return null;
  const dado = payload[0].payload;
  const detalhes = dado.detalhes || [];
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 12, maxWidth: 240 }}>
      <strong>{dado.nome}</strong>
      <div>Total treinados: {dado.total}</div>
      <div>Média de presença por treinamento: {dado.mediaPresencaPorTreinamento}</div>
      {detalhes.length > 0 && (
        <>
          <div style={{ marginTop: 6, fontWeight: 600 }}>{rotuloDetalhe}</div>
          {detalhes.map((d) => (
            <div key={d.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{d.nome}</span>
              <span>{d.total} (méd. {d.mediaPresencaPorTreinamento})</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// Painel de detalhamento fixo, útil para toque em celular (onde não há "hover")
function PainelDetalhe({ item, rotuloDetalhe }) {
  if (!item) return null;
  return (
    <div style={{ marginTop: 10, background: '#f8f9fc', borderRadius: 8, padding: 12, fontSize: 13 }}>
      <strong>{item.nome}</strong>
      <div>Total treinados: {item.total}</div>
      <div>Média de presença por treinamento: {item.mediaPresencaPorTreinamento}</div>
      {(item.detalhes || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{rotuloDetalhe}</div>
          {item.detalhes.map((d) => (
            <div key={d.nome} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{d.nome}</span>
              <span>{d.total} (méd. {d.mediaPresencaPorTreinamento})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [empresas, setEmpresas] = useState([]);

  // 1) Tabela por produto
  const [filtroTabela, setFiltroTabela] = useState({ empresaId: '', dataInicio: '', dataFim: '' });
  const [tabela, setTabela] = useState([]);
  const [carregandoTabela, setCarregandoTabela] = useState(true);

  // 2) Pizza — aptos por empresa
  const [pizza, setPizza] = useState([]);
  const [carregandoPizza, setCarregandoPizza] = useState(true);

  // 3) Coluna por empresa
  const [filtroColunaEmpresa, setFiltroColunaEmpresa] = useState({ dataInicio: '', dataFim: '' });
  const [colunaEmpresa, setColunaEmpresa] = useState([]);
  const [selecionadoEmpresa, setSelecionadoEmpresa] = useState(null);
  const [carregandoColunaEmpresa, setCarregandoColunaEmpresa] = useState(true);

  // 4) Barra horizontal — treinamentos por produto
  const [filtroTreinamentosProduto, setFiltroTreinamentosProduto] = useState({ dataInicio: '', dataFim: '' });
  const [treinamentosPorProduto, setTreinamentosPorProduto] = useState([]);
  const [carregandoTreinamentosProduto, setCarregandoTreinamentosProduto] = useState(true);

  // 5) Coluna por produto
  const [filtroColunaProduto, setFiltroColunaProduto] = useState({ dataInicio: '', dataFim: '' });
  const [colunaProduto, setColunaProduto] = useState([]);
  const [selecionadoProduto, setSelecionadoProduto] = useState(null);
  const [carregandoColunaProduto, setCarregandoColunaProduto] = useState(true);

  useEffect(() => {
    api.get('/empresas').then((res) => setEmpresas(res.data));
  }, []);

  // ---- 1) Tabela ----
  useEffect(() => {
    setCarregandoTabela(true);
    const params = {};
    if (filtroTabela.empresaId) params.empresaId = filtroTabela.empresaId;
    if (filtroTabela.dataInicio && filtroTabela.dataFim) {
      params.dataInicio = filtroTabela.dataInicio;
      params.dataFim = filtroTabela.dataFim;
    }
    api.get('/dashboard/tabela-produtos', { params }).then((res) => {
      setTabela(res.data);
      setCarregandoTabela(false);
    });
  }, [filtroTabela]);

  // ---- 2) Pizza ----
  useEffect(() => {
    setCarregandoPizza(true);
    api.get('/dashboard/pizza-aptos-empresa').then((res) => {
      setPizza(res.data);
      setCarregandoPizza(false);
    });
  }, []);

  // ---- 3) Coluna por empresa ----
  useEffect(() => {
    setCarregandoColunaEmpresa(true);
    const params = {};
    if (filtroColunaEmpresa.dataInicio && filtroColunaEmpresa.dataFim) {
      params.dataInicio = filtroColunaEmpresa.dataInicio;
      params.dataFim = filtroColunaEmpresa.dataFim;
    }
    api.get('/dashboard/coluna-empresa', { params }).then((res) => {
      const dados = res.data.dados.map((e) => ({
        nome: e.nome,
        total: e.total,
        mediaPresencaPorTreinamento: e.mediaPresencaPorTreinamento,
        detalhes: e.porProduto,
      }));
      setColunaEmpresa(dados);
      setSelecionadoEmpresa(null);
      setCarregandoColunaEmpresa(false);
    });
  }, [filtroColunaEmpresa]);

  // ---- 4) Treinamentos por produto (barra horizontal) ----
  useEffect(() => {
    setCarregandoTreinamentosProduto(true);
    const params = {};
    if (filtroTreinamentosProduto.dataInicio && filtroTreinamentosProduto.dataFim) {
      params.dataInicio = filtroTreinamentosProduto.dataInicio;
      params.dataFim = filtroTreinamentosProduto.dataFim;
    }
    api.get('/dashboard/treinamentos-por-produto', { params }).then((res) => {
      setTreinamentosPorProduto(res.data.dados);
      setCarregandoTreinamentosProduto(false);
    });
  }, [filtroTreinamentosProduto]);

  // ---- 5) Coluna por produto ----
  useEffect(() => {
    setCarregandoColunaProduto(true);
    const params = {};
    if (filtroColunaProduto.dataInicio && filtroColunaProduto.dataFim) {
      params.dataInicio = filtroColunaProduto.dataInicio;
      params.dataFim = filtroColunaProduto.dataFim;
    }
    api.get('/dashboard/coluna-produto', { params }).then((res) => {
      const dados = res.data.dados.map((p) => ({
        nome: p.nome,
        total: p.total,
        mediaPresencaPorTreinamento: p.mediaPresencaPorTreinamento,
        detalhes: p.porEmpresa,
      }));
      setColunaProduto(dados);
      setSelecionadoProduto(null);
      setCarregandoColunaProduto(false);
    });
  }, [filtroColunaProduto]);

  const totalAptosPizza = pizza.reduce((soma, e) => soma + e.aptos, 0);

  return (
    <Layout>
      <h2>Dashboard Comercial</h2>

      {/* ==================== 1) Tabela por produto ==================== */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Visão geral por produto</h3>
        <div className="filtros">
          <select
            value={filtroTabela.empresaId}
            onChange={(e) => setFiltroTabela((f) => ({ ...f, empresaId: e.target.value }))}
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <input type="date" value={filtroTabela.dataInicio} onChange={(e) => setFiltroTabela((f) => ({ ...f, dataInicio: e.target.value }))} />
          <span style={{ alignSelf: 'center' }}>até</span>
          <input type="date" value={filtroTabela.dataFim} onChange={(e) => setFiltroTabela((f) => ({ ...f, dataFim: e.target.value }))} />
        </div>

        {carregandoTabela ? <p>Carregando...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '8px 6px' }}>Produto</th>
                  <th style={{ padding: '8px 6px' }}>Treinamentos realizados</th>
                  <th style={{ padding: '8px 6px' }}>Presentes</th>
                  <th style={{ padding: '8px 6px' }}>Aptos a tirar plantão</th>
                </tr>
              </thead>
              <tbody>
                {tabela.map((linha) => (
                  <tr key={linha.produtoId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: linha.cor, marginRight: 6 }} />
                      {linha.nome}
                    </td>
                    <td style={{ padding: '8px 6px' }}>{linha.treinamentosRealizados}</td>
                    <td style={{ padding: '8px 6px' }}>{linha.presentes}</td>
                    <td style={{ padding: '8px 6px' }}>{linha.aptos}</td>
                  </tr>
                ))}
                {tabela.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 12, color: '#888' }}>Nenhum produto ativo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== 2) Pizza — aptos por empresa ==================== */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Corretores aptos a tirar plantão, por empresa</h3>
        {carregandoPizza ? <p>Carregando...</p> : pizza.length === 0 ? <p style={{ color: '#888' }}>Sem dados.</p> : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pizza}
                dataKey="aptos"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ nome, aptos }) => `${nome}: ${aptos} (${totalAptosPizza ? ((aptos / totalAptosPizza) * 100).toFixed(0) : 0}%)`}
              >
                {pizza.map((_, i) => <Cell key={i} fill={corPor(i)} />)}
              </Pie>
              <Tooltip formatter={(valor, _nome, item) => [`${valor} corretores (${totalAptosPizza ? ((valor / totalAptosPizza) * 100).toFixed(1) : 0}%)`, item.payload.nome]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ==================== 3) Coluna vertical por empresa ==================== */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Corretores treinados por empresa</h3>
        <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>
          Passe o mouse ou toque em uma coluna para ver a média de presença por treinamento e o detalhamento por produto.
        </p>
        <div className="filtros">
          <input
            type="date"
            value={filtroColunaEmpresa.dataInicio}
            placeholder="Início do mês atual"
            onChange={(e) => setFiltroColunaEmpresa((f) => ({ ...f, dataInicio: e.target.value }))}
          />
          <span style={{ alignSelf: 'center' }}>até</span>
          <input
            type="date"
            value={filtroColunaEmpresa.dataFim}
            onChange={(e) => setFiltroColunaEmpresa((f) => ({ ...f, dataFim: e.target.value }))}
          />
          {(filtroColunaEmpresa.dataInicio || filtroColunaEmpresa.dataFim) && (
            <button className="btn-link" onClick={() => setFiltroColunaEmpresa({ dataInicio: '', dataFim: '' })}>
              Voltar para o mês atual
            </button>
          )}
        </div>

        {carregandoColunaEmpresa ? <p>Carregando...</p> : colunaEmpresa.length === 0 ? <p style={{ color: '#888' }}>Sem dados no período.</p> : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={colunaEmpresa} onClick={(e) => e?.activePayload && setSelecionadoEmpresa(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip content={<TooltipDetalhado rotuloDetalhe="Por produto" />} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {colunaEmpresa.map((_, i) => <Cell key={i} fill={corPor(i)} cursor="pointer" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <PainelDetalhe item={selecionadoEmpresa} rotuloDetalhe="Por produto" />
          </>
        )}
      </div>

      {/* ==================== 4) Barra horizontal — treinamentos por produto ==================== */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Quantidade de treinamentos dados, por produto</h3>
        <div className="filtros">
          <input type="date" value={filtroTreinamentosProduto.dataInicio} onChange={(e) => setFiltroTreinamentosProduto((f) => ({ ...f, dataInicio: e.target.value }))} />
          <span style={{ alignSelf: 'center' }}>até</span>
          <input type="date" value={filtroTreinamentosProduto.dataFim} onChange={(e) => setFiltroTreinamentosProduto((f) => ({ ...f, dataFim: e.target.value }))} />
        </div>

        {carregandoTreinamentosProduto ? <p>Carregando...</p> : treinamentosPorProduto.length === 0 ? <p style={{ color: '#888' }}>Sem dados.</p> : (
          <ResponsiveContainer width="100%" height={Math.max(260, treinamentosPorProduto.length * 42)}>
            <BarChart data={treinamentosPorProduto} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(valor) => [`${valor} treinamentos`, 'Quantidade']} />
              <Bar dataKey="quantidade" radius={[0, 6, 6, 0]}>
                {treinamentosPorProduto.map((d, i) => <Cell key={i} fill={d.cor || corPor(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ==================== 5) Coluna vertical por produto ==================== */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Corretores treinados por produto</h3>
        <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>
          Passe o mouse ou toque em uma coluna para ver a média de presença por treinamento e o detalhamento por empresa.
        </p>
        <div className="filtros">
          <input
            type="date"
            value={filtroColunaProduto.dataInicio}
            onChange={(e) => setFiltroColunaProduto((f) => ({ ...f, dataInicio: e.target.value }))}
          />
          <span style={{ alignSelf: 'center' }}>até</span>
          <input
            type="date"
            value={filtroColunaProduto.dataFim}
            onChange={(e) => setFiltroColunaProduto((f) => ({ ...f, dataFim: e.target.value }))}
          />
          {(filtroColunaProduto.dataInicio || filtroColunaProduto.dataFim) && (
            <button className="btn-link" onClick={() => setFiltroColunaProduto({ dataInicio: '', dataFim: '' })}>
              Voltar para o mês atual
            </button>
          )}
        </div>

        {carregandoColunaProduto ? <p>Carregando...</p> : colunaProduto.length === 0 ? <p style={{ color: '#888' }}>Sem dados no período.</p> : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={colunaProduto} onClick={(e) => e?.activePayload && setSelecionadoProduto(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip content={<TooltipDetalhado rotuloDetalhe="Por empresa" />} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {colunaProduto.map((_, i) => <Cell key={i} fill={corPor(i)} cursor="pointer" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <PainelDetalhe item={selecionadoProduto} rotuloDetalhe="Por empresa" />
          </>
        )}
      </div>
    </Layout>
  );
}
