import { useRef, useState } from 'react';
import InsigniaSelo from './InsigniaSelo';
import { formatarCPF } from '../utils/formatadores';
import api from '../services/api';

function formatarData(d) {
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function CarteirinhaCorretor({ dados, podeEditarFoto, aoAtualizarFoto }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [insigniaSelecionada, setInsigniaSelecionada] = useState(null); // { produtoNome, insignia }

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
        <span className="carteirinha-subtitulo">Carteira do Corretor</span>
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
              {item.insignias.map((insignia) => (
                <InsigniaSelo
                  key={insignia.temaOficialId}
                  preenchida={insignia.preenchida}
                  cor={item.produto.corCalendario}
                  titulo={`${insignia.nome}${insignia.preenchida ? ` — válido até ${formatarData(insignia.validoAte)}` : ' — ainda não concluído'}`}
                  onClick={() => setInsigniaSelecionada({ produtoNome: item.produto.nome, insignia })}
                />
              ))}
              {item.insignias.length === 0 && (
                <span style={{ fontSize: 12, color: '#888' }}>Nenhum treinamento oficial cadastrado ainda.</span>
              )}
            </div>
          </div>
        ))}
        {(dados.carteirinhaProdutos || []).length === 0 && (
          <span style={{ fontSize: 13, color: '#888' }}>Nenhum produto ativo cadastrado.</span>
        )}
      </div>

      {insigniaSelecionada && (
        <div className="modal-fundo" onClick={() => setInsigniaSelecionada(null)}>
          <div className="modal-caixa" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{insigniaSelecionada.insignia.nome}</h3>
            <p style={{ fontSize: 13, color: '#888', margin: '0 0 10px' }}>{insigniaSelecionada.produtoNome}</p>
            {insigniaSelecionada.insignia.preenchida ? (
              <p style={{ color: '#16a34a' }}>Válido até {formatarData(insigniaSelecionada.insignia.validoAte)}</p>
            ) : (
              <p style={{ color: '#888' }}>Este treinamento ainda não foi concluído (ou o certificado expirou).</p>
            )}
            <button className="btn btn-secundario" type="button" onClick={() => setInsigniaSelecionada(null)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
