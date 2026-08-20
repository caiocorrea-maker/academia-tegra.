import { useEffect, useState } from 'react';
import api from '../services/api';

export default function GerenciarProvasModal({ produtos, aoFechar }) {
  const [produtoId, setProdutoId] = useState('');
  const [provas, setProvas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [erro, setErro] = useState('');

  async function carregar() {
    if (!produtoId) { setProvas([]); return; }
    setCarregando(true);
    const res = await api.get('/provas/modelos', { params: { produtoId } });
    setProvas(res.data);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [produtoId]);

  function abrirEdicao(prova) {
    setEditandoId(prova.id);
    setTituloEdicao(prova.titulo);
    setErro('');
  }

  async function salvarTitulo(prova) {
    setErro('');
    try {
      await api.put(`/provas/modelos/${prova.id}`, { titulo: tituloEdicao });
      setEditandoId(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    }
  }

  async function excluir(prova) {
    if (!confirm(`Excluir a prova "${prova.titulo}"? Só é possível se ela nunca foi usada em um treinamento.`)) return;
    try {
      await api.delete(`/provas/modelos/${prova.id}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Não foi possível excluir esta prova.');
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>Gerenciar Provas</h2>
          <button onClick={aoFechar} style={{ background: 'none', border: 'none', fontSize: 20 }}>✕</button>
        </div>

        <div className="campo">
          <label>Produto</label>
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
            <option value="">Selecione um produto...</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        {erro && <p className="erro">{erro}</p>}

        {carregando && <p>Carregando...</p>}

        {!carregando && produtoId && provas.length === 0 && (
          <p style={{ color: '#888', fontSize: 13 }}>Nenhuma prova cadastrada para este produto ainda.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {provas.map((prova) => (
            <div key={prova.id} className="card">
              {editandoId === prova.id ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #e2e2ea' }}
                    value={tituloEdicao}
                    onChange={(e) => setTituloEdicao(e.target.value)}
                  />
                  <button className="btn" type="button" onClick={() => salvarTitulo(prova)}>Salvar</button>
                  <button className="btn btn-secundario" type="button" onClick={() => setEditandoId(null)}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{prova.titulo}</strong>
                    <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>{prova._count?.questoes ?? '?'} questões</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-link" onClick={() => abrirEdicao(prova)}>Editar título</button>
                    <button className="btn-link" style={{ color: '#dc2626' }} onClick={() => excluir(prova)}>Excluir</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#888', marginTop: 14 }}>
          Obs: se uma prova já foi usada em algum treinamento, só é possível editar o título — as questões ficam travadas para preservar o histórico de quem já respondeu. Provas nunca usadas podem ser excluídas.
        </p>
      </div>
    </div>
  );
}
