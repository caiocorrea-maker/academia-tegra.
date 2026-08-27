import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CarteirinhaCorretor from '../components/CarteirinhaCorretor';
import { useAuth } from '../context/AuthContext';
import { formatarCPF } from '../utils/formatadores';
import api from '../services/api';

export default function PerfilCorretor() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', gerente: '', diretor: '', creci: '' });
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const ehProprioPerfil = usuario.perfil === 'CORRETOR' && usuario.id === id;

  async function carregar() {
    const res = await api.get(`/corretores/${id}`);
    setDados(res.data);
    setForm({
      nome: res.data.nome, email: res.data.email, senha: '',
      gerente: res.data.gerente || '', diretor: res.data.diretor || '', creci: res.data.creci || '',
    });
  }

  useEffect(() => { carregar(); }, [id]);

  async function salvar(e) {
    e.preventDefault();
    setErro(''); setMensagem('');
    try {
      const payload = { nome: form.nome, email: form.email, gerente: form.gerente, diretor: form.diretor, creci: form.creci };
      if (form.senha) payload.senha = form.senha;
      await api.put('/corretores/perfil/me', payload);
      setMensagem('Dados atualizados com sucesso.');
      setEditando(false);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    }
  }

  async function excluir() {
    if (!confirm(`Tem certeza que deseja excluir o corretor "${dados.nome}"? Essa ação não pode ser desfeita.`)) return;
    setExcluindo(true);
    try {
      await api.delete(`/corretores/${id}`);
      navigate('/corretores');
    } catch (err) {
      alert(err.response?.data?.erro || 'Não foi possível excluir este corretor.');
      setExcluindo(false);
    }
  }

  if (!dados) return <Layout><p>Carregando...</p></Layout>;

  return (
    <Layout>
      <h2>Perfil do Corretor</h2>

      <div style={{ marginBottom: 20 }}>
        <CarteirinhaCorretor dados={dados} podeEditarFoto={ehProprioPerfil} aoAtualizarFoto={carregar} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        {!editando ? (
          <>
            <p><strong>Nome:</strong> {dados.nome}</p>
            <p><strong>CPF:</strong> {formatarCPF(dados.cpf)}</p>
            <p><strong>CRECI:</strong> {dados.creci || '-'}</p>
            <p><strong>E-mail:</strong> {dados.email}</p>
            <p><strong>Empresa:</strong> {dados.empresa?.nome}</p>
            <p><strong>Gerente:</strong> {dados.gerente || '-'}</p>
            <p><strong>Diretor:</strong> {dados.diretor || '-'}</p>
            {ehProprioPerfil && <button className="btn btn-secundario" onClick={() => setEditando(true)}>Editar meus dados</button>}
            {usuario.perfil === 'ADMIN' && (
              <button className="btn btn-perigo" onClick={excluir} disabled={excluindo} style={{ marginLeft: 8 }}>
                {excluindo ? 'Excluindo...' : 'Excluir corretor'}
              </button>
            )}
          </>
        ) : (
          <form onSubmit={salvar}>
            <div className="campo">
              <label>Nome</label>
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
            </div>
            <div className="campo">
              <label>E-mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="campo">
              <label>CRECI</label>
              <input value={form.creci} onChange={(e) => setForm((f) => ({ ...f, creci: e.target.value }))} />
            </div>
            <div className="campo">
              <label>Gerente</label>
              <input value={form.gerente} onChange={(e) => setForm((f) => ({ ...f, gerente: e.target.value }))} />
            </div>
            <div className="campo">
              <label>Diretor</label>
              <input value={form.diretor} onChange={(e) => setForm((f) => ({ ...f, diretor: e.target.value }))} />
            </div>
            <div className="campo">
              <label>Nova senha (deixe em branco para não alterar)</label>
              <input type="password" value={form.senha} onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} minLength={6} />
            </div>
            {erro && <p className="erro">{erro}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="submit">Salvar</button>
              <button className="btn btn-secundario" type="button" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </form>
        )}
        {mensagem && <p className="sucesso">{mensagem}</p>}
      </div>

      <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
        Toque em uma insígnia na carteira acima para ver o treinamento correspondente e, se já concluído, até quando ele é válido.
      </p>
    </Layout>
  );
}
