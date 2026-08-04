import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/global.css';

// Depois de um novo deploy, uma aba que já estava aberta pode tentar carregar um arquivo
// JS antigo que não existe mais (o navegador ainda referencia a versão anterior). Isso
// gera um erro de carregamento de módulo. Em vez de mostrar uma tela quebrada, forçamos
// um único recarregamento automático da página, que busca a versão atual dos arquivos.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('tegra_reload_apos_erro')) {
    sessionStorage.setItem('tegra_reload_apos_erro', '1');
    window.location.reload();
  }
});
window.addEventListener('load', () => {
  sessionStorage.removeItem('tegra_reload_apos_erro');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
