import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import TreinamentoModal from '../components/TreinamentoModal';
import api from '../services/api';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Agenda() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-indexed
  const [eventos, setEventos] = useState([]);
  const [treinamentoSelecionado, setTreinamentoSelecionado] = useState(null);

  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);

  async function carregarEventos() {
    const inicio = new Date(ano, mes, 1).toISOString();
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59).toISOString();
    const res = await api.get('/treinamentos/agenda', { params: { inicio, fim } });
    setEventos(res.data);
  }

  useEffect(() => { carregarEventos(); }, [ano, mes]);

  const celulas = useMemo(() => {
    const inicioGrade = new Date(primeiroDiaMes);
    inicioGrade.setDate(inicioGrade.getDate() - inicioGrade.getDay());
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicioGrade);
      d.setDate(inicioGrade.getDate() + i);
      dias.push(d);
    }
    return dias;
  }, [ano, mes]);

  function eventosDoDia(data) {
    return eventos.filter((e) => {
      const dataEvento = new Date(e.data);
      return (
        dataEvento.getFullYear() === data.getFullYear() &&
        dataEvento.getMonth() === data.getMonth() &&
        dataEvento.getDate() === data.getDate()
      );
    });
  }

  function mesAnterior() {
    if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1);
  }
  function mesSeguinte() {
    if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1);
  }

  const anosDisponiveis = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - 2 + i);

  return (
    <Layout>
      <div className="topo-pagina">
        <h2 style={{ margin: 0 }}>Agenda de Treinamentos</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-secundario btn" onClick={mesAnterior}>‹</button>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {NOMES_MES.map((nome, i) => <option key={i} value={i}>{nome}</option>)}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-secundario btn" onClick={mesSeguinte}>›</button>
        </div>
      </div>

      <div className="calendario">
        {DIAS_SEMANA.map((d) => <div className="cab" key={d}>{d}</div>)}
        {celulas.map((data, i) => {
          const foraMes = data.getMonth() !== mes;
          const evs = eventosDoDia(data);
          return (
            <div key={i} className={`dia-celula ${foraMes ? 'fora-mes' : ''}`}>
              <div className="num-dia">{data.getDate()}</div>
              {evs.map((e) => (
                <div
                  key={e.id}
                  className="evento-chip"
                  style={{ background: e.produto.corCalendario }}
                  onClick={() => setTreinamentoSelecionado(e.id)}
                  title={`${e.tema} - ${e.horario}`}
                >
                  {e.horario} {e.produto.nome}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {treinamentoSelecionado && (
        <TreinamentoModal
          treinamentoId={treinamentoSelecionado}
          aoFechar={() => setTreinamentoSelecionado(null)}
          aoAtualizar={carregarEventos}
        />
      )}
    </Layout>
  );
}
