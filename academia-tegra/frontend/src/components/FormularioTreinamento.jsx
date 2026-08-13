import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import FormularioProva from './FormularioProva';

export default function FormularioTreinamento({ produtos, treinamentoExistente, dataInicial, aoSalvar, aoFechar }) {
  const { usuario } = useAuth();
  const editando = Boolean(treinamentoExistente);

  const [produtoId, setProdutoId] = useState(treinamentoExistente?.produto?.id || '');
  const [supervisorId, setSupervisorId] = useState(treinamentoExistente?.supervisor?.id || '');
  const [supervisores, setSupervisores] = useState([]);
  const [data, setData] = useState(
    treinamentoExistente ? new Date(treinamentoExistente.data).toISOString().slice(0, 10) : (dataInicial || '')
  );
  const [horario, setHorario] = useState(treinamentoExistente?.horario || '');
  const [tema, setTema] = useState(treinamentoExistente?.tema || '');
  const [localTreinamento, setLocalTreinamento] = useState(treinamentoExistente?.localTreinamento || '');
  const [plano, setPlano] = useState(treinamentoExistente?.planoTreinamento || '');
  const [temProva, setTemProva] = useState(treinamentoExistente ? treinamentoExistente.temProva : true);
  const [provaId, setProvaId] = useState(treinamentoExistente?.prova?.id || '');
  const [provasDisponiveis, setProvasDisponiveis] = useState([]);
  const [mostrarFormProva, setMostrarFormProva] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (usuario.perfil === 'ADMIN') {
      api.get('/usuarios/supervisores').then((res) => setSupervisores(res.data));
    }
  }, [usuario.perfil]);

  useEffect(() => {
    if (!produtoId) { setProvasDisponiveis([]); return; }
    api.get('/provas/modelos', { params: { produtoId } }).then((res) => setProvasDisponiveis(res.data));
  }, [produtoId]);

  // Sugestão de nome / preenchimento automático (só ao criar um novo treinamento): busca os
  // treinamentos com certificado já cadastrados para o produto escolhido, para sugerir o nome
  // e, ao selecionar, preencher local/plano/prova com a versão mais recentemente editada.
  useEffect(() => {
    if (editando || !produtoId) { setSugestoes([]); return; }
    api.get('/treinamentos/sugestoes', { params: { produtoId } }).then((res) => setSugestoes(res.data));
  }, [produtoId, editando]);

  function aoEscolherTema(valor) {
    setTema(valor);
    if (editando) return;
    const sugestao = sugestoes.find((s) => s.tema.trim().toLowerCase() === valor.trim().toLowerCase());
    if (!sugestao) return;
    // Preenche os demais campos automaticamente, exceto data e horário; tudo continua editável.
    setLocalTreinamento(sugestao.localTreinamento || '');
    setPlano(sugestao.planoTreinamento || '');
    setTemProva(true);
    setProvaId(sugestao.provaId || '');
  }

  // Quando o admin escolhe um supervisor, só mostramos os produtos vinculados a ele —
  // isso evita que um treinamento seja criado para um supervisor com um produto que ele
  // não gerencia (a mesma regra que já vale quando o próprio supervisor cria).
  const produtosFiltrados = (() => {
    if (usuario.perfil !== 'ADMIN') return produtos;
    if (!supervisorId) return [];
    const supervisorSelecionado = supervisores.find((s) => s.id === supervisorId);
    if (!supervisorSelecionado) return [];
    const idsVinculados = supervisorSelecionado.produtos.map((p) => p.id);
    return produtos.filter((p) => idsVinculados.includes(p.id));
  })();

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (temProva && !provaId) {
      setErro('Selecione uma prova do banco ou cadastre uma nova.');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        produtoId, data, horario, tema,
        localTreinamento,
        planoTreinamento: plano,
        temProva,
        provaId: temProva ? provaId : null,
        ...(usuario.perfil === 'ADMIN' && supervisorId ? { supervisorId } : {}),
      };
      if (editando) {
        const res = await api.put(`/treinamentos/${treinamentoExistente.id}`, payload);
        aoSalvar(res.data);
      } else {
        const res = await api.post('/treinamentos', payload);
        aoSalvar(res.data);
      }
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar o treinamento.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
        <h2>{editando ? 'Editar Treinamento' : 'Novo Treinamento'}</h2>
        <form onSubmit={salvar}>
          <div className="campo">
            <label>Produto</label>
            <select value={produtoId} onChange={(e) => { setProdutoId(e.target.value); setProvaId(''); }} required disabled={usuario.perfil === 'ADMIN' && !supervisorId}>
              <option value="">Selecione...</option>
              {produtosFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {usuario.perfil === 'ADMIN' && !supervisorId && (
              <span style={{ fontSize: 12, color: '#888' }}>Escolha um supervisor primeiro — os produtos mostrados serão apenas os vinculados a ele.</span>
            )}
          </div>

          {usuario.perfil === 'ADMIN' && (
            <div className="campo">
              <label>Supervisor responsável</label>
              <select value={supervisorId} onChange={(e) => { setSupervisorId(e.target.value); setProdutoId(''); setProvaId(''); }} required>
                <option value="">Selecione...</option>
                {supervisores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label>Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label>Horário</label>
              <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required />
            </div>
          </div>
          <div className="campo">
            <label>Tema</label>
            <input
              value={tema}
              onChange={(e) => aoEscolherTema(e.target.value)}
              list={!editando && sugestoes.length > 0 ? 'sugestoes-tema' : undefined}
              required
            />
            {!editando && sugestoes.length > 0 && (
              <datalist id="sugestoes-tema">
                {sugestoes.map((s) => <option key={s.tema} value={s.tema} />)}
              </datalist>
            )}
            {!editando && sugestoes.length > 0 && (
              <span style={{ fontSize: 12, color: '#888' }}>
                Dica: escolha um nome já usado para preencher local, plano e prova automaticamente (você pode editar depois).
              </span>
            )}
          </div>
          <div className="campo">
            <label>Local do treinamento</label>
            <input value={localTreinamento} onChange={(e) => setLocalTreinamento(e.target.value)} placeholder="Ex: Sala de reuniões, Auditório, Filial X..." />
          </div>
          <div className="campo">
            <label>Plano de treinamento</label>
            <textarea rows={3} value={plano} onChange={(e) => setPlano(e.target.value)} required />
          </div>

          <div className="campo">
            <label>
              <input type="checkbox" checked={temProva} onChange={(e) => setTemProva(e.target.checked)} style={{ marginRight: 6 }} />
              Este treinamento terá prova
            </label>
          </div>

          {temProva && (
            <div className="campo">
              <label>Prova (banco reutilizável do produto)</label>
              <select value={provaId} onChange={(e) => setProvaId(e.target.value)} disabled={!produtoId}>
                <option value="">Selecione uma prova...</option>
                {provasDisponiveis.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
              {produtoId && (
                <button type="button" className="btn-link" onClick={() => setMostrarFormProva(true)} style={{ marginTop: 6, textAlign: 'left' }}>
                  + Cadastrar nova prova para este produto
                </button>
              )}
            </div>
          )}

          {!temProva && (
            <p style={{ fontSize: 13, color: '#666' }}>
              Sem prova: a presença deste treinamento será confirmada manualmente pelo supervisor/administrador na lista de interessados.
            </p>
          )}

          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar treinamento'}</button>
            <button className="btn btn-secundario" type="button" onClick={aoFechar}>Cancelar</button>
          </div>
        </form>

        {mostrarFormProva && (
          <FormularioProva
            produtoId={produtoId}
            aoFechar={() => setMostrarFormProva(false)}
            aoCriar={(prova) => {
              setProvasDisponiveis((ps) => [...ps, prova]);
              setProvaId(prova.id);
              setMostrarFormProva(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
