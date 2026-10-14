import { useState, useEffect } from "react";
import { 
  X, Plus, Trash2, Headphones, Radio, Smartphone, 
  Laptop, Key, Clock, Package, AlertCircle, RefreshCw, 
  Search, CheckCircle2, User, Building2, Calendar, FileText
} from "lucide-react";
import api from "../../../api/client";

const QUICK_PRESETS = [
  { name: "Fone de Ouvido Estéreo", category: "Periférico", icon: Headphones, condition: "Em perfeito estado", accessories: "Bolsa de transporte" },
  { name: "Rádio Comunicador (HT)", category: "Comunicação", icon: Radio, condition: "Em perfeito estado", accessories: "Carregador de base, Bateria, Clipe de cinto" },
  { name: "Celular Corporativo", category: "Telefonia", icon: Smartphone, condition: "Em perfeito estado", accessories: "Carregador, Cabo USB, Capa protetora" },
  { name: "Notebook Corporativo", category: "Notebook", icon: Laptop, condition: "Em perfeito estado", accessories: "Carregador original, Case/Mochila" },
  { name: "Chave de Acesso / Chave Mestra", category: "Controle de Acesso", icon: Key, condition: "Em perfeito estado", accessories: "Chaveiro numerado" },
  { name: "Relógio de Acesso / Crachá Proximidade", category: "Controle de Acesso", icon: Clock, condition: "Em perfeito estado", accessories: "Cordão corporativo" },
];

