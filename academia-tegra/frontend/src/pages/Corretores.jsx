import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function Corretores() {
  const [corretores, setCorretores] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [busca, setBusca] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const navigate = useNavigate();

  useEffect(() => { api.get('/empresas').then((res) => setEmpresas(res.data)); }, []);

  useEffect(() => {
    const params = {};
    if (busca) params.busca = busca;
    if (empresaId) params.empresaId = empresaId;
    api.get('/corretores', { params }).then((res) => setCorretores(res.data));
  }, [busca, empresaId]);

  return (
    <Layout>
      <h2>Corretores</h2>

      <div className="filtros">
        <input placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
        </select>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Nome</th><th>Empresa de vendas</th></tr></thead>
          <tbody>
            {corretores.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/corretores/${c.id}`)}>
                <td>{c.nome}</td>
                <td>{c.empresa?.nome}</td>
              </tr>
            ))}
            {corretores.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: 'center', color: '#888' }}>Nenhum corretor encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
