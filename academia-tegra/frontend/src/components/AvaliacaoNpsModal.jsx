import { useState } from 'react';
import api from '../services/api';

const NOTAS = Array.from({ length: 11 }, (_, i) => i); // 0 a 10

function SeletorNota({ valor, aoEscolher }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
      {NOTAS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => aoEscolher(n)}
          style={{
            width: 30, height: 30, borderRadius: 6, fontSize: 13,
            border: valor === n ? '2px solid #4f46e5' : '1px solid #ddd',
            background: valor === n ? '#4f46e5' : '#fff',
            color: valor === n ? '#fff' : '#1a1a2e',
            fontWeight: valor === n ? 700 : 400,
            cursor: 'pointer',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// Formulário de avaliação NPS, mostrado ao corretor assim que ele conclui um treinamento
// (presença confirmada, ou aprovado na prova quando houver). Uma resposta por treinamento —
// depois de enviada não pode ser alterada.
export default function AvaliacaoNpsModal({ treinamento, aoFechar, aoEnviar }) {
  const [notaMaterial, setNotaMaterial] = useState(null);
  const [notaSupervisor, setNotaSupervisor] = useState(null);
  const [notaSatisfacao, setNotaSatisfacao] = useState(null);
  const [pontosPositivos, setPontosPositivos] = useState('');
  const [pontosMelhorar, setPontosMelhorar] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [adiando, setAdiando] = useState(false);

  const completo = notaMaterial !== null && notaSupervisor !== null && notaSatisfacao !== null;

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!completo) { setErro('Responda as 3 notas antes de enviar.'); return; }
    setEnviando(true);
    try {
      await api.post(`/nps/${treinamento.id}`, {
        notaMaterial, notaSupervisor, notaSatisfacao,
        pontosPositivos: pontosPositivos || null,
        pontosMelhorar: pontosMelhorar || null,
      });
      aoEnviar?.();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível enviar sua avaliação.');
    } finally {
      setEnviando(false);
    }
  }

  // "Responder depois" conta como um adiamento — na segunda vez, esse treinamento para de
  // aparecer sozinho pra esse corretor (mas continua acessível pelo link do e-mail).
  async function responderDepois() {
    setAdiando(true);
    try {
      await api.post(`/nps/${treinamento.id}/adiar`);
    } catch {
      // melhor esforço — mesmo se falhar, deixa o corretor fechar o modal normalmente
    } finally {
      setAdiando(false);
      aoFechar?.();
    }
  }

  return (
    <div className="modal-fundo">
      <div className="modal-caixa" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 2 }}>Como foi seu treinamento?</h3>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>
          {treinamento.produto?.nome} - {treinamento.tema}
        </h3>

        <form onSubmit={enviar}>
          <div className="campo">
            <label>De 0 a 10, como você avalia a qualidade do material do treinamento?</label>
            <SeletorNota valor={notaMaterial} aoEscolher={setNotaMaterial} />
          </div>
          <div className="campo">
            <label>De 0 a 10, como você avalia a abordagem do supervisor durante o treinamento?</label>
            <SeletorNota valor={notaSupervisor} aoEscolher={setNotaSupervisor} />
          </div>
          <div className="campo">
            <label>De 0 a 10, quão satisfeito você está com o treinamento?</label>
            <SeletorNota valor={notaSatisfacao} aoEscolher={setNotaSatisfacao} />
          </div>
          <div className="campo">
            <label>O que você avalia como positivo no treinamento? (opcional)</label>
            <textarea rows={2} value={pontosPositivos} onChange={(e) => setPontosPositivos(e.target.value)} />
          </div>
          <div className="campo">
            <label>O que você gostaria que melhorasse no treinamento? (opcional)</label>
            <textarea rows={2} value={pontosMelhorar} onChange={(e) => setPontosMelhorar(e.target.value)} />
          </div>

          {erro && <p className="erro">{erro}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar avaliação'}</button>
            <button className="btn btn-secundario" type="button" onClick={responderDepois} disabled={enviando || adiando}>
              {adiando ? '...' : 'Responder depois'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
