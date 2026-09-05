import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import FormularioProva from '../components/FormularioProva';

const CORES_SUGERIDAS = ['#4f46e5', '#dc2626', '#16a34a', '#ea580c', '#0891b2', '#c026d3', '#ca8a04', '#0284c7'];

export default function Produto() {
  const { usuario } = useAuth();
  const ehSupervisor = usuario?.perfil === 'SUPERVISOR';

  const [produtos, setProdutos] = useState([]);
  const [mostrarFormProduto, setMostrarFormProduto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [produtoAberto, setProdutoAberto] = useState(null); // produto cujo modal de edição+temas está aberto

  async function carregar() {
    const res = await api.get('/produtos', { params: ehSupervisor ? { somenteMeus: true } : {} });
    setProdutos(res.data);
  }
  useEffect(() => { carregar(); }, []);

  function abrirNovo() {
    setEditando(null);
    setMostrarFormProduto(true);
  }

  function abrirEdicao(p) {
    setProdutoAberto(p);
  }

  return (
    <Layout>
      <div className="topo-pagina">
        <h2>Produto</h2>
        {!ehSupervisor && <button className="btn" onClick={abrirNovo}>+ Novo produto</button>}
      </div>

      <table>
        <thead><tr><th>Nome</th><th>Cor</th><th>Certificados p/ tirar plantão</th><th></th></tr></thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => abrirEdicao(p)}>
              <td>{p.nome}</td>
              <td><span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, background: p.corCalendario }} /></td>
              <td>{p.certificadosNecessarios || 3}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <button className="btn-link" onClick={() => abrirEdicao(p)}>Editar</button>
              </td>
            </tr>
          ))}
          {produtos.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888' }}>Nenhum produto encontrado.</td></tr>
          )}
        </tbody>
      </table>

      {mostrarFormProduto && (
        <ModalNovoProduto
          aoFechar={() => setMostrarFormProduto(false)}
          aoSalvar={() => { setMostrarFormProduto(false); carregar(); }}
        />
      )}

      {produtoAberto && (
        <ModalEditarProduto
          produto={produtoAberto}
          ehSupervisor={ehSupervisor}
          aoFechar={() => { setProdutoAberto(null); carregar(); }}
        />
      )}
    </Layout>
  );
}

// ---------------- Modal: novo produto (só Admin) ----------------

function ModalNovoProduto({ aoFechar, aoSalvar }) {
  const [form, setForm] = useState({ nome: '', corCalendario: CORES_SUGERIDAS[0], certificadosNecessarios: 3 });
  const [erro, setErro] = useState('');

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/produtos', { ...form, certificadosNecessarios: Number(form.certificadosNecessarios) });
      aoSalvar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <h3>Novo produto</h3>
        <form onSubmit={salvar}>
          <div className="campo">
            <label>Nome do produto</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div className="campo">
            <label>Cor no calendário</label>
            <input type="color" value={form.corCalendario} onChange={(e) => setForm((f) => ({ ...f, corCalendario: e.target.value }))} style={{ height: 42 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {CORES_SUGERIDAS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, corCalendario: c }))}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c, border: form.corCalendario === c ? '2px solid #1a1a2e' : 'none' }}
                />
              ))}
            </div>
          </div>
          <div className="campo">
            <label>Certificados necessários para o corretor tirar plantão</label>
            <input
              type="number" min={1} value={form.certificadosNecessarios}
              onChange={(e) => setForm((f) => ({ ...f, certificadosNecessarios: e.target.value }))}
              required
            />
          </div>
          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit">Salvar</button>
            <button className="btn btn-secundario" type="button" onClick={aoFechar}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------- Modal: editar produto + Treinamentos Oficiais (insígnias) ----------------

