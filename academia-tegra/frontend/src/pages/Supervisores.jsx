import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

export default function Supervisores() {
  const [supervisores, setSupervisores] = useState([]);
  const [detalhe, setDetalhe] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/usuarios/supervisores').then((res) => {
      setSupervisores(res.data);
      setCarregando(false);
    });
  }, []);

  async function abrirDetalhe(id) {
    const res = await api.get(`/usuarios/supervisores/${id}`);
    setDetalhe(res.data);
  }

  return (
    <Layout>
      <h2>Supervisores</h2>

      {carregando ? <p>Carregando...</p> : (
        <div className="grade-cards">
          {supervisores.map((s) => (
            <div key={s.id} className="card" style={{ cursor: 'pointer' }} onClick={() => abrirDetalhe(s.id)}>
              <h3 style={{ margin: '0 0 8px' }}>{s.nome}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {s.produtos.map((p) => (
                  <span key={p.id} className="badge" style={{ background: p.corCalendario, color: '#fff' }}>{p.nome}</span>
                ))}
              </div>
              <p style={{ margin: '4px 0', fontSize: 13 }}>Treinamentos realizados: <strong>{s.totalTreinamentos}</strong></p>
              <p style={{ margin: '4px 0', fontSize: 13 }}>Últimos 30 dias: <strong>{s.treinamentosUltimos30Dias}</strong></p>
            </div>
          ))}
        </div>
      )}

      {detalhe && (
        <div className="modal-fundo" onClick={() => setDetalhe(null)}>
          <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2>{detalhe.nome}</h2>
              <button onClick={() => setDetalhe(null)} style={{ background: 'none', border: 'none', fontSize: 20 }}>✕</button>
            </div>

            <h4>Treinamentos futuros</h4>
            {detalhe.treinamentosFuturos.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nenhum.</p>}
            <ul>
              {detalhe.treinamentosFuturos.map((t) => (
                <li key={t.id}>{new Date(t.data).toLocaleDateString('pt-BR')} — {t.produto} — {t.tema}</li>
              ))}
            </ul>

            <h4>Treinamentos concluídos</h4>
            {detalhe.treinamentosConcluidos.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nenhum.</p>}
            <ul>
              {detalhe.treinamentosConcluidos.map((t) => (
                <li key={t.id}>{new Date(t.data).toLocaleDateString('pt-BR')} — {t.produto} — {t.tema}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Layout>
  );
}
