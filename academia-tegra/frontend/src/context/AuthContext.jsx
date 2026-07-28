import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const salvo = localStorage.getItem('tegra_usuario');
    return salvo ? JSON.parse(salvo) : null;
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('tegra_token');
    if (!token) {
      setCarregando(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUsuario(res.data))
      .catch(() => {
        localStorage.removeItem('tegra_token');
        localStorage.removeItem('tegra_usuario');
        setUsuario(null);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function login(email, senha) {
    const res = await api.post('/auth/login', { email, senha });
    localStorage.setItem('tegra_token', res.data.token);
    localStorage.setItem('tegra_usuario', JSON.stringify(res.data.usuario));
    setUsuario(res.data.usuario);
    return res.data.usuario;
  }

  function logout() {
    localStorage.removeItem('tegra_token');
    localStorage.removeItem('tegra_usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, carregando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