function ModalEditarProduto({ produto, ehSupervisor, aoFechar }) {
  const [form, setForm] = useState({
    nome: produto.nome,
    corCalendario: produto.corCalendario,
    certificadosNecessarios: produto.certificadosNecessarios || 3,
  });
  const [temas, setTemas] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [exportandoAptos, setExportandoAptos] = useState(false);
  const [slotAberto, setSlotAberto] = useState(null); // posicao sendo cadastrada/editada

  async function carregarTemas() {
    const res = await api.get('/temas-oficiais', { params: { produtoId: produto.id } });
    setTemas(res.data);
  }
  useEffect(() => { carregarTemas(); }, []);

  async function exportarAptos() {
    setExportandoAptos(true);
    try {
      const res = await api.get('/exportar/corretores-aptos', { params: { produtoId: produto.id }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `corretores_aptos_${produto.nome.replace(/\s+/g, '_').toLowerCase()}.xlsx`;
      link.click();
    } catch (err) {
      setErro('Não foi possível gerar a extração de corretores aptos.');
    } finally {
      setExportandoAptos(false);
    }
  }

  async function salvarProduto(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api.put(`/produtos/${produto.id}`, {
        nome: form.nome,
        corCalendario: form.corCalendario,
        certificadosNecessarios: Number(form.certificadosNecessarios),
      });
      await carregarTemas();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function inativarProduto() {
    if (!confirm(`Inativar o produto "${produto.nome}"?`)) return;
    await api.delete(`/produtos/${produto.id}`);
    aoFechar();
  }

  const totalInsignias = Number(form.certificadosNecessarios) || 0;
  const posicoes = Array.from({ length: totalInsignias }, (_, i) => i + 1);

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>Editar produto</h3>
          <button onClick={aoFechar} style={{ background: 'none', border: 'none', fontSize: 20 }}>✕</button>
        </div>

        <form onSubmit={salvarProduto}>
          <div className="campo">
            <label>Nome do produto</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div className="campo">
            <label>Cor no calendário</label>
            <input type="color" value={form.corCalendario} onChange={(e) => setForm((f) => ({ ...f, corCalendario: e.target.value }))} style={{ height: 42 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {CORES_SUGERIDAS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, corCalendario: c }))}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c, border: form.corCalendario === c ? '2px solid #1a1a2e' : 'none' }}
                />
              ))}
            </div>
          </div>
          <div className="campo">
            <label>Certificados necessários para o corretor tirar plantão</label>
            <input
              type="number" min={1} value={form.certificadosNecessarios}
              onChange={(e) => setForm((f) => ({ ...f, certificadosNecessarios: e.target.value }))}
              required
            />
            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Reduzir esse número inativa as insígnias excedentes (o histórico é mantido). Aumentar de volta reativa
              as que existiam antes, na mesma posição.
            </p>
            <button type="button" className="btn btn-secundario" onClick={exportarAptos} disabled={exportandoAptos}>
              {exportandoAptos ? 'Gerando...' : 'Corretores aptos'}
            </button>
          </div>
          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar produto'}</button>
            {!ehSupervisor && (
              <button className="btn btn-secundario" type="button" style={{ color: '#dc2626' }} onClick={inativarProduto}>
                Inativar produto
              </button>
            )}
          </div>
        </form>

        <hr style={{ margin: '20px 0' }} />

        <h4 style={{ marginBottom: 4 }}>Treinamentos Oficiais (insígnias)</h4>
        <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 14 }}>
          Cada insígnia da carteirinha do corretor corresponde a um treinamento oficial cadastrado aqui. Ele nasce
          sempre com prova, e é isso — não mais o nome digitado — que identifica o certificado, evitando duplicidade
          quando o mesmo treinamento é aplicado mais de uma vez.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posicoes.map((posicao) => {
            const tema = temas.find((t) => t.posicao === posicao);
            return (
              <div key={posicao} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Insígnia {posicao}</strong>
                  {tema && tema.ativo && (
                    <p style={{ fontSize: 13, margin: '4px 0 0' }}>{tema.nome} <span style={{ color: '#888' }}>— prova: {tema.prova?.titulo}</span></p>
                  )}
                  {tema && !tema.ativo && (
                    <p style={{ fontSize: 13, margin: '4px 0 0', color: '#dc2626' }}>Inativo: {tema.nome}</p>
                  )}
                  {!tema && (
                    <p style={{ fontSize: 13, margin: '4px 0 0', color: '#888' }}>Nenhum treinamento oficial cadastrado</p>
                  )}
                </div>
                <button className="btn-link" onClick={() => setSlotAberto(posicao)}>
                  {!tema ? 'Cadastrar' : tema.ativo ? 'Editar' : 'Reativar e editar'}
                </button>
              </div>
            );
          })}
        </div>

        {slotAberto && (
          <FormularioTemaOficial
            produtoId={produto.id}
            posicao={slotAberto}
            temaExistente={temas.find((t) => t.posicao === slotAberto)}
            aoFechar={() => setSlotAberto(null)}
            aoSalvar={async () => { setSlotAberto(null); await carregarTemas(); }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------- Sub-formulário: cadastrar/editar um Tema Oficial (slot de insígnia) ----------------

function FormularioTemaOficial({ produtoId, posicao, temaExistente, aoFechar, aoSalvar }) {
  const [nome, setNome] = useState(temaExistente?.nome || '');
  const [planoTreinamento, setPlanoTreinamento] = useState(temaExistente?.planoTreinamento || '');
  const [provaId, setProvaId] = useState(temaExistente?.prova?.id || '');
  const [provas, setProvas] = useState([]);
  const [mostrarNovaProva, setMostrarNovaProva] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregarProvas() {
    const res = await api.get('/provas/modelos', { params: { produtoId } });
    setProvas(res.data);
  }
  useEffect(() => { carregarProvas(); }, []);

  function provaCriada(prova) {
    setProvas((ps) => [...ps, prova]);
    setProvaId(prova.id);
    setMostrarNovaProva(false);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!provaId) { setErro('Selecione (ou cadastre) uma prova para este treinamento oficial.'); return; }
    setSalvando(true);
    try {
      await api.post('/temas-oficiais', { produtoId, posicao, nome, planoTreinamento, provaId });
      aoSalvar();
    } catch (err) {
      setErro(err.response?.data?.erro || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal-caixa" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3>Insígnia {posicao} — Treinamento Oficial</h3>
        <form onSubmit={salvar}>
          <div className="campo">
            <label>Tema / nome do treinamento</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="campo">
            <label>Plano de treinamento</label>
            <textarea rows={4} value={planoTreinamento} onChange={(e) => setPlanoTreinamento(e.target.value)} required />
          </div>
          <div className="campo">
            <label>Prova</label>
            <select value={provaId} onChange={(e) => setProvaId(e.target.value)}>
              <option value="">Selecione uma prova...</option>
              {provas.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
            <button type="button" className="btn-link" style={{ marginTop: 6 }} onClick={() => setMostrarNovaProva(true)}>
              + Cadastrar nova prova
            </button>
          </div>
          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            <button className="btn btn-secundario" type="button" onClick={aoFechar}>Cancelar</button>
          </div>
        </form>

        {mostrarNovaProva && (
          <FormularioProva
            produtoId={produtoId}
            nomeSugerido={nome}
            aoCriar={provaCriada}
            aoFechar={() => setMostrarNovaProva(false)}
          />
        )}
      </div>
    </div>
  );
}
