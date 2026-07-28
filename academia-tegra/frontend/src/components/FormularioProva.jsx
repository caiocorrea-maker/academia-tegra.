import { useState } from 'react';
import api from '../services/api';

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

export default function FormularioProva({ produtoId, aoCriar, aoFechar }) {
  const [titulo, setTitulo] = useState('');
  const [questoes, setQuestoes] = useState(Array.from({ length: 10 }, questaoVazia));
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
        <form onSubmit={salvar}>
          <div className="campo">
            <label>Título da prova</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>

          {questoes.map((q, qi) => (
            <div key={qi} className="card" style={{ marginBottom: 12 }}>
              <div className="campo">
                <label>Questão {qi + 1}</label>
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
