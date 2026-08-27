import { Routes, Route, Navigate } from 'react-router-dom';
import RotaProtegida from './components/RotaProtegida';

import Login from './pages/Login';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import CadastroCorretor from './pages/CadastroCorretor';
import Agenda from './pages/Agenda';
import Treinamentos from './pages/Treinamentos';
import Supervisores from './pages/Supervisores';
import Corretores from './pages/Corretores';
import PerfilCorretor from './pages/PerfilCorretor';
import PainelAdmin from './pages/PainelAdmin';
import Produto from './pages/Produto';
import ResponderProva from './pages/ResponderProva';
import Biblioteca from './pages/Biblioteca';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/agenda" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/cadastro-corretor" element={<CadastroCorretor />} />

      <Route path="/agenda" element={<RotaProtegida><Agenda /></RotaProtegida>} />

      <Route path="/treinamentos" element={
        <RotaProtegida perfis={['ADMIN', 'SUPERVISOR']}><Treinamentos /></RotaProtegida>
      } />

      <Route path="/supervisores" element={
        <RotaProtegida perfis={['ADMIN', 'SUPERVISOR']}><Supervisores /></RotaProtegida>
      } />

      <Route path="/corretores" element={
        <RotaProtegida perfis={['ADMIN', 'SUPERVISOR']}><Corretores /></RotaProtegida>
      } />
      <Route path="/corretores/:id" element={<RotaProtegida><PerfilCorretor /></RotaProtegida>} />

      <Route path="/biblioteca" element={<RotaProtegida><Biblioteca /></RotaProtegida>} />

      <Route path="/produto" element={
        <RotaProtegida perfis={['ADMIN', 'SUPERVISOR']}><Produto /></RotaProtegida>
      } />

      <Route path="/dashboard" element={<RotaProtegida perfis={['ADMIN', 'SUPERVISOR']}><Dashboard /></RotaProtegida>} />

      <Route path="/admin" element={<RotaProtegida perfis={['ADMIN']}><PainelAdmin /></RotaProtegida>} />

      <Route path="/prova/:treinamentoId" element={
        <RotaProtegida perfis={['CORRETOR']}><ResponderProva /></RotaProtegida>
      } />

      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  );
}
