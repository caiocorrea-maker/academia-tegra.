import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RotaProtegida({ children, perfis }) {
  const { usuario, carregando } = useAuth();

  if (carregando) return <div style={{ padding: 40 }}>Carregando...</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (perfis && !perfis.includes(usuario.perfil)) return <Navigate to="/agenda" replace />;

  return children;
}
