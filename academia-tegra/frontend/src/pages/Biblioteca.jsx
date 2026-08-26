import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import FormularioMaterial from '../components/FormularioMaterial';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function formatarTamanho(bytes) {
  if (!bytes) return '-';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default function Biblioteca() {
  const { usuario } = useAuth();
  const podeGerenciar = usuario.perfil === 'ADMIN' || usuario.perfil === 'SUPERVISOR';

  const [produtos, setProdutos] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [filtroProduto, setFiltroProduto] = useState('');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [baixando, setBaixando] = useState('');

  useEffect(() => {
    api.get('/produtos').then((res) => setProdutos(res.data));
  }, []);

  async function carregarMateriais() {
    setCarregando(true);
    const params = {};
    if (filtroProduto) params.produtoId = filtroProduto;
    if (busca) params.busca = busca;
    const res = await api.get('/biblioteca', { params });
    setMateriais(res.data);
    setCarregando(false);
  }

  useEffect(() => { carregarMateriais(); }, [filtroProduto, busca]);

  async function baixar(material) {
    setBaixando(material.id);
    // Correção iOS: o Safari do iPhone só permite abrir uma nova aba (window.open) dentro
    // do mesmo clique síncrono do usuário — se abrirmos depois do "await" da chamada à
    // API, ele bloqueia silenciosamente. Por isso a aba é aberta em branco aqui, ANTES do
    // await, e só recebe a URL real do arquivo quando a resposta chega.
    const novaAba = window.open('', '_blank');
    try {
      const res = await api.get(`/biblioteca/${material.id}/url`);
      if (novaAba) {
        novaAba.location.href = res.data.url;
      } else {
        // Caso o navegador ainda assim tenha bloqueado o popup, navega na aba atual.
        window.location.href = res.data.url;
      }
    } catch (err) {
      if (novaAba) novaAba.close();
      alert(err.response?.data?.erro || 'Não foi possível abrir este material.');
    } finally {
      setBaixando('');
    }
  }

  async function excluir(material) {
    if (!confirm(`Tem certeza que deseja excluir "${material.nome}"?`)) return;
    try {
      await api.delete(`/biblioteca/${material.id}`);
      carregarMateriais();
    } catch (err) {
      alert(err.response?.data?.erro || 'Não foi possível excluir este material.');
    }
  }

  return (
    <Layout>
      <div className="topo-pagina">
        <h2 style={{ margin: 0 }}>Biblioteca de Treinamentos</h2>
        {podeGerenciar && (
          <button className="btn" onClick={() => { setEditando(null); setMostrarForm(true); }}>+ Novo Material</button>
        )}
      </div>

      <div className="filtros">
        <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)}>
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <input placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <div className="grade-cards">
          {materiais.map((m) => (
            <div key={m.id} className="card material-card">
              <span className="badge material-produto" style={{ background: m.produto.corCalendario, color: '#fff' }}>{m.produto.nome}</span>
              <strong>{m.nome}</strong>
              {m.descricao && <p style={{ fontSize: 13, margin: '2px 0' }}>{m.descricao}</p>}
              <span className="material-meta">{m.nomeArquivo} · {formatarTamanho(m.tamanhoBytes)}</span>
              {m.treinamentoNomeRef && (
                <span className="material-meta">Requer certificado válido em: {m.treinamentoNomeRef}</span>
              )}

              {m.podeAcessar ? (
                <button className="btn btn-secundario" style={{ marginTop: 8 }} onClick={() => baixar(m)} disabled={baixando === m.id}>
                  {baixando === m.id ? 'Abrindo...' : 'Baixar'}
                </button>
              ) : (
                <span className="material-bloqueado">🔒 Requer certificado válido para acessar.</span>
              )}

              {podeGerenciar && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn-link" onClick={() => { setEditando(m); setMostrarForm(true); }}>Editar</button>
                  <button className="btn-link" style={{ color: 'var(--cor-erro)' }} onClick={() => excluir(m)}>Excluir</button>
                </div>
              )}
            </div>
          ))}
          {materiais.length === 0 && <p style={{ color: '#888' }}>Nenhum material encontrado.</p>}
        </div>
      )}

      {mostrarForm && (
        <FormularioMaterial
          materialExistente={editando}
          aoFechar={() => setMostrarForm(false)}
          aoSalvar={() => { setMostrarForm(false); carregarMateriais(); }}
        />
      )}
    </Layout>
  );
}
