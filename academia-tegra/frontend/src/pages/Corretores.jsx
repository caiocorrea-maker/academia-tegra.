import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Corretores() {
  const { usuario } = useAuth();
  const [corretores, setCorretores] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [busca, setBusca] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [exportandoAptos, setExportandoAptos] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api.get('/empresas').then((res) => setEmpresas(res.data)); }, []);

  async function carregar() {
    const params = {};
    if (busca) params.busca = busca;
    if (empresaId) params.empresaId = empresaId;
    const res = await api.get('/corretores', { params });
    setCorretores(res.data);
  }

  useEffect(() => { carregar(); }, [busca, empresaId]);

  async function excluir(e, corretor) {
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir o corretor "${corretor.nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/corretores/${corretor.id}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Não foi possível excluir este corretor.');
    }
  }

  async function exportarAptos() {
    setExportandoAptos(true);
    try {
      // Sem produtoId: traz aptos de todos os produtos (para Supervisor, só os vinculados a
      // ele — o backend já filtra isso automaticamente).
      const res = await api.get('/exportar/corretores-aptos', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'corretores_aptos_academia_tegra.xlsx';
      link.click();
    } catch (err) {
      alert('Não foi possível gerar a extração de corretores aptos.');
    } finally {
      setExportandoAptos(false);
    }
  }

  return (
    <Layout>
      <div className="topo-pagina">
        <h2 style={{ margin: 0 }}>Corretores</h2>
        {usuario.perfil !== 'CORRETOR' && (
          <button className="btn btn-secundario" onClick={exportarAptos} disabled={exportandoAptos}>
            {exportandoAptos ? 'Gerando...' : 'Corretores aptos'}
          </button>
        )}
      </div>

      <div className="filtros">
        <input placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Empresa de vendas</th>
              {usuario.perfil === 'ADMIN' && <th></th>}
            </tr>
          </thead>
          <tbody>
            {corretores.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/corretores/${c.id}`)}>
                <td>{c.nome}</td>
                <td>{c.empresa?.nome}</td>
                {usuario.perfil === 'ADMIN' && (
                  <td>
                    <button className="btn-link" style={{ color: '#dc2626' }} onClick={(e) => excluir(e, c)}>
                      Excluir
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {corretores.length === 0 && (
              <tr><td colSpan={usuario.perfil === 'ADMIN' ? 3 : 2} style={{ textAlign: 'center', color: '#888' }}>Nenhum corretor encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
