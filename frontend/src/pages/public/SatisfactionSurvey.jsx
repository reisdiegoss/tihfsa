import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Star, CheckCircle2, MessageSquare, AlertCircle, Hotel, Send, Clock, UserCheck, ShieldCheck } from "lucide-react";
import api from "../../api/client";

export default function SatisfactionSurvey() {
  const { token: routeToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = routeToken || searchParams.get("token") || "";
  const initialRating = parseInt(searchParams.get("nota") || searchParams.get("rating") || "0", 10);

  const [surveyData, setSurveyData] = useState(null);
  const [rating, setRating] = useState(initialRating > 0 && initialRating <= 5 ? initialRating : 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError("Token de pesquisa inválido ou não informado.");
      setLoading(false);
      return;
    }

    const fetchSurvey = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get(`/public/surveys/${token}`);
        setSurveyData(data);
        if (data.answered) {
          setSubmitted(true);
          setRating(data.rating || 5);
          setComment(data.comment || "");
        } else if (initialRating > 0 && initialRating <= 5) {
          setRating(initialRating);
        }
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar a pesquisa. Verifique se o link está correto ou expirou.");
      } finally {
        setLoading(false);
      }
    };

    fetchSurvey();
  }, [token, initialRating]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (rating < 1 || rating > 5) {
      alert("Por favor, selecione uma nota de 1 a 5 estrelas antes de enviar.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/public/surveys/${token}`, {
        rating,
        comment: comment.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar avaliação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (val) => {
    switch (val) {
      case 1:
        return "Péssimo — Muito insatisfeito";
      case 2:
        return "Ruim — Abaixo do esperado";
      case 3:
        return "Regular — Atendeu parcialmente";
      case 4:
        return "Bom — Atendimento satisfatório";
      case 5:
        return "Excelente — Muito satisfeito e superou expectativas!";
      default:
        return "Clique nas estrelas para avaliar de 1 a 5";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 selection:bg-amber-500 selection:text-white">
      {/* Header Corporativo Fasano */}
      <header className="max-w-2xl mx-auto w-full pt-4 pb-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Hotel size={22} />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white leading-tight">
              HOTEL FASANO SALVADOR
            </h1>
            <p className="text-[11px] font-medium text-blue-200/70 tracking-wider uppercase">
              Central de Serviços & TI Corporativa
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <ShieldCheck size={14} />
          <span>Avaliação Segura</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        {loading ? (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center backdrop-blur-md shadow-2xl animate-pulse">
            <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-slate-300">Carregando pesquisa de satisfação...</p>
          </div>
        ) : error ? (
          <div className="bg-white/5 border border-red-500/30 rounded-3xl p-8 text-center backdrop-blur-md shadow-2xl">
            <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Ops! Link Não Encontrado</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto mb-6">{error}</p>
            <Link
              to="/chamado"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-lg shadow-blue-600/30"
            >
              Ir para o Portal de Suporte
            </Link>
          </div>
        ) : submitted ? (
          <div className="bg-white/5 border border-emerald-500/30 rounded-3xl p-8 sm:p-10 text-center backdrop-blur-md shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
              Agradecemos a sua Avaliação!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed mb-6">
              Sua opinião sobre o chamado <strong>#{surveyData?.ticket_id}</strong> é essencial para mantermos o padrão de excelência no atendimento da equipe de TI do Fasano Salvador.
            </p>

            {/* Resumo da Nota Registrada */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-sm mx-auto mb-6 flex flex-col items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                Sua Nota Registrada
              </span>
              <div className="flex items-center gap-1.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={24}
                    fill={star <= rating ? "#fbbf24" : "none"}
                    className={star <= rating ? "text-amber-400" : "text-slate-600"}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-amber-300">{getRatingLabel(rating)}</span>
              {comment && (
                <div className="mt-2 text-left w-full border-t border-white/5 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Seu Comentário:</span>
                  <p className="text-xs text-slate-200 italic">"{comment}"</p>
                </div>
              )}
            </div>

            <Link
              to="/chamado"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors border border-white/15 cursor-pointer"
            >
              Voltar ao Início
            </Link>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
            {/* Card do Chamado Atendido */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 mb-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                    Chamado #{surveyData?.ticket_id}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-1.5 line-clamp-2">
                    {surveyData?.ticket_title}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 border-t border-white/5 pt-3 mt-3">
                <div className="flex items-center gap-2">
                  <UserCheck size={14} className="text-blue-400 shrink-0" />
                  <span><strong>Técnico:</strong> {surveyData?.technician_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-amber-400 shrink-0" />
                  <span><strong>Solicitante:</strong> {surveyData?.requester_name}</span>
                </div>
              </div>

              {surveyData?.solution && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <strong className="text-emerald-400 block mb-0.5">💡 Solução Aplicada:</strong>
                  <p className="text-slate-200 leading-relaxed text-[11px] line-clamp-3">
                    {surveyData.solution}
                  </p>
                </div>
              )}
            </div>

            {/* Pergunta de Avaliação */}
            <div className="text-center mb-6">
              <h2 className="text-base sm:text-lg font-black text-white mb-1">
                Como você avalia a resolução deste chamado?
              </h2>
              <p className="text-xs text-slate-400">
                Selecione de 1 a 5 estrelas de acordo com a sua satisfação
              </p>

              {/* Seletor de Estrelas */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 my-5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 sm:p-2 rounded-2xl transition-all transform hover:scale-125 focus:outline-none cursor-pointer"
                    >
                      <Star
                        size={36}
                        fill={isFilled ? "#fbbf24" : "none"}
                        className={`transition-colors duration-200 ${
                          isFilled ? "text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" : "text-slate-600 hover:text-slate-400"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Rótulo Dinâmico da Nota */}
              <div className="h-6">
                <span className={`text-xs font-bold transition-all ${rating > 0 ? "text-amber-300" : "text-slate-500"}`}>
                  {getRatingLabel(hoverRating || rating)}
                </span>
              </div>
            </div>

            {/* Campo Opcional de Comentário */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
                  <MessageSquare size={14} className="text-blue-400" />
                  Deixe um comentário ou elogio <span className="text-slate-500 font-normal">(opcional)</span>:
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte-nos o que você achou do atendimento, agilidade ou comportamento do técnico..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50 transition-colors resize-none"
                  maxLength={1000}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all transform active:scale-98 shadow-xl shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Gravando Avaliação...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Confirmar e Enviar Avaliação</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full text-center py-4 border-t border-white/5 text-[11px] text-slate-500">
        © {new Date().getFullYear()} Hotel Fasano Salvador • Departamento de Tecnologia da Informação
      </footer>
    </div>
  );
}
