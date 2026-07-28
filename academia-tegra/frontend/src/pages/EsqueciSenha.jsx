import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setCarregando(true);
    try {
      const res = await api.post('/auth/esqueci-senha', { email });
      setMensagem(res.data.mensagem);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao solicitar recuperação de senha.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-auth">
      <div className="card">
        <h1>Recuperar senha</h1>
        <p className="sub">Informe seu e-mail para receber o link de redefinição.</p>
        <form onSubmit={aoEnviar}>
          <div className="campo">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {erro && <p className="erro">{erro}</p>}
          {mensagem && <p className="sucesso">{mensagem}</p>}
          <button className="btn" type="submit" disabled={carregando} style={{ width: '100%' }}>
            {carregando ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/login">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}
