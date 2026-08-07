import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function CadastroCorretor() {
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState({ nome: '', empresaId: '', cpf: '', email: '', senha: '', gerente: '', diretor: '', creci: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/empresas').then((res) => setEmpresas(res.data)).catch(() => {});
  }, []);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function aoEnviar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.post('/corretores/cadastro', form);
      alert('Cadastro realizado com sucesso! Faça login para continuar.');
      navigate('/login');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível concluir o cadastro.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-auth">
      <div className="card" style={{ width: 420 }}>
        <h1>Cadastro de Corretor</h1>
        <p className="sub">Preencha seus dados para acessar a Academia Tegra.</p>
        <form onSubmit={aoEnviar}>
          <div className="campo">
            <label>Nome completo</label>
            <input value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} required />
          </div>
          <div className="campo">
            <label>Empresa de vendas</label>
            <select value={form.empresaId} onChange={(e) => atualizar('empresaId', e.target.value)} required>
              <option value="">Selecione...</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>CPF</label>
            <input value={form.cpf} onChange={(e) => atualizar('cpf', e.target.value)} placeholder="000.000.000-00" required />
          </div>
          <div className="campo">
            <label>CRECI</label>
            <input value={form.creci} onChange={(e) => atualizar('creci', e.target.value)} />
          </div>
          <div className="campo">
            <label>E-mail</label>
            <input type="email" value={form.email} onChange={(e) => atualizar('email', e.target.value)} required />
          </div>
          <div className="campo">
            <label>Gerente</label>
            <input value={form.gerente} onChange={(e) => atualizar('gerente', e.target.value)} />
          </div>
          <div className="campo">
            <label>Diretor</label>
            <input value={form.diretor} onChange={(e) => atualizar('diretor', e.target.value)} />
          </div>
          <div className="campo">
            <label>Senha</label>
            <input type="password" minLength={6} value={form.senha} onChange={(e) => atualizar('senha', e.target.value)} required />
          </div>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn" type="submit" disabled={carregando} style={{ width: '100%' }}>
            {carregando ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/login">Já tenho conta, fazer login</Link>
        </div>
      </div>
    </div>
  );
}
