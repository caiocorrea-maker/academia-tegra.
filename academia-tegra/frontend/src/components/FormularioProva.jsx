import { useState } from 'react';
import api from '../services/api';

const MIN_QUESTOES = 3;
const MAX_QUESTOES = 10;

function questaoVazia() {
  return {
    enunciado: '',
    alternativas: [
      { texto: '', correta: true },
      { texto: '', correta: false },
      { texto: '', correta: false },
      { texto: '', correta: false },
    ],
  };
}

// Mesma regra usada no backend: ~70% de acerto, arredondado.
function minimoAcertos(totalQuestoes) {
  return Math.round(totalQuestoes * 0.7);
}

export default function FormularioProva({ produtoId, aoCriar, aoFechar }) {
  const [titulo, setTitulo] = useState('');
  const [questoes, setQuestoes] = useState(Array.from({ length: MIN_QUESTOES }, questaoVazia));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function atualizarEnunciado(i, valor) {
    setQuestoes((qs) => qs.map((q, idx) => (idx === i ? { ...q, enunciado: valor } : q)));
  }
  function atualizarAlternativa(qi, ai, valor) {
    setQuestoes((qs) => qs.map((q, idx) => idx !== qi ? q : {
      ...q,
      alternativas: q.alternativas.map((a, j) => (j === ai ? { ...a, texto: valor } : a)),
    }));
  }
  function marcarCorreta(qi, ai) {
    setQuestoes((qs) => qs.map((q, idx) => idx !== qi ? q : {
      ...q,
      alternativas: q.alternativas.map((a, j) => ({ ...a, correta: j === ai })),
    }));
  }

  function adicionarQuestao() {
    if (questoes.length >= MAX_QUESTOES) return;
    setQuestoes((qs) => [...qs, questaoVazia()]);
  }

  function removerQuestao(qi) {
    if (questoes.length <= MIN_QUESTOES) return;
    setQuestoes((qs) => qs.filter((_, idx) => idx !== qi));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const res = await api.post('/provas/modelos', { titulo, produtoId, questoes });
      aoCriar(res.data);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar a prova.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <h2>Nova prova (banco de provas)</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Mínimo de {MIN_QUESTOES} e máximo de {MAX_QUESTOES} questões. Aprovação com ~70% de
          acerto — com {questoes.length} questão(ões), são necessários pelo menos{' '}
          <strong>{minimoAcertos(questoes.length)} acerto(s)</strong>.
        </p>
        <form onSubmit={salvar}>
          <div className="campo">
            <label>Título da prova</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>

          {questoes.map((q, qi) => (
            <div key={qi} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 600 }}>Questão {qi + 1}</label>
                {questoes.length > MIN_QUESTOES && (
                  <button
                    type="button"
                    className="btn-link"
                    style={{ color: 'var(--cor-erro)', fontSize: 12 }}
                    onClick={() => removerQuestao(qi)}
                  >
                    Remover questão
                  </button>
                )}
              </div>
              <div className="campo">
                <textarea rows={2} value={q.enunciado} onChange={(e) => atualizarEnunciado(qi, e.target.value)} required />
              </div>
              {q.alternativas.map((a, ai) => (
                <div key={ai} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input
                    type="radio"
                    name={`correta-${qi}`}
                    checked={a.correta}
                    onChange={() => marcarCorreta(qi, ai)}
                  />
                  <input
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #e2e2ea' }}
                    value={a.texto}
                    onChange={(e) => atualizarAlternativa(qi, ai, e.target.value)}
                    placeholder={`Alternativa ${ai + 1}`}
                    required
                  />
                </div>
              ))}
            </div>
          ))}

          <button
            type="button"
            className="btn btn-secundario"
            style={{ marginBottom: 12 }}
            onClick={adicionarQuestao}
            disabled={questoes.length >= MAX_QUESTOES}
          >
            + Adicionar questão {questoes.length >= MAX_QUESTOES && '(máximo atingido)'}
          </button>

          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar prova'}</button>
            <button className="btn btn-secundario" type="button" onClick={aoFechar}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
