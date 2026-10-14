import { useState, useRef, useEffect } from "react";
import {
  FileText, Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Upload, Download,
  Tag, Table as TableIcon, Sparkles, Check, AlertCircle,
  X, Save, Eye, Palette, Type, HelpCircle, Layers, Plus, Trash2
} from "lucide-react";
import mammoth from "mammoth";

export default function WordRibbonEditor({
  initialTitle = "",
  initialCategory = "Geral",
  initialDescription = "",
  initialHtml = "",
  initialDefaultItems = "[]",
  onSave,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("home"); // "home", "insert", "import", "items"
  const [title, setTitle] = useState(initialTitle || "");
  const [category, setCategory] = useState(initialCategory || "Geral");
  const [description, setDescription] = useState(initialDescription || "");
  const [defaultItems, setDefaultItems] = useState(() => {
    try {
      return JSON.parse(initialDefaultItems || "[]");
    } catch {
      return [];
    }
  });

  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState("3"); // execCommand fontSize 1 to 7
  const [importStatus, setImportStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const editorRef = useRef(null);

  // Carrega HTML inicial no editor
  useEffect(() => {
    if (editorRef.current) {
      if (initialHtml) {
        editorRef.current.innerHTML = initialHtml;
      } else {
        editorRef.current.innerHTML = `
          <div style="font-family: Arial, sans-serif; line-height: 1.35; color: #111;">
            <div style="text-align: center; border-bottom: 1.5px solid #b89758; padding-bottom: 5px; margin-bottom: 6px;">
              <h2 style="margin: 0; color: #b89758; text-transform: uppercase; letter-spacing: 1px; font-size: 13.5pt;">HOTEL FASANO SALVADOR</h2>
              <h3 style="margin: 2px 0 0 0; font-weight: 600; font-size: 10pt; color: #222;">TERMO DE RESPONSABILIDADE E RETIRADA</h3>
              <p style="margin: 2px 0 0 0; font-size: 8pt; color: #666;">Número: <strong>{{numero_termo}}</strong> &bull; Emissão: <strong>{{data_emissao}}</strong></p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 8pt; page-break-inside: avoid !important; break-inside: avoid !important;">
              <tr>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db; background-color: #f9fafb; width: 25%; font-weight: 600;">Colaborador(a):</td>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db; width: 35%;">{{nome_colaborador}}</td>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db; background-color: #f9fafb; width: 20%; font-weight: 600;">Documento / CPF:</td>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db; width: 20%;">{{documento_cpf_rg}}</td>
              </tr>
              <tr>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db; background-color: #f9fafb; font-weight: 600;">Setor / Departamento:</td>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db;">{{setor_departamento}}</td>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db; background-color: #f9fafb; font-weight: 600;">Técnico Emissor:</td>
                <td style="padding: 2.5px 6px; border: 1px solid #d1d5db;">{{tecnico_responsavel}}</td>
              </tr>
            </table>

            <h4 style="margin: 6px 0 2px 0; color: #1f2937; text-transform: uppercase; font-size: 8.5pt; border-left: 3px solid #b89758; padding-left: 6px;">1. Discriminação dos Equipamentos e Bens</h4>
            <p style="font-size: 7.5pt; margin-bottom: 3px; color: #374151;">O beneficiário declara ter recebido em perfeito estado de funcionamento:</p>
            
            {{tabela_equipamentos}}

            <h4 style="margin: 6px 0 2px 0; color: #1f2937; text-transform: uppercase; font-size: 8.5pt; border-left: 3px solid #b89758; padding-left: 6px;">2. Termos e Condições de Uso</h4>
            <p style="font-size: 7.5pt; line-height: 1.25; text-align: justify; color: #374151; margin-top: 2px; margin-bottom: 3px;">
              O recebedor assume total responsabilidade pela guarda, conservação e integridade do bem disponibilizado pelo Hotel Fasano Salvador exclusivamente para uso institucional.
            </p>

            <!-- BLOCO DE DUPLA VALIDAÇÃO DO BENEFICIÁRIO (ASSINATURA TOUCH + BIOMETRIA FACIAL) -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 6px; border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 6px; page-break-inside: avoid !important; break-inside: avoid !important;">
              <tr>
                <td colspan="2" style="padding: 3px 8px; font-size: 7.5pt; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                  Aceite do Beneficiário (Dupla Validação: Assinatura Gráfica &amp; Biometria Facial)
                </td>
              </tr>
              <tr>
                <td style="width: 50%; padding: 4px 8px 2px 8px; text-align: center; vertical-align: bottom; border-right: 1px solid #e2e8f0;">
                  <div style="min-height: 42px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
                    {{assinatura_beneficiario}}
                  </div>
                  <div style="border-top: 1px solid #374151; padding-top: 2px;">
                    <p style="margin: 0; font-size: 8pt; font-weight: bold; color: #111;">{{nome_colaborador}}</p>
                    <p style="margin: 1px 0 0 0; font-size: 7pt; color: #4b5563;">Assinatura Digital Manuscrita (Touch)</p>
                    <p style="margin: 1px 0 0 0; font-size: 6.5pt; color: #6b7280;">Doc: {{documento_cpf_rg}} | {{setor_departamento}}</p>
                  </div>
                </td>
                <td style="width: 50%; padding: 4px 8px 2px 8px; text-align: center; vertical-align: bottom;">
                  <div style="min-height: 42px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
                    {{foto_biometria}}
                  </div>
                  <div style="border-top: 1px solid #374151; padding-top: 2px;">
                    <p style="margin: 0; font-size: 8pt; font-weight: bold; color: #111;">Validação Facial em Tempo Real</p>
                    <p style="margin: 1px 0 0 0; font-size: 7pt; color: #4b5563;">Evidência Biométrica do Recebedor</p>
                    <p style="margin: 1px 0 0 0; font-size: 6.5pt; color: #6b7280;">Autenticação Facial (Face-API)</p>
                  </div>
                </td>
              </tr>
            </table>

            <!-- RESPONSÁVEL PELA ENTREGA / TESTEMUNHA TI -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; page-break-inside: avoid !important; break-inside: avoid !important;">
              <tr>
                <td style="text-align: center; vertical-align: top; padding: 0;">
                  <div style="display: inline-block; width: 60%; border-top: 1px solid #9ca3af; padding-top: 2px;">
                    <p style="margin: 0; font-size: 8pt; font-weight: bold; color: #111;">{{tecnico_responsavel}}</p>
                    <p style="margin: 1px 0 0 0; font-size: 7pt; color: #4b5563;">Técnico Emissor / Testemunha da Entrega</p>
                    <p style="margin: 1px 0 0 0; font-size: 6.5pt; color: #6b7280;">Tecnologia da Informação — Hotel Fasano Salvador</p>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        `;
      }
    }
  }, [initialHtml]);

  // Executa comandos de formatação de texto
  const formatDoc = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Inserção de tags dinâmicas no local do cursor
  const insertTagAtCursor = (tagCode) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      if (editorRef.current) {
        editorRef.current.innerHTML += ` ${tagCode} `;
      }
      return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(` ${tagCode} `);
    range.insertNode(textNode);

    // Reposiciona o cursor após o nó inserido
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(range);

    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Inserção de tabela básica
  const insertSampleTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt;">
        <thead>
          <tr style="background-color: #f3f4f6; text-align: left;">
            <th style="padding: 8px; border: 1px solid #d1d5db;">Item / Equipamento</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">Patrimônio</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">Nº Série</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">Acessórios</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 8px; border: 1px solid #d1d5db;">Descrição do equipamento</td>
            <td style="padding: 8px; border: 1px solid #d1d5db;">PAT-0000</td>
            <td style="padding: 8px; border: 1px solid #d1d5db;">SN12345678</td>
            <td style="padding: 8px; border: 1px solid #d1d5db;">Carregador, cabos</td>
          </tr>
        </tbody>
      </table>
    `;
    formatDoc("insertHTML", tableHtml);
  };

  // Importação de Arquivo DOCX
  const handleDocxUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".docx")) {
      setImportStatus({
        type: "error",
        message: "Por favor, selecione um arquivo válido do Microsoft Word (.docx).",
      });
      return;
    }

    setImportStatus({ type: "loading", message: `Convertendo arquivo "${file.name}"...` });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h2:fresh",
            "p[style-name='Heading 2'] => h3:fresh",
            "p[style-name='Heading 3'] => h4:fresh",
            "table => table.docx-table",
          ],
        }
      );

      const htmlConverted = result.value;
      const messages = result.messages;

      if (editorRef.current) {
        editorRef.current.innerHTML = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
            ${htmlConverted}
          </div>
        `;
      }

      // Tenta sugerir o título pelo nome do arquivo
      if (!title) {
        const cleanName = file.name.replace(/\.docx$/i, "").replace(/[-_]/g, " ");
        setTitle(cleanName);
      }

      setImportStatus({
        type: "success",
        message: `Arquivo "${file.name}" importado com sucesso! Você pode editar a formatação e adicionar tags dinâmicas.`,
      });
    } catch (err) {
      console.error("Erro na conversão do DOCX:", err);
      setImportStatus({
        type: "error",
        message: `Falha ao processar o arquivo Word: ${err.message || "Formato incompatível"}`,
      });
    }
  };

  // Itens padrão pré-configurados
  const addItemRow = () => {
    setDefaultItems([
      ...defaultItems,
      { item_name: "", category: "Periférico", quantity: 1, condition: "Em perfeito estado", accessories: "" },
    ]);
  };

  const updateItemRow = (index, field, value) => {
    const updated = [...defaultItems];
    updated[index][field] = value;
    setDefaultItems(updated);
  };

  const removeItemRow = (index) => {
    setDefaultItems(defaultItems.filter((_, i) => i !== index));
  };

  // Salvar
  const handleSave = async () => {
    if (!title.trim()) {
      alert("Por favor, informe o título do modelo.");
      return;
    }

    const htmlContent = editorRef.current ? editorRef.current.innerHTML : "";
    if (!htmlContent.trim()) {
      alert("O documento não pode estar vazio.");
      return;
    }

    try {
      setSaving(true);
      await onSave({
        title: title.trim(),
        category: category.trim() || "Geral",
        description: description.trim(),
        content_html: htmlContent,
        default_items: JSON.stringify(defaultItems),
        is_active: true,
      });
    } catch (err) {
      console.error("Erro ao salvar modelo:", err);
      alert("Erro ao salvar modelo: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const dynamicTags = [
    { code: "{{hotel_fasano}}", label: "Hotel Fasano Salvador", desc: "Nome institucional" },
    { code: "{{numero_termo}}", label: "Nº do Termo", desc: "Ex: TR-2026-0001" },
    { code: "{{nome_colaborador}}", label: "Nome do Colaborador", desc: "Beneficiário recebedor titular" },
    { code: "{{documento_cpf_rg}}", label: "CPF / Documento", desc: "Documento do colaborador" },
    { code: "{{setor_departamento}}", label: "Setor / Depto", desc: "Setor de alocação" },
    { code: "{{tecnico_responsavel}}", label: "Técnico / Testemunha", desc: "Técnico emissor e testemunha da entrega" },
    { code: "{{data_emissao}}", label: "Data de Emissão", desc: "Data/hora do registro" },
    { code: "{{tabela_equipamentos}}", label: "Tabela de Equipamentos", desc: "Grade com os itens entregues" },
    { code: "{{assinatura_beneficiario}}", label: "Assinatura Touch (Colaborador)", desc: "1ª Validação: Assinatura manuscrita em tela" },
    { code: "{{foto_biometria}}", label: "Biometria Facial (Colaborador)", desc: "2ª Validação: Foto da prova de vida liveness" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col overflow-hidden animate-fadeIn">
      
      {/* 1. TOP WINDOW BAR (Estilo Word Application Header) */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-400">Word Document Builder</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">Hotel Fasano Salvador</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do modelo de termo..."
              className="text-base font-bold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:bg-slate-800/80 outline-none px-1 py-0.5 rounded text-white w-72 sm:w-96 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Categoria */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 font-medium"
          >
            <option value="Geral">Categoria: Geral</option>
            <option value="Comunicação">Categoria: Comunicação (Rádios/HT)</option>
            <option value="Telefonia">Categoria: Telefonia & Celulares</option>
            <option value="Notebook">Categoria: Notebooks & Estações</option>
            <option value="Acesso e Segurança">Categoria: Chaves, TAGs & Relógio</option>
          </select>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              showPreview ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            }`}
          >
            <Eye size={14} />
            {showPreview ? "Editar" : "Visualizar"}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/30 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} />
            {saving ? "Salvando..." : "Salvar Modelo"}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            title="Fechar Editor"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. RIBBON TABS (Página Inicial, Inserir Tags, Importar DOCX, Itens Padrão) */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 pt-1.5 shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("home")}
            className={`px-4 py-1.5 text-xs font-bold rounded-t-lg transition-all ${
              activeTab === "home"
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            Página Inicial (Formatação)
          </button>
          <button
            onClick={() => setActiveTab("insert")}
            className={`px-4 py-1.5 text-xs font-bold rounded-t-lg flex items-center gap-1.5 transition-all ${
              activeTab === "insert"
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            <Tag size={13} className="text-amber-500" />
            Inserir Tags Dinâmicas
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`px-4 py-1.5 text-xs font-bold rounded-t-lg flex items-center gap-1.5 transition-all ${
              activeTab === "import"
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            <Upload size={13} className="text-blue-400" />
            Importar Arquivo Word (.DOCX)
          </button>
          <button
            onClick={() => setActiveTab("items")}
            className={`px-4 py-1.5 text-xs font-bold rounded-t-lg flex items-center gap-1.5 transition-all ${
              activeTab === "items"
                ? "bg-slate-100 text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            <Layers size={13} className="text-emerald-400" />
            Itens Pré-configurados ({defaultItems.length})
          </button>
        </div>
      </div>

      {/* 3. RIBBON TOOLBAR CONTENT */}
      <div className="bg-slate-100 border-b border-slate-300 p-2 text-slate-800 shrink-0 shadow-sm">
        {/* TAB 1: FORMATAÇÃO ESTILO WORD */}
        {activeTab === "home" && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 overflow-x-auto py-0.5">
            {/* Histórico */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
              <button
                onClick={() => formatDoc("undo")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Desfazer (Ctrl+Z)"
              >
                <Undo size={15} />
              </button>
              <button
                onClick={() => formatDoc("redo")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Refazer (Ctrl+Y)"
              >
                <Redo size={15} />
              </button>
            </div>

            {/* Fonte & Tamanho */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-300">
              <select
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  formatDoc("fontName", e.target.value);
                }}
                className="text-xs bg-white border border-slate-300 rounded px-2 py-1 outline-none font-medium"
              >
                <option value="Arial">Arial</option>
                <option value="Calibri">Calibri</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Segoe UI">Segoe UI</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
              </select>

              <select
                value={fontSize}
                onChange={(e) => {
                  setFontSize(e.target.value);
                  formatDoc("fontSize", e.target.value);
                }}
                className="text-xs bg-white border border-slate-300 rounded px-2 py-1 outline-none font-medium w-16"
              >
                <option value="1">8 pt</option>
                <option value="2">10 pt</option>
                <option value="3">12 pt</option>
                <option value="4">14 pt</option>
                <option value="5">18 pt</option>
                <option value="6">24 pt</option>
                <option value="7">36 pt</option>
              </select>
            </div>

            {/* Estilos Básicos */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
              <button
                onClick={() => formatDoc("bold")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-800 font-bold"
                title="Negrito (Ctrl+B)"
              >
                <Bold size={15} />
              </button>
              <button
                onClick={() => formatDoc("italic")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-800 italic"
                title="Itálico (Ctrl+I)"
              >
                <Italic size={15} />
              </button>
              <button
                onClick={() => formatDoc("underline")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-800 underline"
                title="Sublinhado (Ctrl+U)"
              >
                <Underline size={15} />
              </button>
              <button
                onClick={() => formatDoc("strikeThrough")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-800 line-through"
                title="Tachado"
              >
                <Strikethrough size={15} />
              </button>
            </div>

            {/* Cores */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
              <label className="flex items-center gap-1 p-1 hover:bg-slate-200 rounded cursor-pointer" title="Cor da Fonte">
                <span className="text-xs font-bold border-b-2 border-red-500 px-0.5">A</span>
                <input
                  type="color"
                  className="w-4 h-4 cursor-pointer opacity-0 absolute"
                  onChange={(e) => formatDoc("foreColor", e.target.value)}
                />
              </label>

              <label className="flex items-center gap-1 p-1 hover:bg-slate-200 rounded cursor-pointer" title="Cor de Realce">
                <Palette size={14} className="text-amber-500" />
                <input
                  type="color"
                  className="w-4 h-4 cursor-pointer opacity-0 absolute"
                  onChange={(e) => formatDoc("hiliteColor", e.target.value)}
                />
              </label>
            </div>

            {/* Alinhamento */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
              <button
                onClick={() => formatDoc("justifyLeft")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Alinhar à Esquerda"
              >
                <AlignLeft size={15} />
              </button>
              <button
                onClick={() => formatDoc("justifyCenter")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Centralizar"
              >
                <AlignCenter size={15} />
              </button>
              <button
                onClick={() => formatDoc("justifyRight")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Alinhar à Direita"
              >
                <AlignRight size={15} />
              </button>
              <button
                onClick={() => formatDoc("justifyFull")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Justificar"
              >
                <AlignJustify size={15} />
              </button>
            </div>

            {/* Listas */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
              <button
                onClick={() => formatDoc("insertUnorderedList")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Marcadores"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => formatDoc("insertOrderedList")}
                className="p-1.5 hover:bg-slate-200 rounded text-slate-700"
                title="Numeração"
              >
                <ListOrdered size={15} />
              </button>
            </div>

            {/* Limpar Formatação */}
            <button
              onClick={() => formatDoc("removeFormat")}
              className="px-2 py-1 text-xs hover:bg-slate-200 text-slate-600 rounded flex items-center gap-1 font-medium"
              title="Limpar formatação da seleção"
            >
              Limpar Estilos
            </button>
          </div>
        )}

        {/* TAB 2: INSERIR TAGS DINÂMICAS */}
        {activeTab === "insert" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                Clique em qualquer tag para inserir no cursor do documento:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={insertSampleTable}
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-800 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 shadow-sm"
                >
                  <TableIcon size={13} className="text-blue-600" />
                  Inserir Tabela
                </button>
                <button
                  onClick={() => formatDoc("insertHorizontalRule")}
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-800 text-xs font-bold rounded border border-slate-300 shadow-sm"
                >
                  Inserir Linha (HR)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {dynamicTags.map((tag) => (
                <button
                  key={tag.code}
                  onClick={() => insertTagAtCursor(tag.code)}
                  className="px-2.5 py-1 bg-white hover:bg-amber-50 hover:border-amber-400 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 transition-all flex items-center gap-1.5 shadow-sm group"
                  title={tag.desc}
                >
                  <span className="font-bold text-amber-600">{tag.code}</span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-700">({tag.label})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: IMPORTAÇÃO DOCX */}
        {activeTab === "import" && (
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-all">
                <Upload size={15} />
                Escolher Arquivo Word (.docx)
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleDocxUpload}
                  className="hidden"
                />
              </label>

              <span className="text-xs text-slate-600">
                O arquivo .docx será convertido automaticamente preservando cabeçalhos, negritos, tabelas e parágrafos.
              </span>
            </div>

            {importStatus && (
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 ${
                  importStatus.type === "success"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : importStatus.type === "error"
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-blue-100 text-blue-800 border border-blue-300"
                }`}
              >
                {importStatus.type === "success" && <Check size={14} />}
                {importStatus.type === "error" && <AlertCircle size={14} />}
                <span>{importStatus.message}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ITENS PRÉ-CONFIGURADOS DO MODELO */}
        {activeTab === "items" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600 font-semibold">
                Itens que serão adicionados automaticamente quando o técnico abrir um termo com este modelo:
              </span>
              <button
                onClick={addItemRow}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm"
              >
                <Plus size={13} />
                Adicionar Item Padrão
              </button>
            </div>

            {defaultItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-1">
                Nenhum item pré-configurado. O técnico adicionará os equipamentos manualmente no ato da entrega.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {defaultItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-lg text-xs shadow-sm"
                  >
                    <input
                      type="text"
                      placeholder="Nome do item"
                      value={item.item_name}
                      onChange={(e) => updateItemRow(idx, "item_name", e.target.value)}
                      className="w-36 font-semibold outline-none border-b border-transparent focus:border-blue-500"
                    />
                    <select
                      value={item.category}
                      onChange={(e) => updateItemRow(idx, "category", e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded text-[11px] px-1 py-0.5 outline-none"
                    >
                      <option value="Periférico">Periférico</option>
                      <option value="Comunicação">Comunicação</option>
                      <option value="Telefonia">Telefonia</option>
                      <option value="Notebook">Notebook</option>
                      <option value="Acesso">Acesso</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Acessórios"
                      value={item.accessories}
                      onChange={(e) => updateItemRow(idx, "accessories", e.target.value)}
                      className="w-28 text-slate-600 outline-none border-b border-transparent focus:border-blue-500 text-[11px]"
                    />
                    <button
                      onClick={() => removeItemRow(idx)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                      title="Remover"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. CANVAS / DESK COM FOLHA A4 SIMULADA */}
      <div className="flex-1 overflow-auto bg-slate-300/80 p-4 sm:p-8 flex justify-center">
        <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-2xl p-8 sm:p-14 border border-slate-300 relative flex flex-col">
          
          {/* Régua visual discreta estilo Word */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-amber-400 to-blue-500 opacity-60"></div>

          {/* Área de edição de conteúdo da Folha */}
          <div
            ref={editorRef}
            contentEditable={!showPreview}
            className={`flex-1 outline-none text-slate-900 leading-relaxed ${
              showPreview ? "cursor-default" : "cursor-text focus:ring-1 focus:ring-blue-400/30 rounded p-1"
            }`}
            style={{
              fontFamily: fontFamily,
              minHeight: "260mm",
            }}
          />

          {/* Rodapé da folha */}
          <div className="mt-12 pt-4 border-t border-slate-200 text-center text-xs text-slate-400 flex items-center justify-between">
            <span>Hotel Fasano Salvador — TI Corporativa</span>
            <span>Documento Gerado Eletronicamente</span>
          </div>
        </div>
      </div>

      {/* 5. BOTTOM STATUS BAR (Estilo Word Status Bar) */}
      <div className="bg-slate-900 text-slate-400 text-xs px-4 py-1.5 flex items-center justify-between border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <span>Página 1 de 1</span>
          <span>•</span>
          <span>Formato: Papel A4 (210 × 297 mm)</span>
          <span>•</span>
          <span className="text-amber-400">Suporte a Tags Dinâmicas</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-emerald-400 flex items-center gap-1">
            <Check size={12} /> Pronto para gravação
          </span>
        </div>
      </div>

    </div>
  );
}
