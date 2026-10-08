import { useState, useEffect, useMemo } from "react";
import { 
  FileText, Briefcase, Plus, Search, Filter, Calendar, 
  Clock, AlertTriangle, CheckCircle2, ChevronRight, X, 
  ExternalLink, Phone, Mail, MessageSquare, Upload, Download, 
  DollarSign, Check, Trash2, Edit3, Eye, Copy, RefreshCw, 
  Building2, Users, Layers, ShieldAlert, FileCheck
} from "lucide-react";
import api from "../../api/client";

// Formatação de Moeda
function formatCurrency(val) {
  if (val === undefined || val === null) return "R$ 0,00";
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Formatação de Data
function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(dateStr).toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

export default function Contracts() {
  const [activeTab, setActiveTab] = useState("contracts"); // contracts, suppliers, invoices
  const [dashboard, setDashboard] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");

  // Modais
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [activeSupplierForContact, setActiveSupplierForContact] = useState(null);

  // Estados de formulário do Contrato
  const [contractForm, setContractForm] = useState({
    contract_number: "",
    title: "",
    supplier_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
    renewal_type: "Automática",
    notice_period_days: 30,
    monthly_cost: "",
    total_cost: "",
    payment_terms: "Boleto Bancário 28 DDL",
    status: "ACTIVE",
    notification_emails: "",
    notes: "",
    auto_generate_invoices: true,
  });

  // Estados de formulário do Fornecedor
  const [supplierForm, setSupplierForm] = useState({
    corporate_name: "",
    trade_name: "",
    cnpj: "",
    category: "Telecom",
    support_portal: "",
    address: "",
    notes: "",
    initial_contact_name: "",
    initial_contact_email: "",
    initial_contact_phone: "",
    initial_contact_whatsapp: "",
    initial_contact_role: "Gerente de Contas",
    initial_contact_type: "Comercial",
  });

  // Novo contato avulso
  const [contactForm, setContactForm] = useState({
    name: "",
    role_title: "",
    contact_type: "Suporte",
    email: "",
    phone: "",
    mobile_whatsapp: "",
    is_primary: false,
    notes: "",
  });

  // Novo serviço avulso
  const [serviceForm, setServiceForm] = useState({
    name: "",
    service_type: "Serviço Recorrente",
    quantity: 1,
    unit: "un",
    unit_price: "",
    description: "",
  });

  // Nova fatura avulsa
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: "",
    competence: "",
    due_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_code: "",
    notes: "",
  });

  // Carregar dados gerais
  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, contractsRes, suppliersRes, invoicesRes] = await Promise.all([
        api.get("/contracts/dashboard"),
        api.get("/contracts"),
        api.get("/suppliers"),
        api.get("/contracts/invoices/all"),
      ]);
      setDashboard(dashRes.data);
      setContracts(contractsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setAllInvoices(invoicesRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados de contratos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Recarregar detalhe do contrato se estiver aberto
  const refreshSelectedContract = async (contractId) => {
    try {
      const res = await api.get(`/contracts/${contractId}`);
      setSelectedContract(res.data);
      loadData();
    } catch (err) {
      console.error("Erro ao atualizar detalhes:", err);
    }
  };

  // Submissão de Fornecedor
  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        corporate_name: supplierForm.corporate_name,
        trade_name: supplierForm.trade_name,
        cnpj: supplierForm.cnpj || null,
        category: supplierForm.category,
        support_portal: supplierForm.support_portal || null,
        address: supplierForm.address || null,
        notes: supplierForm.notes || null,
      };

      if (supplierForm.initial_contact_name) {
        payload.initial_contacts = [{
          name: supplierForm.initial_contact_name,
          role_title: supplierForm.initial_contact_role,
          contact_type: supplierForm.initial_contact_type,
          email: supplierForm.initial_contact_email || null,
          phone: supplierForm.initial_contact_phone || null,
          mobile_whatsapp: supplierForm.initial_contact_whatsapp || null,
          is_primary: true,
        }];
      }

      await api.post("/suppliers", payload);
      setIsSupplierModalOpen(false);
      setSupplierForm({
        corporate_name: "",
        trade_name: "",
        cnpj: "",
        category: "Telecom",
        support_portal: "",
        address: "",
        notes: "",
        initial_contact_name: "",
        initial_contact_email: "",
        initial_contact_phone: "",
        initial_contact_whatsapp: "",
        initial_contact_role: "Gerente de Contas",
        initial_contact_type: "Comercial",
      });
      loadData();
    } catch (err) {
      alert("Erro ao cadastrar fornecedor: " + (err.response?.data?.detail || err.message));
    }
  };

  // Submissão de Contrato
  const handleSaveContract = async (e) => {
    e.preventDefault();
    if (!contractForm.supplier_id) {
      alert("Selecione um fornecedor para o contrato.");
      return;
    }
    try {
      const payload = {
        contract_number: contractForm.contract_number || null,
        title: contractForm.title,
        supplier_id: Number(contractForm.supplier_id),
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        renewal_type: contractForm.renewal_type,
        notice_period_days: Number(contractForm.notice_period_days) || 30,
        monthly_cost: Number(contractForm.monthly_cost) || 0,
        total_cost: Number(contractForm.total_cost) || (Number(contractForm.monthly_cost) * 12) || 0,
        payment_terms: contractForm.payment_terms,
        status: contractForm.status,
        notification_emails: contractForm.notification_emails || null,
        notes: contractForm.notes || null,
        auto_generate_invoices: contractForm.auto_generate_invoices,
      };

      await api.post("/contracts", payload);
      setIsContractModalOpen(false);
      setContractForm({
        contract_number: "",
        title: "",
        supplier_id: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
        renewal_type: "Automática",
        notice_period_days: 30,
        monthly_cost: "",
        total_cost: "",
        payment_terms: "Boleto Bancário 28 DDL",
        status: "ACTIVE",
        notification_emails: "",
        notes: "",
        auto_generate_invoices: true,
      });
      loadData();
    } catch (err) {
      alert("Erro ao cadastrar contrato: " + (err.response?.data?.detail || err.message));
    }
  };

  // Adicionar Contato Avulso
  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!activeSupplierForContact) return;
    try {
      await api.post(`/suppliers/${activeSupplierForContact.id}/contacts`, contactForm);
      setIsContactModalOpen(false);
      setContactForm({
        name: "",
        role_title: "",
        contact_type: "Suporte",
        email: "",
        phone: "",
        mobile_whatsapp: "",
        is_primary: false,
        notes: "",
      });
      loadData();
      if (selectedContract && selectedContract.supplier_id === activeSupplierForContact.id) {
        refreshSelectedContract(selectedContract.id);
      }
    } catch (err) {
      alert("Erro ao adicionar contato: " + (err.response?.data?.detail || err.message));
    }
  };

  // Adicionar Serviço ao Contrato Aberto
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!selectedContract) return;
    try {
      await api.post(`/contracts/${selectedContract.id}/services`, {
        ...serviceForm,
        unit_price: Number(serviceForm.unit_price) || 0,
        quantity: Number(serviceForm.quantity) || 1,
      });
      setServiceForm({
        name: "",
        service_type: "Serviço Recorrente",
        quantity: 1,
        unit: "un",
        unit_price: "",
        description: "",
      });
      refreshSelectedContract(selectedContract.id);
    } catch (err) {
      alert("Erro ao vincular serviço: " + (err.response?.data?.detail || err.message));
    }
  };

  // Adicionar Fatura ao Contrato Aberto
  const handleAddInvoice = async (e) => {
    e.preventDefault();
    if (!selectedContract) return;
    try {
      await api.post(`/contracts/${selectedContract.id}/invoices`, {
        ...invoiceForm,
        amount: Number(invoiceForm.amount) || 0,
        status: "PENDING",
      });
      setInvoiceForm({
        invoice_number: "",
        competence: "",
        due_date: new Date().toISOString().split("T")[0],
        amount: "",
        payment_code: "",
        notes: "",
      });
      refreshSelectedContract(selectedContract.id);
    } catch (err) {
      alert("Erro ao lançar fatura: " + (err.response?.data?.detail || err.message));
    }
  };

  // Dar baixa/pagamento na fatura
  const handlePayInvoice = async (invoiceId) => {
    if (!confirm("Confirmar o pagamento/liquidação desta fatura?")) return;
    try {
      await api.patch(`/contracts/invoices/${invoiceId}/pay`);
      loadData();
      if (selectedContract) refreshSelectedContract(selectedContract.id);
    } catch (err) {
      alert("Erro ao registrar pagamento: " + (err.response?.data?.detail || err.message));
    }
  };

  // Upload de Contrato PDF
  const handleUploadContractDoc = async (contractId, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post(`/contracts/${contractId}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      loadData();
      if (selectedContract && selectedContract.id === contractId) refreshSelectedContract(contractId);
      alert("Documento do contrato anexado com sucesso!");
    } catch (err) {
      alert("Erro no upload do contrato: " + (err.response?.data?.detail || err.message));
    }
  };

  // Upload de Boleto/NF da Fatura
  const handleUploadInvoiceDoc = async (invoiceId, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post(`/contracts/invoices/${invoiceId}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      loadData();
      if (selectedContract) refreshSelectedContract(selectedContract.id);
      alert("Comprovante/Boleto da fatura anexado com sucesso!");
    } catch (err) {
      alert("Erro no upload da fatura: " + (err.response?.data?.detail || err.message));
    }
  };

  // Disparar Alertas de Teste
  const handleTriggerAlerts = async () => {
    try {
      const res = await api.post("/contracts/alerts/trigger");
      alert(res.data.detail);
    } catch (err) {
      alert("Erro ao verificar alertas: " + (err.response?.data?.detail || err.message));
    }
  };

  // Filtros aplicados em Contratos
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (supplierFilter && String(c.supplier_id) !== String(supplierFilter)) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const titleMatch = c.title?.toLowerCase().includes(term);
        const numMatch = c.contract_number?.toLowerCase().includes(term);
        const supMatch = c.supplier_name?.toLowerCase().includes(term) || c.supplier_trade_name?.toLowerCase().includes(term);
        if (!titleMatch && !numMatch && !supMatch) return false;
      }
      return true;
    });
  }, [contracts, statusFilter, supplierFilter, searchTerm]);

  // Filtros aplicados em Faturas
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(i => {
      if (invoiceStatusFilter && i.status !== invoiceStatusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const numMatch = i.invoice_number?.toLowerCase().includes(term);
        const compMatch = i.competence?.toLowerCase().includes(term);
        const supMatch = i.supplier_name?.toLowerCase().includes(term);
        const titleMatch = i.contract_title?.toLowerCase().includes(term);
        if (!numMatch && !compMatch && !supMatch && !titleMatch) return false;
      }
      return true;
    });
  }, [allInvoices, invoiceStatusFilter, searchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================
          CABEÇALHO EXECUTIVO
          ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shadow-sm">
            <Briefcase size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Contratos & Fornecedores
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Governança TI
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Gestão de vigência de contratos, controle de parcelas e faturas mensais, serviços e contatos de fornecedores.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerAlerts}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Disparar verificação de e-mails de alerta agora"
          >
            <AlertTriangle size={15} className="text-amber-600" />
            Testar Alertas
          </button>

          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Building2 size={15} className="text-slate-500" />
            + Fornecedor
          </button>

          <button
            onClick={() => setIsContractModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Plus size={16} />
            + Novo Contrato
          </button>
        </div>
      </div>

      {/* ========================================================
          CARDS DE RESUMO (KPIs)
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Contratos Ativos e Custo Mensal */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Contratos Vigentes</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <FileCheck size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black font-mono text-slate-900">
              {dashboard?.active_contracts_count || 0}
            </span>
            <span className="text-xs font-bold text-slate-400">ativos</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Custo Recorrente:</span>
            <span className="font-extrabold text-blue-700 font-mono">
              {formatCurrency(dashboard?.monthly_cost_total)}/mês
            </span>
          </div>
        </div>

        {/* Card 2: Vencimento Próximo (Alerta 60 dias) */}
        <div className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
          (dashboard?.expiring_contracts_count || 0) > 0
            ? "bg-amber-50/40 border-amber-300"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">A Vencer (60 dias)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-3xl font-black font-mono ${
              (dashboard?.expiring_contracts_count || 0) > 0 ? "text-amber-700" : "text-slate-900"
            }`}>
              {dashboard?.expiring_contracts_count || 0}
            </span>
            <span className="text-xs font-bold text-slate-400">contratos</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>{dashboard?.expired_contracts_count || 0} já vencidos</span>
            <span className="font-bold text-amber-700">Aviso prévio</span>
          </div>
        </div>

        {/* Card 3: Faturas a Vencer no Mês */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturas do Mês</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono text-emerald-700">
              {formatCurrency(dashboard?.month_invoices_amount)}
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Pendentes de baixa:</span>
            <span className="font-bold text-slate-800 font-mono">
              {dashboard?.pending_invoices_count || 0} faturas
            </span>
          </div>
        </div>

        {/* Card 4: Faturas Atrasadas */}
        <div className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
          (dashboard?.overdue_invoices_count || 0) > 0
            ? "bg-red-50/50 border-red-300"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturas Vencidas</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              (dashboard?.overdue_invoices_count || 0) > 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400"
            }`}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-3xl font-black font-mono ${
              (dashboard?.overdue_invoices_count || 0) > 0 ? "text-red-600 font-extrabold" : "text-slate-900"
            }`}>
              {dashboard?.overdue_invoices_count || 0}
            </span>
            <span className="text-xs font-bold text-slate-400">boletos em atraso</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Fornecedores Ativos:</span>
            <span className="font-bold text-slate-700">{dashboard?.total_suppliers_count || 0} parceiros</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          ABAS DE NAVEGAÇÃO
          ======================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("contracts")}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "contracts"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Contratos ({contracts.length})
            </button>
            <button
              onClick={() => setActiveTab("suppliers")}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "suppliers"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Fornecedores & Contatos ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab("invoices")}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "invoices"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Faturas & Contas a Pagar ({allInvoices.length})
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar contrato, fornecedor, nota..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* ========================================================
            TAB 1: LISTAGEM DE CONTRATOS
            ======================================================== */}
        {activeTab === "contracts" && (
          <div className="space-y-4">
            {/* Filtros em Linha */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">Todos os Status</option>
                <option value="ACTIVE">Vigentes</option>
                <option value="EXPIRING_SOON">Vencendo em até 60 dias</option>
                <option value="EXPIRED">Vencidos</option>
                <option value="CANCELLED">Cancelados</option>
              </select>

              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">Todos os Fornecedores</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.trade_name}</option>
                ))}
              </select>

              {(statusFilter || supplierFilter || searchTerm) && (
                <button
                  onClick={() => { setStatusFilter(""); setSupplierFilter(""); setSearchTerm(""); }}
                  className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-2xl transition-all cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* Tabela de Contratos */}
            {filteredContracts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <FileText size={36} className="mx-auto text-slate-300" />
                <p className="font-bold text-sm text-slate-700">Nenhum contrato cadastrado ou encontrado.</p>
                <p className="text-xs">Cadastre seu primeiro contrato para controlar vigência e faturas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="pb-3 pl-2">Contrato / Objeto</th>
                      <th className="pb-3">Fornecedor</th>
                      <th className="pb-3">Vigência</th>
                      <th className="pb-3 text-right">Custo Mensal</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3">E-mails Notificados</th>
                      <th className="pb-3 text-right pr-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredContracts.map((c) => {
                      const isExpiring = c.is_expiring_soon;
                      const isExpired = c.is_expired;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 pl-2">
                            <div className="font-bold text-slate-900">{c.title}</div>
                            <div className="text-xs text-slate-400 font-mono">
                              #{c.contract_number || `CTR-${c.id}`} • {c.services?.length || 0} serviço(s)
                            </div>
                          </td>

                          <td className="py-3.5">
                            <div className="font-semibold text-slate-800">{c.supplier_trade_name || c.supplier_name}</div>
                            <div className="text-xs text-slate-400">Renovação: {c.renewal_type}</div>
                          </td>

                          <td className="py-3.5">
                            <div className="text-xs font-bold text-slate-700">
                              {formatDate(c.start_date)} até {formatDate(c.end_date)}
                            </div>
                            <div className="mt-1">
                              {isExpired ? (
                                <span className="text-[10px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  Vencido há {Math.abs(c.days_until_expiration)} dias
                                </span>
                              ) : isExpiring ? (
                                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Vence em {c.days_until_expiration} dias
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                  Restam {c.days_until_expiration} dias
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 text-right font-mono font-bold text-slate-800">
                            {formatCurrency(c.monthly_cost)}
                          </td>

                          <td className="py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" :
                              c.status === "EXPIRING_SOON" ? "bg-amber-100 text-amber-800" :
                              c.status === "EXPIRED" ? "bg-red-100 text-red-800" :
                              "bg-slate-100 text-slate-700"
                            }`}>
                              {c.status === "ACTIVE" ? "Vigente" : c.status === "EXPIRING_SOON" ? "A Vencer" : c.status === "EXPIRED" ? "Vencido" : c.status}
                            </span>
                          </td>

                          <td className="py-3.5 max-w-[200px] truncate">
                            {c.notification_emails ? (
                              <div className="flex items-center gap-1 text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-1 rounded-xl truncate" title={c.notification_emails}>
                                <Mail size={12} className="shrink-0" />
                                <span className="truncate">{c.notification_emails}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Padrão da TI</span>
                            )}
                          </td>

                          <td className="py-3.5 text-right pr-2">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.attachment_path && (
                                <a
                                  href={c.attachment_path}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Baixar Contrato PDF"
                                >
                                  <Download size={16} />
                                </a>
                              )}
                              <label className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Anexar PDF do Contrato">
                                <Upload size={16} />
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.jpg,.png"
                                  onChange={(e) => handleUploadContractDoc(c.id, e.target.files[0])}
                                />
                              </label>
                              <button
                                onClick={() => { setSelectedContract(c); setIsDetailDrawerOpen(true); }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                Ver Detalhes
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: FORNECEDORES & CONTATOS
            ======================================================== */}
        {activeTab === "suppliers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 hover:bg-white hover:border-blue-200 transition-all shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{s.trade_name}</h3>
                      <p className="text-xs text-slate-400">{s.corporate_name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                      {s.category || "Geral"}
                    </span>
                  </div>

                  {s.cnpj && (
                    <div className="text-xs text-slate-500 font-mono mb-2">
                      CNPJ: {s.cnpj}
                    </div>
                  )}

                  {s.support_portal && (
                    <a
                      href={s.support_portal}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline mb-3"
                    >
                      <ExternalLink size={12} />
                      Portal de Suporte / Chamados
                    </a>
                  )}

                  {/* Lista de Contatos */}
                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-200/60">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Contatos Cadastrados</span>
                      <button
                        onClick={() => { setActiveSupplierForContact(s); setIsContactModalOpen(true); }}
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-bold cursor-pointer"
                      >
                        + Adicionar
                      </button>
                    </div>

                    {s.contacts?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhum contato cadastrado.</p>
                    ) : (
                      s.contacts.map((contact) => (
                        <div key={contact.id} className="bg-white p-2.5 rounded-xl border border-slate-200/60 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{contact.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                              {contact.contact_type}
                            </span>
                          </div>
                          {contact.role_title && <div className="text-[11px] text-slate-500">{contact.role_title}</div>}
                          <div className="flex flex-wrap items-center gap-3 pt-1 text-slate-600 text-[11px]">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                                <Mail size={12} />
                                {contact.email}
                              </a>
                            )}
                            {contact.mobile_whatsapp && (
                              <a
                                href={`https://wa.me/${contact.mobile_whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-emerald-600 font-bold hover:underline"
                              >
                                <MessageSquare size={12} />
                                WhatsApp
                              </a>
                            )}
                            {contact.phone && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <Phone size={12} />
                                {contact.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400">
                  <span>{s.contracts_count || 0} contrato(s) vinculados</span>
                  <button
                    onClick={() => {
                      setContractForm(prev => ({ ...prev, supplier_id: String(s.id) }));
                      setIsContractModalOpen(true);
                    }}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    + Criar Contrato
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================
            TAB 3: FATURAS & CONTAS A PAGAR
            ======================================================== */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">Todos os Status de Fatura</option>
                <option value="PENDING">A Vencer</option>
                <option value="OVERDUE">Vencidas / Em Atraso</option>
                <option value="PAID">Pagas</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-3 pl-2">Fatura / Competência</th>
                    <th className="pb-3">Contrato / Fornecedor</th>
                    <th className="pb-3">Vencimento</th>
                    <th className="pb-3 text-right">Valor</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3">Linha Digitável / PIX</th>
                    <th className="pb-3 text-right pr-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2">
                        <div className="font-bold text-slate-900">{inv.invoice_number || "Sem nº"}</div>
                        <div className="text-xs text-slate-400 font-mono">Competência: {inv.competence || "—"}</div>
                      </td>

                      <td className="py-3.5">
                        <div className="font-semibold text-slate-800">{inv.contract_title}</div>
                        <div className="text-xs text-slate-500">{inv.supplier_name}</div>
                      </td>

                      <td className="py-3.5">
                        <div className={`font-mono font-bold text-xs ${
                          inv.status === "PAID" ? "text-slate-500" :
                          inv.is_overdue ? "text-red-600 font-extrabold" : "text-slate-800"
                        }`}>
                          {formatDate(inv.due_date)}
                        </div>
                        {inv.is_overdue && inv.status !== "PAID" && (
                          <span className="text-[10px] text-red-600 font-bold block">Vencido</span>
                        )}
                      </td>

                      <td className="py-3.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(inv.amount)}
                      </td>

                      <td className="py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          inv.status === "PAID" ? "bg-emerald-100 text-emerald-800" :
                          inv.is_overdue ? "bg-red-100 text-red-800 animate-pulse" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {inv.status === "PAID" ? "Pago" : inv.is_overdue ? "Vencida" : "A Vencer"}
                        </span>
                      </td>

                      <td className="py-3.5 max-w-[200px]">
                        {inv.payment_code ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-1 rounded-lg truncate">
                            <span className="truncate">{inv.payment_code}</span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(inv.payment_code); alert("Linha digitável copiada!"); }}
                              className="text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
                              title="Copiar linha digitável"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </td>

                      <td className="py-3.5 text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.file_attachment && (
                            <a
                              href={inv.file_attachment}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Baixar Boleto / NF"
                            >
                              <Download size={15} />
                            </a>
                          )}
                          <label className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Anexar Boleto/NF">
                            <Upload size={15} />
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.xml,.jpg,.png"
                              onChange={(e) => handleUploadInvoiceDoc(inv.id, e.target.files[0])}
                            />
                          </label>
                          {inv.status !== "PAID" && (
                            <button
                              onClick={() => handlePayInvoice(inv.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Check size={12} />
                              Dar Baixa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL: NOVO CONTRATO
          ======================================================== */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                Cadastrar Novo Contrato de TI
              </h2>
              <button onClick={() => setIsContractModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Fornecedor *</label>
                  <select
                    value={contractForm.supplier_id}
                    onChange={(e) => setContractForm({ ...contractForm, supplier_id: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                    <option value="">Selecione o Fornecedor</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.trade_name} ({s.category})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1">Nº do Contrato / Código</label>
                  <input
                    type="text"
                    value={contractForm.contract_number}
                    onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })}
                    placeholder="Ex: CTR-2026/012 ou Código Parceiro"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">Objeto / Título do Contrato *</label>
                <input
                  type="text"
                  value={contractForm.title}
                  onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                  placeholder="Ex: Link Dedicado de Internet 500Mbps ou Licenciamento Microsoft 365"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Data de Início da Vigência *</label>
                  <input
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                  </input>
                </div>

                <div>
                  <label className="block mb-1">Data de Fim / Vencimento *</label>
                  <input
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                  </input>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1">Valor Mensal (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={contractForm.monthly_cost}
                    onChange={(e) => setContractForm({ ...contractForm, monthly_cost: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block mb-1">Valor Total Global (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={contractForm.total_cost}
                    onChange={(e) => setContractForm({ ...contractForm, total_cost: e.target.value })}
                    placeholder="Auto (12x mensal)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block mb-1">Aviso Prévio (dias)</label>
                  <input
                    type="number"
                    value={contractForm.notice_period_days}
                    onChange={(e) => setContractForm({ ...contractForm, notice_period_days: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* CAMPO DE E-MAILS DE ALERTA ESPECÍFICOS */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
                <label className="block text-amber-900 font-bold flex items-center gap-1.5">
                  <Mail size={15} className="text-amber-700" />
                  E-mails Específicos para Notificação de Vencimento
                </label>
                <input
                  type="text"
                  value={contractForm.notification_emails}
                  onChange={(e) => setContractForm({ ...contractForm, notification_emails: e.target.value })}
                  placeholder="ti-hfsa@fasano.com.br, compras@fasano.com.br, gestor@fasano.com.br"
                  className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-800"
                />
                <p className="text-[11px] text-amber-800 font-normal">
                  Insira os e-mails (separados por vírgula) que receberão os alertas automáticos de 60, 30 e 15 dias de vencimento deste contrato e as cobranças de faturas.
                </p>
              </div>

              {/* GERAR AUTOMATICAMENTE 12 PARCELAS */}
              <div className="flex items-center gap-3 bg-blue-50/60 border border-blue-200 p-3.5 rounded-2xl">
                <input
                  type="checkbox"
                  id="auto_invoices"
                  checked={contractForm.auto_generate_invoices}
                  onChange={(e) => setContractForm({ ...contractForm, auto_generate_invoices: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded-md cursor-pointer"
                />
                <label htmlFor="auto_invoices" className="cursor-pointer text-xs text-blue-900 font-bold">
                  Gerar automaticamente as parcelas mensais de faturas (12 meses)
                  <span className="block text-[11px] font-normal text-blue-700">
                    As faturas serão geradas como pendentes mês a mês para controle de vencimento e baixa.
                  </span>
                </label>
              </div>

              <div>
                <label className="block mb-1">Cláusulas Importantes / SLA / Reajuste</label>
                <textarea
                  value={contractForm.notes}
                  onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                  placeholder="Ex: Índice de reajuste IPCA anual. SLA de atendimento 4h para link de fibra."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer shadow-sm shadow-blue-500/20"
                >
                  Salvar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: NOVO FORNECEDOR
          ======================================================== */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                Cadastrar Fornecedor
              </h2>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Nome Fantasia *</label>
                  <input
                    type="text"
                    value={supplierForm.trade_name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, trade_name: e.target.value })}
                    placeholder="Ex: Claro Empresas ou Microsoft"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block mb-1">Razão Social *</label>
                  <input
                    type="text"
                    value={supplierForm.corporate_name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, corporate_name: e.target.value })}
                    placeholder="Ex: Claro S.A."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={supplierForm.cnpj}
                    onChange={(e) => setSupplierForm({ ...supplierForm, cnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block mb-1">Categoria</label>
                  <select
                    value={supplierForm.category}
                    onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                    <option value="Telecom">Telecom / Internet / Telefonia</option>
                    <option value="Software/SaaS">Software / SaaS / Licenciamento</option>
                    <option value="Hardware">Hardware / Servidores / Redes</option>
                    <option value="Manutenção">Manutenção Preventiva / Suporte</option>
                    <option value="CFTV/Segurança">CFTV / Controle de Acesso</option>
                    <option value="Consultoria">Consultoria Especializada</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1">Portal de Chamados / Suporte URL</label>
                <input
                  type="url"
                  value={supplierForm.support_portal}
                  onChange={(e) => setSupplierForm({ ...supplierForm, support_portal: e.target.value })}
                  placeholder="https://suporte.fornecedor.com.br"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              {/* Contato Principal Inicial */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-900 block">Contato Inicial do Fornecedor</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={supplierForm.initial_contact_name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, initial_contact_name: e.target.value })}
                    placeholder="Nome do Representante / Gerente de Conta"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                  <input
                    type="email"
                    value={supplierForm.initial_contact_email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, initial_contact_email: e.target.value })}
                    placeholder="E-mail de Contato"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    value={supplierForm.initial_contact_whatsapp}
                    onChange={(e) => setSupplierForm({ ...supplierForm, initial_contact_whatsapp: e.target.value })}
                    placeholder="WhatsApp (ex: 71 99999-9999)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    value={supplierForm.initial_contact_phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, initial_contact_phone: e.target.value })}
                    placeholder="Telefone / Ramal / 0800"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer shadow-sm shadow-blue-500/20"
                >
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADICIONAR CONTATO AVULSO
          ======================================================== */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-900">
                Adicionar Contato — {activeSupplierForContact?.trade_name}
              </h2>
              <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                  placeholder="Nome do contato"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">Cargo / Função</label>
                  <input
                    type="text"
                    value={contactForm.role_title}
                    onChange={(e) => setContactForm({ ...contactForm, role_title: e.target.value })}
                    placeholder="Ex: Suporte 24h"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block mb-1">Tipo de Contato</label>
                  <select
                    value={contactForm.contact_type}
                    onChange={(e) => setContactForm({ ...contactForm, contact_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  >
                    <option value="Suporte">Suporte Técnico / NOC</option>
                    <option value="Comercial">Comercial / Executivo</option>
                    <option value="Financeiro">Financeiro / Cobrança</option>
                    <option value="Emergência">Emergência / Plantão</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1">E-mail</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="contato@fornecedor.com.br"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={contactForm.mobile_whatsapp}
                    onChange={(e) => setContactForm({ ...contactForm, mobile_whatsapp: e.target.value })}
                    placeholder="71 99999-9999"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block mb-1">Telefone Fixo / 0800</label>
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="0800..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          DRAWER LATERAL: DETALHES COMPLETOS DO CONTRATO
          ======================================================== */}
      {isDetailDrawerOpen && selectedContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto p-6 space-y-6 flex flex-col justify-between animate-slide-left">
            <div>
              {/* Topo do Drawer */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Detalhes do Contrato
                  </span>
                  <h2 className="text-xl font-black text-slate-900 mt-0.5">
                    {selectedContract.title}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    #{selectedContract.contract_number || `CTR-${selectedContract.id}`} • {selectedContract.supplier_trade_name}
                  </p>
                </div>
                <button onClick={() => setIsDetailDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={22} />
                </button>
              </div>

              {/* Informações de Vigência e Custo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Vigência Início</span>
                  <span className="text-xs font-black text-slate-800">{formatDate(selectedContract.start_date)}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Término / Fim</span>
                  <span className="text-xs font-black text-slate-800">{formatDate(selectedContract.end_date)}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Custo Mensal</span>
                  <span className="text-xs font-black text-blue-600 font-mono">{formatCurrency(selectedContract.monthly_cost)}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Aviso Prévio</span>
                  <span className="text-xs font-black text-slate-800">{selectedContract.notice_period_days} dias</span>
                </div>
              </div>

              {/* E-mails Notificados */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-5 space-y-1">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Mail size={14} className="text-amber-700" />
                  E-mails Configurados para Alertas de Vencimento:
                </span>
                <p className="text-xs text-amber-800 font-semibold break-all">
                  {selectedContract.notification_emails || "Nenhum e-mail específico configurado (notifica gestor e TI por padrão)."}
                </p>
              </div>

              {/* Seção 1: Produtos e Serviços Cobertos */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    Produtos & Serviços Contratados ({selectedContract.services?.length || 0})
                  </h3>
                </div>

                {/* Formulário rápido de adicionar serviço */}
                <form onSubmit={handleAddService} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                  <input
                    type="text"
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    placeholder="Nome do Produto / Serviço (ex: Link 500Mbps)"
                    required
                    className="sm:col-span-6 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                  />
                  <input
                    type="number"
                    value={serviceForm.quantity}
                    onChange={(e) => setServiceForm({ ...serviceForm, quantity: e.target.value })}
                    placeholder="Qtd"
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={serviceForm.unit_price}
                    onChange={(e) => setServiceForm({ ...serviceForm, unit_price: e.target.value })}
                    placeholder="Valor R$"
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs py-2 cursor-pointer"
                  >
                    + Adicionar
                  </button>
                </form>

                <div className="space-y-2">
                  {selectedContract.services?.map((srv) => (
                    <div key={srv.id} className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{srv.name}</span>
                        <span className="text-slate-400 ml-2 font-mono">({srv.quantity} {srv.unit})</span>
                      </div>
                      <span className="font-mono font-bold text-slate-700">{formatCurrency(srv.unit_price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção 2: Faturas do Contrato */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-600" />
                    Faturas & Parcelas ({selectedContract.invoices?.length || 0})
                  </h3>
                </div>

                {/* Formulário rápido de lançar fatura */}
                <form onSubmit={handleAddInvoice} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                  <input
                    type="text"
                    value={invoiceForm.invoice_number}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                    placeholder="Nº Fatura / NF"
                    className="sm:col-span-3 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                  />
                  <input
                    type="text"
                    value={invoiceForm.competence}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, competence: e.target.value })}
                    placeholder="Mês/Ano (10/2026)"
                    className="sm:col-span-3 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                  />
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    required
                    className="sm:col-span-3 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    placeholder="Valor R$"
                    required
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-xl p-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs py-2 cursor-pointer flex items-center justify-center"
                    title="Adicionar Parcela"
                  >
                    +
                  </button>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedContract.invoices?.map((inv) => (
                    <div key={inv.id} className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{inv.invoice_number || `Parcela`}</span>
                        <span className="text-slate-400 ml-2 font-mono">Venc: {formatDate(inv.due_date)}</span>
                        {inv.is_overdue && inv.status !== "PAID" && (
                          <span className="text-[10px] font-extrabold text-red-600 ml-2">ATRASADA</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-800">{formatCurrency(inv.amount)}</span>
                        {inv.status === "PAID" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Paga</span>
                        ) : (
                          <button
                            onClick={() => handlePayInvoice(inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] cursor-pointer"
                          >
                            Dar Baixa
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