export default function NewTermModal({ isOpen, onClose, onSuccess, onSaveAndSign }) {
  const [beneficiaryType, setBeneficiaryType] = useState("ad_user"); // 'ad_user' | 'external_user'
  const [adUsers, setAdUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form Fields
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryDocument, setBeneficiaryDocument] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [beneficiaryEmail, setBeneficiaryEmail] = useState("");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  // Items List
  const [items, setItems] = useState([
    {
      item_name: "Fone de Ouvido Estéreo",
      category: "Periférico",
      asset_tag: "",
      serial_number: "",
      quantity: 1,
      condition: "Em perfeito estado de funcionamento",
      accessories: "",
      notes: "",
    }
  ]);

  // Carregar usuários, departamentos e modelos de termos
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        setLoadingInitial(true);
        const [usersRes, deptsRes, tmplsRes] = await Promise.all([
          api.get("/users?is_room=false&is_active=true"),
          api.get("/departments"),
          api.get("/terms/templates?only_active=true"),
        ]);
        setAdUsers(usersRes.data || []);
        setDepartments(deptsRes.data || []);
        const loadedTemplates = tmplsRes.data || [];
        setTemplates(loadedTemplates);

        // Se ainda não escolheu modelo e houver templates, seleciona o primeiro por padrão
        if (loadedTemplates.length > 0 && !selectedTemplateId) {
          const first = loadedTemplates[0];
          setSelectedTemplateId(String(first.id));
          setSelectedTemplate(first);
          if (first.default_items) {
            try {
              const parsed = JSON.parse(first.default_items);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setItems(parsed.map((p) => ({
                  item_name: p.item_name || "",
                  category: p.category || "Periférico",
                  asset_tag: "",
                  serial_number: "",
                  quantity: p.quantity || 1,
                  condition: p.condition || "Em perfeito estado de funcionamento",
                  accessories: p.accessories || "",
                  notes: "",
                })));
              }
            } catch (e) {
              console.error("Erro ao aplicar default items:", e);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, [isOpen]);

  // Troca de modelo de termo
  const handleSelectTemplate = (tmplId) => {
    setSelectedTemplateId(tmplId);
    const found = templates.find((t) => String(t.id) === String(tmplId));
    setSelectedTemplate(found || null);

    if (found && found.default_items) {
      try {
        const parsed = JSON.parse(found.default_items);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed.map((p) => ({
            item_name: p.item_name || "",
            category: p.category || "Periférico",
            asset_tag: "",
            serial_number: "",
            quantity: p.quantity || 1,
            condition: p.condition || "Em perfeito estado de funcionamento",
            accessories: p.accessories || "",
            notes: "",
          })));
        }
      } catch (e) {
        console.error("Erro ao carregar itens do modelo:", e);
      }
    }
  };

  // Ao selecionar um usuário do AD
  const handleSelectAdUser = (userId) => {
    setSelectedUserId(userId);
    const found = adUsers.find((u) => String(u.id) === String(userId));
    if (found) {
      setBeneficiaryName(found.display_name || found.ad_username);
      setBeneficiaryEmail(found.email || "");
      setBeneficiaryPhone(found.phone || "");
      if (found.department_id) {
        setDepartmentId(found.department_id);
        setDepartmentName(found.department_name || "");
      }
    }
  };

  const filteredAdUsers = adUsers.filter((u) => {
    if (!userSearch) return true;
    const term = userSearch.toLowerCase();
    return (
      (u.display_name && u.display_name.toLowerCase().includes(term)) ||
      (u.ad_username && u.ad_username.toLowerCase().includes(term)) ||
      (u.department_name && u.department_name.toLowerCase().includes(term))
    );
  });

  // Manipulação de itens
  const addItem = (preset = null) => {
    const newItem = preset ? {
      item_name: preset.name,
      category: preset.category,
      asset_tag: "",
      serial_number: "",
      quantity: 1,
      condition: preset.condition || "Em perfeito estado de funcionamento",
      accessories: preset.accessories || "",
      notes: "",
    } : {
      item_name: "",
      category: "Geral",
      asset_tag: "",
      serial_number: "",
      quantity: 1,
      condition: "Em perfeito estado de funcionamento",
      accessories: "",
      notes: "",
    };

    setItems([...items, newItem]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const removeItem = (index) => {
    if (items.length <= 1) {
      setError("O termo precisa ter pelo menos 1 equipamento ou acessório.");
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (andSignNow = false) => {
    setError(null);

    // Validações
    if (beneficiaryType === "ad_user") {
      if (!selectedUserId && !beneficiaryName) {
        setError("Por favor, selecione o colaborador com conta de rede.");
        return;
      }
    } else {
      if (!beneficiaryName.trim()) {
        setError("Por favor, informe o nome completo do recebedor.");
        return;
      }
      if (!departmentName && !departmentId) {
        setError("Por favor, informe o setor/departamento do colaborador.");
        return;
      }
    }

    if (items.some((it) => !it.item_name.trim())) {
      setError("Todos os itens da lista precisam ter um nome preenchido.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        template_id: selectedTemplateId ? Number(selectedTemplateId) : null,
        legal_text: selectedTemplate?.content_html || null,
        term_type: "retirada",
        beneficiary_type: beneficiaryType,
        user_id: beneficiaryType === "ad_user" && selectedUserId ? Number(selectedUserId) : null,
        beneficiary_name: beneficiaryName.trim(),
        beneficiary_document: beneficiaryDocument.trim() || null,
        department_id: departmentId ? Number(departmentId) : null,
        department_name: departmentName || null,
        beneficiary_email: beneficiaryEmail.trim() || null,
        beneficiary_phone: beneficiaryPhone.trim() || null,
        has_ad_account: beneficiaryType === "ad_user",
        expected_return_date: expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          item_name: it.item_name.trim(),
          category: it.category,
          asset_tag: it.asset_tag?.trim() || null,
          serial_number: it.serial_number?.trim() || null,
          quantity: Number(it.quantity) || 1,
          condition: it.condition || "Em perfeito estado de funcionamento",
          accessories: it.accessories?.trim() || null,
          notes: it.notes?.trim() || null,
        })),
      };

      const res = await api.post("/terms", payload);
      const createdTerm = res.data;

      if (andSignNow && onSaveAndSign) {
        onSaveAndSign(createdTerm);
      } else {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      console.error("Erro ao emitir termo:", err);
      setError(err.response?.data?.detail || "Erro ao criar termo de retirada.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Novo Termo de Retirada de Equipamentos</h3>
              <p className="text-xs text-slate-300">Cadastre a entrega e prepare para assinatura e validação facial</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SELEÇÃO DO MODELO DE DOCUMENTO (BUILDER / TEMPLATES) */}
          <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-5 rounded-2xl border border-blue-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Modelo de Documento & Termo
                </h4>
                <p className="text-xs text-slate-500">Escolha o modelo formatado para pré-preencher itens e texto legal</p>
              </div>

              {selectedTemplate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-lg self-start sm:self-auto">
                  Categoria: {selectedTemplate.category}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selecione o Modelo de Termo *
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  <option value="">Sem modelo (Termo Avulso / Padrão)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.category}] {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate?.description && (
                <div className="flex items-center text-xs text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-200">
                  <span>{selectedTemplate.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* SELEÇÃO DO BENEFICIÁRIO (COM OU SEM AD) */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <User size={18} className="text-blue-600" />
                  Identificação do Colaborador / Recebedor
                </h4>
                <p className="text-xs text-slate-500">Selecione se o colaborador já possui usuário de rede ou se é prestador/sem rede</p>
              </div>

              {/* Toggle de Tipo de Beneficiário */}
              <div className="inline-flex p-1 bg-slate-200/80 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setBeneficiaryType("ad_user"); setError(null); }}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    beneficiaryType === "ad_user"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ✓ Usuário de Rede (AD)
                </button>
                <button
                  type="button"
                  onClick={() => { setBeneficiaryType("external_user"); setSelectedUserId(""); setError(null); }}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    beneficiaryType === "external_user"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🏢 Sem Usuário de Rede
                </button>
              </div>
            </div>

            {/* Campos se tiver Usuário AD */}
            {beneficiaryType === "ad_user" ? (
              <div className="space-y-3 pt-2">
                {selectedUserId ? (
                  /* Card do Colaborador Selecionado */
                  <div className="bg-white border-2 border-blue-500/30 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 font-extrabold text-base flex items-center justify-center shrink-0 border border-blue-200">
                        {(beneficiaryName || "C").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">{beneficiaryName}</span>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                            {adUsers.find((u) => String(u.id) === String(selectedUserId))?.ad_username || "AD"}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-md">
                            {departmentName || "Geral"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          {beneficiaryEmail && <span>E-mail: <strong className="text-slate-600">{beneficiaryEmail}</strong></span>}
                          {beneficiaryPhone && <span>Tel: <strong className="text-slate-600">{beneficiaryPhone}</strong></span>}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId("");
                        setBeneficiaryName("");
                        setBeneficiaryEmail("");
                        setBeneficiaryPhone("");
                        setUserSearch("");
                        setIsUserDropdownOpen(false);
                      }}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 hover:text-red-600"
                    >
                      <X size={15} />
                      Trocar Colaborador
                    </button>
                  </div>
                ) : (
                  /* Campo Único de Busca e Autocomplete */
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Localizar e Selecionar Colaborador (Active Directory) *
                    </label>
                    <div className="relative">
                      <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Digite o nome, login ou setor para pesquisar..."
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          setIsUserDropdownOpen(true);
                        }}
                        onFocus={() => setIsUserDropdownOpen(true)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
                      />
                      {userSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserSearch("");
                            setIsUserDropdownOpen(true);
                          }}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Flutuante de Colaboradores */}
                    {isUserDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-30" 
                          onClick={() => setIsUserDropdownOpen(false)} 
                        />
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-40 max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {filteredAdUsers.length > 0 ? (
                          filteredAdUsers.map((u) => (
                            <div
                              key={u.id}
                              onClick={() => {
                                handleSelectAdUser(u.id);
                                setIsUserDropdownOpen(false);
                                setUserSearch("");
                              }}
                              className="p-3 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between gap-3 text-left"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {(u.display_name || u.ad_username || "U").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900 leading-tight">
                                    {u.display_name || u.ad_username}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {u.ad_username} {u.email ? `• ${u.email}` : ""}
                                  </p>
                                </div>
                              </div>

                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md shrink-0">
                                {u.department_name || "Geral"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Nenhum colaborador encontrado para "{userSearch}"
                          </div>
                        )}
                      </div>
                    </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Campos se NÃO tiver Usuário AD */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome Completo do Colaborador / Prestador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva Santos"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Setor / Departamento *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setDepartmentId(id);
                      const dept = departments.find((d) => String(d.id) === String(id));
                      setDepartmentName(dept ? dept.name : "");
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o setor...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Documento (CPF / RG / Matrícula)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 000.000.000-00"
                    value={beneficiaryDocument}
                    onChange={(e) => setBeneficiaryDocument(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / Celular (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (71) 99999-9999"
                    value={beneficiaryPhone}
                    onChange={(e) => setBeneficiaryPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    placeholder="Ex: prestador@empresa.com"
                    value={beneficiaryEmail}
                    onChange={(e) => setBeneficiaryEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* EQUIPAMENTOS E ACESSÓRIOS */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Package size={18} className="text-blue-600" />
                  Equipamentos e Acessórios a Retirar
                </h4>
                <p className="text-xs text-slate-500">Clique nos atalhos rápidos para adicionar os itens frequentes do hotel</p>
              </div>

              <button
                type="button"
                onClick={() => addItem()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus size={16} />
                Adicionar Item Avulso
              </button>
            </div>

            {/* Presets Rápidos */}
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => addItem(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
                >
                  <preset.icon size={14} className="text-blue-600" />
                  + {preset.name}
                </button>
              ))}
            </div>

            {/* Lista dos Itens */}
            <div className="space-y-3 pt-2">
              {items.map((item, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 relative group">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      Item do Termo
                    </span>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remover este item"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Descrição do Equipamento *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Fone de Ouvido Estéreo Jabra"
                        value={item.item_name}
                        onChange={(e) => updateItem(index, "item_name", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Patrimônio (Tag)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: PAT-0129"
                        value={item.asset_tag}
                        onChange={(e) => updateItem(index, "asset_tag", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Número de Série (S/N)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: SN9842148"
                        value={item.serial_number}
                        onChange={(e) => updateItem(index, "serial_number", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Estado de Conservação
                      </label>
                      <input
                        type="text"
                        value={item.condition}
                        onChange={(e) => updateItem(index, "condition", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Acessórios Inclusos
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Carregador, Cabo USB-C, Case de proteção..."
                        value={item.accessories}
                        onChange={(e) => updateItem(index, "accessories", e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DADOS ADICIONAIS: DEVOLUÇÃO PREVISTA E OBSERVAÇÕES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-600" />
                Data Prevista de Devolução (Opcional)
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400">Deixe em branco para termo por tempo indeterminado</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observações Adicionais
              </label>
              <input
                type="text"
                placeholder="Ex: Equipamento entregue para evento especial no Rooftop"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

        </div>

        {/* Rodapé de Ações */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-blue-600 text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Salvar Termo
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Salvar e Assinar Agora no Tablet
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
