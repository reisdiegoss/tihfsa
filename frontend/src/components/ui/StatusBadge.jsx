/**
 * StatusBadge — badge colorido por status do chamado.
 */
const STATUS_MAP = {
  "Novo": "status-new",
  "Em Andamento": "status-progress",
  "Aguardando Validacao": "status-validation",
  "Fechado": "status-closed",
  "Rejeitado": "status-rejected",
};

const STATUS_DOTS = {
  "Novo": "var(--color-status-new)",
  "Em Andamento": "var(--color-status-progress)",
  "Aguardando Validacao": "var(--color-status-validation)",
  "Fechado": "var(--color-status-closed)",
  "Rejeitado": "var(--color-status-rejected)",
};

export default function StatusBadge({ status }) {
  const cls = STATUS_MAP[status] || "status-new";
  const dotColor = STATUS_DOTS[status] || "var(--color-status-new)";

  return (
    <span className={`status-badge ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dotColor }} />
      {status}
    </span>
  );
}
