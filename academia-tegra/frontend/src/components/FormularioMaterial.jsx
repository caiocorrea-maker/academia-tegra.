import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function FormularioMaterial({ materialExistente, aoSalvar, aoFechar }) {
  const { usuario } = useAuth();
  const editando = Boolean(materialExistente);

  const [produtos, setProdutos] = useState([]);
  const [produtoId, setProdutoId] = useState(materialExistente?.produto?.id || '');
  const [nome, setNome] = useState(materialExistente?.nome || '');
  const [descricao, setDescricao] = useState(materialExistente?.descricao || '');
  const [treinamentoNomeRef, setTreinamentoNomeRef] = useState(materialExistente?.treinamentoNomeRef || '');
  const [sugestoes, setSugestoes] = useState([]);
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const rota = usuario.perfil === 'SUPERVISOR' ? '/produtos?somenteMeus=true' : '/produtos';
    api.get(rota).then((res) => setProdutos(res.data));
  }, [usuario.perfil]);

  useEffect(() => {
    if (!produtoId) { setSugestoes([]); return; }
    api.get('/treinamentos/sugestoes', { params: { produtoId } }).then((res) => setSugestoes(res.data));
  }, [produtoId]);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!editando && !arquivo) {
      setErro('Selecione um arquivo em PDF ou PPT/PPTX.');
      return;
    }
    setSalvando(true);
    try {
      const formData = new FormData();
      formData.append('produtoId', produtoId);
      formData.append('nome', nome);
      formData.append('descricao', descricao);
      formData.append('treinamentoNomeRef', treinamentoNomeRef);
      if (arquivo) formData.append('arquivo', arquivo);

      if (editando) {
        await api.put(`/biblioteca/${materialExistente.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/biblioteca', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      aoSalvar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar o material.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
        <h2>{editando ? 'Editar Material' : 'Novo Material'}</h2>
        <form onSubmit={salvar}>
          <div className="campo">
            <label>Produto</label>
            <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} required disabled={editando}>
              <option value="">Selecione...</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div className="campo">
            <label>Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              list={sugestoes.length > 0 ? 'sugestoes-material' : undefined}
              required
            />
            {sugestoes.length > 0 && (
              <datalist id="sugestoes-material">
                {sugestoes.map((s) => <option key={s.tema} value={s.tema} />)}
              </datalist>
            )}
            <span style={{ fontSize: 12, color: '#888' }}>
              Se o nome corresponder a um treinamento com certificado, só corretores com certificado válido daquele treinamento poderão acessar. Caso contrário, fica disponível a todos.
            </span>
          </div>

          <div className="campo">
            <label>Descrição</label>
            <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="campo">
            <label>Arquivo {editando && '(deixe em branco para manter o atual)'}</label>
            <input type="file" accept=".pdf,.ppt,.pptx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
            <span style={{ fontSize: 12, color: '#888' }}>PDF ou PPT/PPTX, até 20MB.</span>
          </div>

          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar material'}</button>
            <button className="btn btn-secundario" type="button" onClick={aoFechar}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
