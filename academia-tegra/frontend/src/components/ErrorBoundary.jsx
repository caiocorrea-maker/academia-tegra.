import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { temErro: false };
  }

  static getDerivedStateFromError() {
    return { temErro: true };
  }

  componentDidCatch(erro, info) {
    // eslint-disable-next-line no-console
    console.error('Erro capturado pelo ErrorBoundary:', erro, info);
  }

  recarregar = () => {
    // Limpa a sessão local (o erro pode ter sido causado por um estado/token inconsistente
    // após uma atualização do sistema) e manda o usuário direto para o login.
    localStorage.removeItem('tegra_token');
    localStorage.removeItem('tegra_usuario');
    window.location.href = '/login';
  };

  render() {
    if (this.state.temErro) {
      return (
        <div className="tela-auth">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Ops, algo deu errado</h2>
            <p style={{ color: '#666', fontSize: 14 }}>
              Isso pode acontecer logo após uma atualização do sistema. Clique no botão abaixo para voltar à tela de login.
            </p>
            <button className="btn" onClick={this.recarregar} style={{ width: '100%', marginTop: 12 }}>
              Voltar ao login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
