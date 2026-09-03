import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import FormularioTreinamento from '../components/FormularioTreinamento';
import TreinamentoModal from '../components/TreinamentoModal';
import GerenciarProvasModal from '../components/GerenciarProvasModal';
import api from '../services/api';

export default function Treinamentos() {
  const [searchParams] = useSearchParams();
  const [produtos, setProdutos] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [filtros, setFiltros] = useState({
    produtoId: '',
    supervisorId: searchParams.get('supervisorId') || '',
    dataInicio: '',
    dataFim: '',
  });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarProvas, setMostrarProvas] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const supervisorNomeFiltro = searchParams.get('supervisorNome');

  async function carregarBase() {
    const [pRes, sRes] = await Promise.all([
      api.get('/produtos'),
      api.get('/usuarios/supervisores'),
    ]);
    setProdutos(pRes.data);
    setSupervisores(sRes.data);
  }

  async function carregarHistorico() {
    setCarregando(true);
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    const res = await api.get('/treinamentos/historico', { params });
    setHistorico(res.data);
    setCarregando(false);
  }

  useEffect(() => { carregarBase(); }, []);
  useEffect(() => { carregarHistorico(); }, [filtros]);

  async function exportar(tipo) {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    const rota = tipo === 'presenca' ? '/exportar/presencas' : '/exportar/treinamentos';
    const nomeArquivo = tipo === 'presenca' ? 'presenca_academia_tegra.xlsx' : 'extracao_resumo_treinamentos_academia_tegra.xlsx';
    const res = await api.get(rota, { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
  }

  return (
    <Layout>
      <div className="topo-pagina">
        <h2 style={{ margin: 0 }}>Treinamentos</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secundario" onClick={() => exportar('resumo')}>Extração resumo treinamentos</button>
          <button className="btn btn-secundario" onClick={() => exportar('presenca')}>Extração de presença</button>
          <button className="btn btn-secundario" onClick={() => setMostrarProvas(true)}>Gerenciar Provas</button>
          <button className="btn" onClick={() => setMostrarForm(true)}>+ Novo Treinamento</button>
        </div>
      </div>

      {supervisorNomeFiltro && filtros.supervisorId && (
        <p style={{ fontSize: 13, color: '#666', marginTop: -10, marginBottom: 14 }}>
          Filtrando por supervisor: <strong>{supervisorNomeFiltro}</strong>{' '}
          <button className="btn-link" onClick={() => setFiltros((f) => ({ ...f, supervisorId: '' }))}>(limpar)</button>
        </p>
      )}

      <div className="filtros">
        <select value={filtros.produtoId} onChange={(e) => setFiltros((f) => ({ ...f, produtoId: e.target.value }))}>
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={filtros.supervisorId} onChange={(e) => setFiltros((f) => ({ ...f, supervisorId: e.target.value }))}>
          <option value="">Todos os supervisores</option>
          {supervisores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))} />
        <input type="date" value={filtros.dataFim} onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))} />
      </div>

      <div className="card">
        {carregando ? (
          <p>Carregando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Produto</th><th>Supervisor</th><th>Tema</th><th>Data</th><th>Horário</th>
                <th>Interessados</th><th>Presentes</th><th>Aprovados</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelecionado(t.id)}>
                  <td><span className="badge" style={{ background: t.cor, color: '#fff' }}>{t.produto}</span></td>
                  <td>{t.supervisor}</td>
                  <td>{t.tema}</td>
                  <td>{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                  <td>{t.horario}</td>
                  <td>{t.interessados}</td>
                  <td>{t.presentes}{t.taxaPresenca != null && <span style={{ color: '#888' }}> ({t.taxaPresenca}%)</span>}</td>
                  <td>{t.aprovados}{t.taxaAprovacao != null && <span style={{ color: '#888' }}> ({t.taxaAprovacao}%)</span>}</td>
                </tr>
              ))}
              {historico.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>Nenhum treinamento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {mostrarForm && (
        <FormularioTreinamento
          produtos={produtos}
          aoFechar={() => setMostrarForm(false)}
          aoSalvar={() => { setMostrarForm(false); carregarHistorico(); }}
        />
      )}

      {selecionado && (
        <TreinamentoModal
          treinamentoId={selecionado}
          aoFechar={() => setSelecionado(null)}
          aoAtualizar={carregarHistorico}
        />
      )}

      {mostrarProvas && (
        <GerenciarProvasModal produtos={produtos} aoFechar={() => setMostrarProvas(false)} />
      )}
    </Layout>
  );
}
