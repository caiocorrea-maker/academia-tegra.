import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Academia Tegra</h1>
        <nav>
          <NavLink to="/agenda" className={({ isActive }) => (isActive ? 'ativo' : '')}>Agenda</NavLink>
          {usuario?.perfil !== 'CORRETOR' && (
            <NavLink to="/supervisores" className={({ isActive }) => (isActive ? 'ativo' : '')}>Supervisores</NavLink>
          )}
          {usuario?.perfil === 'CORRETOR' ? (
            <NavLink to={`/corretores/${usuario.id}`} className={({ isActive }) => (isActive ? 'ativo' : '')}>Meu Perfil</NavLink>
          ) : (
            <NavLink to="/corretores" className={({ isActive }) => (isActive ? 'ativo' : '')}>Corretores</NavLink>
          )}
          {usuario?.perfil !== 'CORRETOR' && (
            <NavLink to="/treinamentos" className={({ isActive }) => (isActive ? 'ativo' : '')}>Treinamentos</NavLink>
          )}
          <NavLink to="/biblioteca" className={({ isActive }) => (isActive ? 'ativo' : '')}>Biblioteca de Treinamentos</NavLink>
          {usuario?.perfil === 'ADMIN' && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'ativo' : '')}>Painel do Administrador</NavLink>
          )}
          <button onClick={sair} style={{ marginTop: 20 }}>Sair ({usuario?.nome?.split(' ')[0]})</button>
        </nav>
      </aside>
      <main className="conteudo">{children}</main>
    </div>
  );
}
