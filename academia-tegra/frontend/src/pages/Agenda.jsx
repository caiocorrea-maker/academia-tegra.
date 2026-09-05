import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import TreinamentoModal from '../components/TreinamentoModal';
import FormularioTreinamento from '../components/FormularioTreinamento';
import AvaliacaoNpsModal from '../components/AvaliacaoNpsModal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Agenda() {
  const { usuario } = useAuth();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-indexed
  const [eventos, setEventos] = useState([]);
  const [treinamentoSelecionado, setTreinamentoSelecionado] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [dataParaCriar, setDataParaCriar] = useState(null);
  const [produtoFiltroId, setProdutoFiltroId] = useState('');
  const [apenasMeusTreinamentos, setApenasMeusTreinamentos] = useState(false);
  const [filaNps, setFilaNps] = useState([]); // treinamentos pendentes de avaliação (CORRETOR)
  const [searchParams, setSearchParams] = useSearchParams();

  const podeGerenciar = usuario.perfil === 'ADMIN' || usuario.perfil === 'SUPERVISOR';
  const ehCorretor = usuario.perfil === 'CORRETOR';

  const primeiroDiaMes = new Date(ano, mes, 1);

  async function carregarEventos() {
    const inicio = new Date(ano, mes, 1).toISOString();
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59).toISOString();
    const res = await api.get('/treinamentos/agenda', { params: { inicio, fim } });
    setEventos(res.data);
  }

  useEffect(() => { carregarEventos(); }, [ano, mes]);
  // Lista de produtos para o filtro "Produto" na Agenda — disponível a todos os perfis
  // (antes só era carregada para Admin/Supervisor, que usam essa lista também no formulário
  // de criação de treinamento).
  useEffect(() => {
    api.get('/produtos').then((res) => setProdutos(res.data));
  }, []);

  // Avaliação NPS: ao abrir a Agenda, o corretor é avisado dos treinamentos que já pode
  // avaliar (presença confirmada, ou prova concluída) e ainda não avaliou.
  useEffect(() => {
    if (!ehCorretor) return;
    api.get('/nps/pendentes').then((res) => setFilaNps(res.data));
  }, [ehCorretor]);

  // Link do convite por e-mail (?avaliar=treinamentoId): traz esse treinamento pra frente da
  // fila mesmo que já tenha sido adiado 2x na lista automática, já que o corretor pediu
  // explicitamente clicando no link.
  useEffect(() => {
    const avaliarId = searchParams.get('avaliar');
    if (!avaliarId || !ehCorretor) return;
    api.get(`/nps/link/${avaliarId}`).then((res) => {
      if (res.data) setFilaNps((fila) => [res.data, ...fila.filter((f) => f.id !== res.data.id)]);
      const novosParams = new URLSearchParams(searchParams);
      novosParams.delete('avaliar');
      setSearchParams(novosParams, { replace: true });
    });
  }, [searchParams, ehCorretor]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((e) => {
      if (produtoFiltroId && e.produto.id !== produtoFiltroId) return false;
      if (ehCorretor && apenasMeusTreinamentos && !e.meuInteresse) return false;
      return true;
    });
  }, [eventos, produtoFiltroId, apenasMeusTreinamentos, ehCorretor]);

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
    return eventosFiltrados.filter((e) => {
      const dataEvento = new Date(e.data);
      return (
        dataEvento.getFullYear() === data.getFullYear() &&
        dataEvento.getMonth() === data.getMonth() &&
        dataEvento.getDate() === data.getDate()
      );
    });
  }

  function formatarDataParaInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  function clicarDia(data) {
    if (!podeGerenciar) return;
    setDataParaCriar(formatarDataParaInput(data));
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

      {podeGerenciar && (
        <p style={{ fontSize: 13, color: '#888', marginTop: -10, marginBottom: 14 }}>
          Dica: clique em um dia vazio do calendário para agendar um novo treinamento nessa data.
        </p>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="campo" style={{ margin: 0, minWidth: 200 }}>
          <select value={produtoFiltroId} onChange={(e) => setProdutoFiltroId(e.target.value)}>
            <option value="">Todos os produtos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        {ehCorretor && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={apenasMeusTreinamentos}
              onChange={(e) => setApenasMeusTreinamentos(e.target.checked)}
            />
            Meus treinamentos
          </label>
        )}
      </div>

      <div className="calendario">
        {DIAS_SEMANA.map((d) => <div className="cab" key={d}>{d}</div>)}
        {celulas.map((data, i) => {
          const foraMes = data.getMonth() !== mes;
          const evs = eventosDoDia(data);
          return (
            <div
              key={i}
              className={`dia-celula ${foraMes ? 'fora-mes' : ''}`}
              style={{ cursor: podeGerenciar ? 'pointer' : 'default' }}
              onClick={() => clicarDia(data)}
            >
              <div className="num-dia">{data.getDate()}</div>
              {evs.map((e) => (
                <div
                  key={e.id}
                  className="evento-chip"
                  style={{ background: e.produto.corCalendario }}
                  onClick={(ev) => { ev.stopPropagation(); setTreinamentoSelecionado(e.id); }}
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

      {dataParaCriar && (
        <FormularioTreinamento
          produtos={produtos}
          dataInicial={dataParaCriar}
          aoFechar={() => setDataParaCriar(null)}
          aoSalvar={() => {
            setDataParaCriar(null);
            carregarEventos();
          }}
        />
      )}

      {filaNps.length > 0 && (
        <AvaliacaoNpsModal
          treinamento={filaNps[0]}
          aoFechar={() => setFilaNps((fila) => fila.slice(1))}
          aoEnviar={() => setFilaNps((fila) => fila.slice(1))}
        />
      )}
    </Layout>
  );
}
