import { useRef, useState } from 'react';
import InsigniaSelo from './InsigniaSelo';
import { formatarCPF } from '../utils/formatadores';
import api from '../services/api';

export default function CarteirinhaCorretor({ dados, podeEditarFoto, aoAtualizarFoto }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function selecionarFoto(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro('');
    setEnviando(true);
    const formData = new FormData();
    formData.append('foto', arquivo);
    try {
      await api.put('/corretores/perfil/me/foto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      aoAtualizarFoto?.();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível enviar a foto.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="carteirinha">
      <div className="carteirinha-topo">
        <span className="carteirinha-titulo">ACADEMIA TEGRA</span>
        <span className="carteirinha-subtitulo">Carteirinha de Certificações</span>
      </div>

      <div className="carteirinha-corpo">
        <div className="carteirinha-foto-wrap">
          {dados.fotoUrl ? (
            <img src={dados.fotoUrl} alt={dados.nome} className="carteirinha-foto" />
          ) : (
            <div className="carteirinha-foto carteirinha-foto-vazia">Sem foto</div>
          )}
          {podeEditarFoto && (
            <>
              <button
                type="button"
                className="btn-link"
                style={{ fontSize: 12, marginTop: 6 }}
                onClick={() => inputRef.current?.click()}
                disabled={enviando}
              >
                {enviando ? 'Enviando...' : 'Trocar foto'}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={selecionarFoto}
              />
            </>
          )}
        </div>

        <div className="carteirinha-dados">
          <p className="carteirinha-nome">{dados.nome}</p>
          <p><strong>Empresa:</strong> {dados.empresa?.nome || '-'}</p>
          <p><strong>Gerente:</strong> {dados.gerente || '-'}</p>
          <p><strong>Diretor:</strong> {dados.diretor || '-'}</p>
          <p><strong>CRECI:</strong> {dados.creci || '-'}</p>
          <p><strong>CPF:</strong> {formatarCPF(dados.cpf)}</p>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="carteirinha-produtos">
        {(dados.carteirinhaProdutos || []).map((item) => (
          <div key={item.produto.id} className="carteirinha-produto-item">
            <span
              className="carteirinha-produto-nome"
              title={item.apto ? 'Apto a tirar plantão' : 'Não apto a tirar plantão'}
            >
              {item.apto ? '✔' : '✕'} {item.produto.nome}
            </span>
            <div className="carteirinha-insignias">
              {Array.from({ length: item.certificadosNecessarios }).map((_, i) => (
                <InsigniaSelo
                  key={i}
                  preenchida={i < item.qtdCertificadosValidos}
                  cor={item.produto.corCalendario}
                  titulo={`${item.produto.nome}: ${item.qtdCertificadosValidos}/${item.certificadosNecessarios} certificados válidos`}
                />
              ))}
            </div>
          </div>
        ))}
        {(dados.carteirinhaProdutos || []).length === 0 && (
          <span style={{ fontSize: 13, color: '#888' }}>Nenhum produto ativo cadastrado.</span>
        )}
      </div>
    </div>
  );
}
