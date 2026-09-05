import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

function formatarNota(n) {
  return n == null ? '-' : n.toFixed(1);
}

function DetalheAvaliacoes({ treinamentoId, aoFechar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get(`/nps/treinamento/${treinamentoId}`).then((res) => {
      setDados(res.data);
      setCarregando(false);
    });
  }, [treinamentoId]);

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        {carregando && <p>Carregando...</p>}
        {!carregando && dados && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <span className="badge">{dados.treinamento.produto}</span>
                <h2 style={{ margin: '10px 0 4px' }}>{dados.treinamento.tema}</h2>
                <p style={{ color: '#888', margin: 0 }}>{new Date(dados.treinamento.data).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={aoFechar} style={{ background: 'none', border: 'none', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 20, margin: '14px 0' }}>
              <span>Material: <strong>{formatarNota(dados.medias.notaMaterial)}</strong></span>
              <span>Supervisor: <strong>{formatarNota(dados.medias.notaSupervisor)}</strong></span>
              <span>Satisfação: <strong>{formatarNota(dados.medias.notaSatisfacao)}</strong></span>
              <span>{dados.medias.qtd} resposta(s)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 400, overflowY: 'auto' }}>
              {dados.respostas.map((r) => (
                <div key={r.id} className="card" style={{ background: '#f8f9fc' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{r.corretor}</p>
                  <p style={{ margin: '2px 0', fontSize: 13 }}>Material: {r.notaMaterial} · Supervisor: {r.notaSupervisor} · Satisfação: {r.notaSatisfacao}</p>
                  {r.pontosPositivos && <p style={{ margin: '6px 0 0', fontSize: 13 }}><strong>Positivo:</strong> {r.pontosPositivos}</p>}
                  {r.pontosMelhorar && <p style={{ margin: '4px 0 0', fontSize: 13 }}><strong>A melhorar:</strong> {r.pontosMelhorar}</p>}
                </div>
              ))}
              {dados.respostas.length === 0 && <p style={{ color: '#888' }}>Nenhuma resposta ainda.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Avaliacoes() {
  const [produtos, setProdutos] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [produtoId, setProdutoId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => { api.get('/produtos').then((res) => setProdutos(res.data)); }, []);

  async function carregar() {
    setCarregando(true);
    const params = produtoId ? { produtoId } : {};
    const res = await api.get('/nps', { params });
    setResumo(res.data);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [produtoId]);

  async function exportar() {
    setExportando(true);
    try {
      const params = produtoId ? { produtoId } : {};
      const res = await api.get('/exportar/avaliacoes-nps', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'avaliacoes_nps_academia_tegra.xlsx';
      link.click();
    } catch (err) {
      alert('Não foi possível gerar a extração de avaliações.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <Layout>
      <div className="topo-pagina">
        <h2 style={{ margin: 0 }}>Pesquisa de Satisfação</h2>
        <button className="btn btn-secundario" onClick={exportar} disabled={exportando}>
          {exportando ? 'Gerando...' : 'NPS Resumo'}
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginTop: -10, marginBottom: 14 }}>
        Clique em um treinamento para ver as respostas individuais, incluindo os comentários de texto livre.
      </p>

      <div className="filtros">
        <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      <div className="card">
        {carregando ? (
          <p>Carregando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Produto</th><th>Tema</th><th>Data</th><th>Respostas</th>
                <th>Material</th><th>Supervisor</th><th>Satisfação</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelecionado(t.id)}>
                  <td><span className="badge" style={{ background: t.cor, color: '#fff' }}>{t.produto}</span></td>
                  <td>{t.tema}</td>
                  <td>{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                  <td>{t.qtd}</td>
                  <td>{formatarNota(t.notaMaterial)}</td>
                  <td>{formatarNota(t.notaSupervisor)}</td>
                  <td>{formatarNota(t.notaSatisfacao)}</td>
                </tr>
              ))}
              {resumo.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>Nenhuma avaliação recebida ainda.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selecionado && (
        <DetalheAvaliacoes treinamentoId={selecionado} aoFechar={() => setSelecionado(null)} />
      )}
    </Layout>
  );
}
