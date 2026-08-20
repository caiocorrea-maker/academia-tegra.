import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function aoEnviar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
      navigate('/agenda');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível entrar. Verifique seus dados.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-auth">
      <div className="card">
        <h1>Academia Tegra</h1>
        <p className="sub">Controle de treinamentos da equipe comercial</p>
        <form onSubmit={aoEnviar}>
          <div className="campo">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="campo">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn" type="submit" disabled={carregando} style={{ width: '100%' }}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <Link to="/esqueci-senha">Esqueci minha senha</Link>
          <Link to="/cadastro-corretor">Primeiro acesso</Link>
        </div>
      </div>
    </div>
  );
}
