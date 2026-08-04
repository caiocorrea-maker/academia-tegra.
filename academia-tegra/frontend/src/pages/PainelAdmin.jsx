import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

const CORES_SUGERIDAS = ['#4f46e5', '#dc2626', '#16a34a', '#ea580c', '#0891b2', '#c026d3', '#ca8a04', '#0284c7'];

export default function PainelAdmin() {
  const [aba, setAba] = useState('usuarios');

  return (
    <Layout>
      <h2>Painel do Administrador</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['usuarios', 'Administradores e Supervisores'], ['produtos', 'Produtos'], ['empresas', 'Empresas de Vendas']].map(([k, label]) => (
          <button
            key={k}
            className={`btn ${aba === k ? '' : 'btn-secundario'}`}
            onClick={() => setAba(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'usuarios' && <AbaUsuarios />}
      {aba === 'produtos' && <AbaProdutos />}
      {aba === 'empresas' && <AbaEmpresas />}
    </Layout>
  );
}

// ---------------- Usuários (Admin/Supervisor) ----------------

function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'SUPERVISOR', senha: '', produtoIds: [] });
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('');

  async function carregar() {
    const params = {};
    if (busca) params.busca = busca;
    if (filtroPerfil) params.perfil = filtroPerfil;
    if (filtroProduto) params.produtoId = filtroProduto;
    const [uRes, pRes] = await Promise.all([
      api.get('/usuarios/internos', { params }),
      api.get('/produtos'),
    ]);
    setUsuarios(uRes.data);
    setProdutos(pRes.data);
  }
  useEffect(() => { carregar(); }, [busca, filtroPerfil, filtroProduto]);

  function abrirNovo() {
    setEditando(null);
    setForm({ nome: '', email: '', perfil: 'SUPERVISOR', senha: '', produtoIds: [] });
    setMostrarForm(true);
  }

  function abrirEdicao(u) {
    setEditando(u);
    setForm({ nome: u.nome, email: u.email, perfil: u.perfil, senha: '', produtoIds: u.produtosVinculados?.map((v) => v.produto.id) || [] });
    setMostrarForm(true);
  }

  function toggleProduto(id) {
    setForm((f) => ({
      ...f,
      produtoIds: f.produtoIds.includes(id) ? f.produtoIds.filter((p) => p !== id) : [...f.produtoIds, id],
    }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    try {
      if (editando) {
        await api.put(`/usuarios/internos/${editando.id}`, {
          nome: form.nome, email: form.email,
          ...(form.perfil === 'SUPERVISOR' && { produtoIds: form.produtoIds }),
        });
      } else {
        await api.post('/usuarios/internos', form);
      }
      setMostrarForm(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    }
  }

  async function alternarAtivo(u) {
    await api.put(`/usuarios/internos/${u.id}`, { ativo: !u.ativo });
    carregar();
  }

  async function excluir(u) {
    if (!confirm(`Tem certeza que deseja excluir "${u.nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/usuarios/internos/${u.id}`);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Não foi possível excluir este usuário.');
    }
  }

  return (
    <div className="card">
      <div className="topo-pagina">
        <h3 style={{ margin: 0 }}>Administradores e Supervisores</h3>
        <button className="btn" onClick={abrirNovo}>+ Novo usuário</button>
      </div>

      <div className="filtros">
        <input placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)}>
          <option value="">Todos os perfis</option>
          <option value="ADMIN">Administrador</option>
          <option value="SUPERVISOR">Supervisor</option>
        </select>
        <select value={filtroProduto} onChange={(e) => setFiltroProduto(e.target.value)}>
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Produtos</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.nome}</td>
              <td>{u.email}</td>
              <td>{u.perfil}</td>
              <td>{u.produtosVinculados?.map((v) => v.produto.nome).join(', ') || '-'}</td>
              <td>{u.ativo ? 'Ativo' : 'Inativo'}</td>
              <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-link" onClick={() => abrirEdicao(u)}>Editar</button>
                <button className="btn-link" style={{ color: '#dc2626' }} onClick={() => alternarAtivo(u)}>
                  {u.ativo ? 'Inativar' : 'Reativar'}
                </button>
                <button className="btn-link" style={{ color: '#dc2626' }} onClick={() => excluir(u)}>Excluir</button>
              </td>
            </tr>
          ))}
          {usuarios.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>Nenhum usuário encontrado.</td></tr>
          )}
        </tbody>
      </table>

      {mostrarForm && (
        <div className="modal-fundo" onClick={() => setMostrarForm(false)}>
          <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>{editando ? 'Editar usuário' : 'Novo usuário'}</h3>
            <form onSubmit={salvar}>
              <div className="campo">
                <label>Nome</label>
                <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
              </div>
              <div className="campo">
                <label>E-mail</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
              </div>
              {!editando && (
                <>
                  <div className="campo">
                    <label>Perfil</label>
                    <select value={form.perfil} onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value }))}>
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                  <div className="campo">
                    <label>Senha inicial</label>
                    <input type="password" minLength={6} value={form.senha} onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} required />
                  </div>
                </>
              )}
              {form.perfil === 'SUPERVISOR' && (
                <div className="campo">
                  <label>Produtos vinculados</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {produtos.map((p) => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 400 }}>
                        <input type="checkbox" checked={form.produtoIds.includes(p.id)} onChange={() => toggleProduto(p.id)} />
                        {p.nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {erro && <p className="erro">{erro}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="submit">Salvar</button>
                <button className="btn btn-secundario" type="button" onClick={() => setMostrarForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Produtos ----------------

function AbaProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', corCalendario: CORES_SUGERIDAS[0] });
  const [erro, setErro] = useState('');

  async function carregar() {
    const res = await api.get('/produtos');
    setProdutos(res.data);
  }
  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setEditando(null); setForm({ nome: '', corCalendario: CORES_SUGERIDAS[0] }); setMostrarForm(true); }
  function abrirEdicao(p) { setEditando(p); setForm({ nome: p.nome, corCalendario: p.corCalendario }); setMostrarForm(true); }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    try {
      if (editando) await api.put(`/produtos/${editando.id}`, form);
      else await api.post('/produtos', form);
      setMostrarForm(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    }
  }

  async function inativar(p) {
    if (!confirm(`Inativar o produto "${p.nome}"?`)) return;
    await api.delete(`/produtos/${p.id}`);
    carregar();
  }

  return (
    <div className="card">
      <div className="topo-pagina">
        <h3 style={{ margin: 0 }}>Produtos</h3>
        <button className="btn" onClick={abrirNovo}>+ Novo produto</button>
      </div>
      <table>
        <thead><tr><th>Nome</th><th>Cor</th><th></th></tr></thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td><span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, background: p.corCalendario }} /></td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button className="btn-link" onClick={() => abrirEdicao(p)}>Editar</button>
                <button className="btn-link" style={{ color: '#dc2626' }} onClick={() => inativar(p)}>Inativar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {mostrarForm && (
        <div className="modal-fundo" onClick={() => setMostrarForm(false)}>
          <div className="modal-caixa" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3>{editando ? 'Editar produto' : 'Novo produto'}</h3>
            <form onSubmit={salvar}>
              <div className="campo">
                <label>Nome do produto</label>
                <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
              </div>
              <div className="campo">
                <label>Cor no calendário</label>
                <input type="color" value={form.corCalendario} onChange={(e) => setForm((f) => ({ ...f, corCalendario: e.target.value }))} style={{ height: 42 }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {CORES_SUGERIDAS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setForm((f) => ({ ...f, corCalendario: c }))}
                      style={{ width: 22, height: 22, borderRadius: 4, background: c, border: form.corCalendario === c ? '2px solid #1a1a2e' : 'none' }}
                    />
                  ))}
                </div>
              </div>
              {erro && <p className="erro">{erro}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" type="submit">Salvar</button>
                <button className="btn btn-secundario" type="button" onClick={() => setMostrarForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Empresas de venda ----------------

function AbaEmpresas() {
  const [empresas, setEmpresas] = useState([]);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');

  async function carregar() {
    const res = await api.get('/empresas');
    setEmpresas(res.data);
  }
  useEffect(() => { carregar(); }, []);

  async function adicionar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/empresas', { nome });
      setNome('');
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    }
  }

  async function inativar(emp) {
    if (!confirm(`Inativar a empresa "${emp.nome}"?`)) return;
    await api.delete(`/empresas/${emp.id}`);
    carregar();
  }

  return (
    <div className="card">
      <h3>Empresas de Vendas</h3>
      <form onSubmit={adicionar} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Nome da empresa" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <button className="btn" type="submit">Adicionar</button>
      </form>
      {erro && <p className="erro">{erro}</p>}
      <table>
        <thead><tr><th>Nome</th><th></th></tr></thead>
        <tbody>
          {empresas.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.nome}</td>
              <td><button className="btn-link" style={{ color: '#dc2626' }} onClick={() => inativar(emp)}>Inativar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
