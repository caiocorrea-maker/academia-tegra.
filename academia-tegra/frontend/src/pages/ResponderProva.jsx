import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function ResponderProva() {
  const { treinamentoId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [dados, setDados] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    api.get(`/provas/treinamento/${treinamentoId}/iniciar`)
      .then((res) => setDados(res.data))
      .catch((err) => setErro(err.response?.data?.erro || 'Não foi possível iniciar a prova.'));
  }, [treinamentoId]);

  function selecionar(questaoId, alternativaId) {
    setRespostas((r) => ({ ...r, [questaoId]: alternativaId }));
  }

  async function enviar() {
    setErro('');
    if (Object.keys(respostas).length < (dados?.questoes.length || 0)) {
      setErro('Responda todas as questões antes de enviar.');
      return;
    }
    setEnviando(true);
    try {
      const payload = { respostas: Object.entries(respostas).map(([questaoId, alternativaId]) => ({ questaoId, alternativaId })) };
      const res = await api.post(`/provas/treinamento/${treinamentoId}/responder`, payload);
      setResultado(res.data);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível enviar a prova.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <h2>Prova</h2>

      {erro && <p className="erro">{erro}</p>}

      {resultado && (
        <div className="card">
          <h3>{resultado.aprovado ? '✅ Aprovado!' : '❌ Não aprovado'}</h3>
          <p>Você acertou {resultado.acertos} de {resultado.totalQuestoes} questões ({resultado.percentual.toFixed(0)}%).</p>
          {resultado.certificadoGerado && <p className="sucesso">Certificado emitido! Confira no seu perfil.</p>}
          <button className="btn" onClick={() => navigate('/agenda')}>Voltar à Agenda</button>
        </div>
      )}

      {!resultado && dados && (
        <>
          <p style={{ color: '#888', fontSize: 13 }}>
            Prazo final para envio: {new Date(dados.prazoFinal).toLocaleTimeString('pt-BR')}
            {' · '}Mínimo para aprovação: {dados.minimoAcertos} de {dados.questoes.length} questões
          </p>
          {dados.questoes.map((q, i) => (
            <div key={q.id} className="card" style={{ marginBottom: 12 }}>
              <p><strong>{i + 1}.</strong> {q.enunciado}</p>
              {q.alternativas.map((a) => (
                <label key={a.id} style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={respostas[q.id] === a.id}
                    onChange={() => selecionar(q.id, a.id)}
                    style={{ marginRight: 8 }}
                  />
                  {a.texto}
                </label>
              ))}
            </div>
          ))}
          <button className="btn" onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar prova'}
          </button>
        </>
      )}
    </Layout>
  );
}
