import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import FormularioTreinamento from './FormularioTreinamento';
import AvaliacaoNpsModal from './AvaliacaoNpsModal';

export default function TreinamentoModal({ treinamentoId, aoFechar, aoAtualizar }) {
  const { usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [excluindo, setExcluindo] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [alterandoPresenca, setAlterandoPresenca] = useState('');
  const [mostrarNps, setMostrarNps] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [confirmandoLote, setConfirmandoLote] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await api.get(`/treinamentos/${treinamentoId}`);
      setDados(res.data);
    } catch (err) {
      setErro('Não foi possível carregar o treinamento.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [treinamentoId]);

  const agora = new Date();
  const dataHoraTreinamento = dados ? new Date(`${new Date(dados.data).toISOString().slice(0, 10)}T${dados.horario}`) : null;
  const antesDoTreinamento = dataHoraTreinamento && agora < dataHoraTreinamento;
  // Dia do treinamento já passou (comparação por dia, não por horário exato — o dia inteiro
  // do treinamento ainda permite dar presença, só trava a partir do dia seguinte).
  const diaTreinamentoJaPassou = dados
    ? new Date(dados.data).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)
    : false;

  async function toggleInteresse() {
    setErro('');
    try {
      if (dados.meuInteresse) {
        await api.delete(`/treinamentos/${treinamentoId}/interesse`);
      } else {
        await api.post(`/treinamentos/${treinamentoId}/interesse`);
      }
      await carregar();
      aoAtualizar?.();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível atualizar seu interesse.');
    }
  }

  async function liberarProva() {
    setErro('');
    setLiberando(true);
    try {
      await api.post(`/treinamentos/${treinamentoId}/liberar`);
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível liberar a prova.');
    } finally {
      setLiberando(false);
    }
  }

  async function alternarPresenca(corretorId, confirmado) {
    setErro('');
    setAlterandoPresenca(corretorId);
    try {
      await api.put(`/treinamentos/${treinamentoId}/presencas/${corretorId}`, { confirmado });
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível atualizar a presença.');
    } finally {
      setAlterandoPresenca('');
    }
  }

  // Lista de quem ainda pode receber presença (não confirmado e dentro do prazo) — usada
  // pela seleção múltipla e pelo "Selecionar todos".
  const pendentes = (dados?.interessados || []).filter((c) => !c.presencaConfirmada && !diaTreinamentoJaPassou);

  function alternarSelecao(corretorId) {
    setSelecionados((sel) => (sel.includes(corretorId) ? sel.filter((id) => id !== corretorId) : [...sel, corretorId]));
  }

  async function confirmarSelecionados() {
    setErro('');
    setConfirmandoLote(true);
    try {
      await api.put(`/treinamentos/${treinamentoId}/presencas`, { corretorIds: selecionados });
      setSelecionados([]);
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível confirmar a presença dos selecionados.');
    } finally {
      setConfirmandoLote(false);
    }
  }

  async function enviarEvidencias(e) {
    const arquivos = e.target.files;
    if (!arquivos.length) return;
    const formData = new FormData();
    for (const f of arquivos) formData.append('arquivos', f);
    try {
      await api.post(`/treinamentos/${treinamentoId}/evidencias`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await carregar();
    } catch (err) {
      setErro('Falha ao enviar evidências.');
    }
  }

  async function abrirEdicao() {
    if (produtos.length === 0) {
      const res = await api.get('/produtos');
      setProdutos(res.data);
    }
    setEditando(true);
  }

  async function excluirTreinamento() {
    if (!confirm(`Tem certeza que deseja excluir o treinamento "${dados.tema}"? Essa ação não pode ser desfeita.`)) return;
    setExcluindo(true);
    setErro('');
    try {
      await api.delete(`/treinamentos/${treinamentoId}`);
      aoAtualizar?.();
      aoFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível excluir o treinamento.');
      setExcluindo(false);
    }
  }

  const podeGerenciar = usuario.perfil === 'ADMIN' || (usuario.perfil === 'SUPERVISOR' && dados?.supervisor?.id === usuario.id);

  if (editando && dados) {
    return (
      <FormularioTreinamento
        produtos={produtos}
        treinamentoExistente={dados}
        aoFechar={() => setEditando(false)}
        aoSalvar={() => {
          setEditando(false);
          carregar();
          aoAtualizar?.();
        }}
      />
    );
  }

  const provaDentroDoPrazo = dados?.liberadoExpiraEm && new Date() < new Date(dados.liberadoExpiraEm);
  const podeFazerProva = usuario.perfil === 'CORRETOR' && dados?.temProva && dados?.minhaPresencaConfirmada
    && provaDentroDoPrazo && dados?.minhaTentativa?.status !== 'CONCLUIDA';

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
        {carregando && <p>Carregando...</p>}
        {!carregando && dados && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <span className="badge" style={{ background: dados.produto.corCalendario, color: '#fff' }}>{dados.produto.nome}</span>
                <h2 style={{ margin: '10px 0 4px' }}>{dados.tema}</h2>
              </div>
              <button onClick={aoFechar} style={{ background: 'none', border: 'none', fontSize: 20 }}>✕</button>
            </div>

            <p><strong>Supervisor:</strong> {dados.supervisor.nome}</p>
            <p><strong>Data:</strong> {new Date(dados.data).toLocaleDateString('pt-BR')} às {dados.horario}</p>
            {dados.localTreinamento && <p><strong>Local:</strong> {dados.localTreinamento}</p>}
            <p><strong>Plano de treinamento:</strong></p>
            <p style={{ whiteSpace: 'pre-line' }}>{dados.planoTreinamento}</p>

            <div style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
              <span><strong>{dados.qtdInteressados}</strong> interessados</span>
              <span><strong>{dados.presentes}</strong> presentes</span>
              <span><strong>{dados.aprovados}</strong> aprovados</span>
            </div>

            {erro && <p className="erro">{erro}</p>}

            {usuario.perfil === 'CORRETOR' && antesDoTreinamento && (
              <button className={`btn ${dados.meuInteresse ? 'btn-secundario' : ''}`} onClick={toggleInteresse}>
                {dados.meuInteresse ? 'Cancelar interesse' : 'Tenho Interesse'}
              </button>
            )}

            {usuario.perfil === 'CORRETOR' && dados.temProva && (
              <div style={{ marginTop: 12 }}>
                {!dados.minhaPresencaConfirmada && (
                  <p style={{ fontSize: 13, color: '#888' }}>
                    Sua presença ainda não foi confirmada pelo supervisor. Assim que for confirmada, e a prova estiver liberada, o acesso aparece aqui.
                  </p>
                )}
                {dados.minhaTentativa?.status === 'CONCLUIDA' && (
                  <p className={dados.minhaTentativa.aprovado ? 'sucesso' : 'erro'}>
                    {dados.minhaTentativa.aprovado ? '✅ Aprovado' : '❌ Não aprovado'} — {dados.minhaTentativa.percentual.toFixed(0)}%
                  </p>
                )}
                {podeFazerProva && (
                  <Link className="btn" to={`/prova/${dados.id}`}>Fazer prova</Link>
                )}
                {dados.minhaPresencaConfirmada && dados.minhaTentativa?.status !== 'CONCLUIDA' && !provaDentroDoPrazo && dados.liberadoEm && (
                  <p style={{ fontSize: 13, color: '#888' }}>O prazo de 1h para realizar a prova encerrou.</p>
                )}
                {dados.minhaPresencaConfirmada && !dados.liberadoEm && dados.minhaTentativa?.status !== 'CONCLUIDA' && (
                  <p style={{ fontSize: 13, color: '#888' }}>Presença confirmada. Aguarde o supervisor liberar a prova.</p>
                )}
              </div>
            )}

            {usuario.perfil === 'CORRETOR' && dados.elegivelParaNps && !dados.jaAvaliouNps && (
              <div className="card" style={{ marginTop: 12, background: '#f8f9fc' }}>
                <p style={{ margin: '0 0 8px', fontSize: 14 }}>Como foi esse treinamento pra você? Sua avaliação ajuda a melhorar os próximos.</p>
                <button className="btn" onClick={() => setMostrarNps(true)}>Avaliar treinamento</button>
              </div>
            )}

            {podeGerenciar && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <button className="btn btn-secundario" onClick={abrirEdicao}>Editar</button>
                <button className="btn btn-perigo" onClick={excluirTreinamento} disabled={excluindo}>
                  {excluindo ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <strong>Evidências</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {dados.evidencias.map((ev) => (
                  <div key={ev.id} style={{ fontSize: 12, border: '1px solid #eee', borderRadius: 6, padding: 4 }}>
                    📎 {ev.nomeArquivo}
                  </div>
                ))}
                {dados.evidencias.length === 0 && <span style={{ fontSize: 13, color: '#888' }}>Nenhuma evidência anexada.</span>}
              </div>
              {podeGerenciar && (
                <div style={{ marginTop: 8 }}>
                  <input type="file" accept="image/png,image/jpeg" multiple onChange={enviarEvidencias} />
                </div>
              )}
            </div>

            {podeGerenciar && (
              <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <strong>Lista de interessados</strong>
                <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Confirme manualmente a presença de cada corretor que efetivamente compareceu — ou selecione vários e confirme de uma vez.
                </p>

                {pendentes.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selecionados.length === pendentes.length}
                        onChange={(e) => setSelecionados(e.target.checked ? pendentes.map((c) => c.id) : [])}
                      />
                      Selecionar todos
                    </label>
                    {selecionados.length > 0 && (
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={confirmarSelecionados} disabled={confirmandoLote}>
                        {confirmandoLote ? 'Confirmando...' : `Confirmar presença (${selecionados.length})`}
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {(dados.interessados || []).map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 8, padding: '6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!c.presencaConfirmada && !diaTreinamentoJaPassou && (
                          <input
                            type="checkbox"
                            checked={selecionados.includes(c.id)}
                            onChange={() => alternarSelecao(c.id)}
                          />
                        )}
                        <div>
                          <span>{c.nome}</span>
                          {dados.temProva && c.tentativa?.status === 'CONCLUIDA' && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: c.tentativa.aprovado ? '#16a34a' : '#dc2626' }}>
                              {c.tentativa.aprovado ? 'Aprovado' : 'Reprovado'} ({c.tentativa.percentual.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className={`btn ${c.presencaConfirmada ? 'btn-secundario' : ''}`}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        disabled={alterandoPresenca === c.id || (!c.presencaConfirmada && diaTreinamentoJaPassou)}
                        title={!c.presencaConfirmada && diaTreinamentoJaPassou ? 'A data deste treinamento já passou.' : undefined}
                        onClick={() => alternarPresenca(c.id, !c.presencaConfirmada)}
                      >
                        {alterandoPresenca === c.id
                          ? '...'
                          : c.presencaConfirmada
                          ? '✔ Presença confirmada'
                          : diaTreinamentoJaPassou
                          ? 'Data encerrada'
                          : 'Confirmar presença'}
                      </button>
                    </div>
                  ))}
                  {(dados.interessados || []).length === 0 && (
                    <span style={{ fontSize: 13, color: '#888' }}>Nenhum corretor demonstrou interesse ainda.</span>
                  )}
                </div>

                {dados.temProva && (
                  <div style={{ marginTop: 16 }}>
                    {!dados.liberadoEm && (
                      <button className="btn" onClick={liberarProva} disabled={liberando}>
                        {liberando ? 'Liberando...' : 'Liberar Prova'}
                      </button>
                    )}
                    {dados.liberadoEm && provaDentroDoPrazo && (
                      <p className="sucesso">Prova liberada até {new Date(dados.liberadoExpiraEm).toLocaleTimeString('pt-BR')}. Corretores com presença confirmada já podem acessá-la pela tela do treinamento.</p>
                    )}
                    {dados.liberadoEm && !provaDentroDoPrazo && (
                      <p style={{ color: '#888' }}>Prazo de liberação encerrado (validade de 1h).</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {mostrarNps && dados && (
        <AvaliacaoNpsModal
          treinamento={dados}
          aoFechar={() => setMostrarNps(false)}
          aoEnviar={() => { setMostrarNps(false); carregar(); }}
        />
      )}
    </div>
  );
}
