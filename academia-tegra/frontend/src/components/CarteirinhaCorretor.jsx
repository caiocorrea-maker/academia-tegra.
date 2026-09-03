import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import InsigniaSelo from './InsigniaSelo';
import { formatarCPF } from '../utils/formatadores';
import api from '../services/api';

function formatarData(d) {
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function CarteirinhaCorretor({ dados, podeEditarFoto, aoAtualizarFoto }) {
  const inputRef = useRef(null);
  const carteirinhaRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [gerandoImagem, setGerandoImagem] = useState(false);
  const [erro, setErro] = useState('');
  const [insigniaSelecionada, setInsigniaSelecionada] = useState(null); // { produtoNome, insignia }

  // Compartilhamento de arquivo (Web Share API nível 2) só existe em navegadores mobile
  // modernos (Chrome/Safari no Android/iPhone). Em desktop, geralmente não existe — nesse
  // caso deixamos só o botão de baixar.
  const suportaCompartilharArquivo =
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [new File([], 'teste.png', { type: 'image/png' })] });

  async function gerarImagem() {
    if (!carteirinhaRef.current) return null;
    // Usamos scale 2 para gerar uma imagem em boa resolução (a carteirinha na tela é pequena).
    const canvas = await html2canvas(carteirinhaRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
  }

  async function baixarComoImagem() {
    setErro('');
    setGerandoImagem(true);
    try {
      const blob = await gerarImagem();
      if (!blob) throw new Error();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carteira-${(dados.nome || 'corretor').replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Não foi possível gerar a imagem da carteira.');
    } finally {
      setGerandoImagem(false);
    }
  }

  async function compartilharImagem() {
    setErro('');
    setGerandoImagem(true);
    try {
      const blob = await gerarImagem();
      if (!blob) throw new Error();
      const arquivo = new File([blob], 'carteira-do-corretor.png', { type: 'image/png' });
      await navigator.share({
        files: [arquivo],
        title: 'Carteira do Corretor — Academia Tegra',
        text: `Carteira do Corretor de ${dados.nome}`,
      });
    } catch (err) {
      // AbortError acontece quando o usuário fecha o menu de compartilhamento sem escolher
      // nada — não é um erro de verdade, então não mostramos mensagem nesse caso.
      if (err?.name !== 'AbortError') setErro('Não foi possível abrir o menu de compartilhamento.');
    } finally {
      setGerandoImagem(false);
    }
  }

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
    <div>
      <div className="carteirinha" ref={carteirinhaRef}>
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

      <p className="carteirinha-rodape">*Corretor associado</p>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secundario" onClick={baixarComoImagem} disabled={gerandoImagem}>
          {gerandoImagem ? 'Gerando...' : 'Baixar como imagem'}
        </button>
        {suportaCompartilharArquivo && (
          <button type="button" className="btn" onClick={compartilharImagem} disabled={gerandoImagem}>
            {gerandoImagem ? 'Gerando...' : 'Compartilhar'}
          </button>
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
