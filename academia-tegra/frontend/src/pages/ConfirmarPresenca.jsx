import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function ConfirmarPresenca() {
  const { treinamentoId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [status, setStatus] = useState('inicial'); // inicial | enviando | ok | erro
  const [erro, setErro] = useState('');

  async function confirmar() {
    setStatus('enviando');
    setErro('');
    try {
      await api.post(`/treinamentos/${treinamentoId}/confirmar-presenca`, { token });
      setStatus('ok');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível confirmar sua presença.');
      setStatus('erro');
    }
  }

  return (
    <Layout>
      <div className="card" style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
        <h2>Confirmação de presença</h2>
        {status === 'inicial' && (
          <>
            <p>Toque no botão abaixo para confirmar sua presença neste treinamento.</p>
            <button className="btn" onClick={confirmar}>Confirmar presença</button>
          </>
        )}
        {status === 'enviando' && <p>Confirmando...</p>}
        {status === 'ok' && (
          <>
            <p className="sucesso">Presença confirmada com sucesso!</p>
            <button className="btn" onClick={() => navigate('/agenda')}>Voltar à Agenda</button>
          </>
        )}
        {status === 'erro' && <p className="erro">{erro}</p>}
      </div>
    </Layout>
  );
}
