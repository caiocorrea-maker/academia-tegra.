import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  async function aoEnviar(e) {
    e.preventDefault();
    setErro('');
    if (novaSenha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    setCarregando(true);
    try {
      await api.post('/auth/redefinir-senha', { token, novaSenha });
      alert('Senha redefinida com sucesso! Faça login com sua nova senha.');
      navigate('/login');
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível redefinir a senha.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-auth">
      <div className="card">
        <h1>Redefinir senha</h1>
        <p className="sub">Escolha uma nova senha de acesso.</p>
        <form onSubmit={aoEnviar}>
          <div className="campo">
            <label>Nova senha</label>
            <input type="password" minLength={6} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
          </div>
          <div className="campo">
            <label>Confirmar nova senha</label>
            <input type="password" minLength={6} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
          </div>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn" type="submit" disabled={carregando} style={{ width: '100%' }}>
            {carregando ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/login">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}
