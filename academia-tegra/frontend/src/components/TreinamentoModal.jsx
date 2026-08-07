import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import FormularioTreinamento from './FormularioTreinamento';

export default function TreinamentoModal({ treinamentoId, aoFechar, aoAtualizar }) {
  const { usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [liberacao, setLiberacao] = useState(null);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [excluindo, setExcluindo] = useState(false);

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

  async function liberar() {
    setErro('');
    try {
      const res = await api.post(`/treinamentos/${treinamentoId}/liberar`);
      setLiberacao(res.data);
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível liberar.');
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
                {!dados.liberadoEm && (
                  <button className="btn" onClick={liberar}>
                    {dados.temProva ? 'Liberar Prova' : 'Liberar Confirmação de Presença'}
                  </button>
                )}
                {dados.liberadoEm && new Date() < new Date(dados.liberadoExpiraEm) && (
                  <p className="sucesso">Liberado até {new Date(dados.liberadoExpiraEm).toLocaleTimeString('pt-BR')}</p>
                )}
                {dados.liberadoEm && new Date() >= new Date(dados.liberadoExpiraEm) && (
                  <p style={{ color: '#888' }}>Prazo de liberação encerrado (validade de 1h).</p>
                )}
                {liberacao && (
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <img src={liberacao.qrCodeDataUrl} alt="QR Code" style={{ width: 160, height: 160 }} />
                    <p style={{ fontSize: 12, wordBreak: 'break-all' }}>{liberacao.link}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
