import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Monitor } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      // O redirecionamento real é feito pelo App.jsx (RootRedirect), 
      // mas podemos forçar a navegação de forma limpa aqui para '/'
      navigate("/");
    } catch (err) {
      setError(err.message || "Falha na autenticação. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-[2rem] shadow-sm border border-slate-200 p-8">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Monitor size={32} />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-slate-900">Bem-vindo(a) de volta</h2>
          <p className="text-slate-500 font-medium text-sm mt-2">Acesse o sistema TIHFSA</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-semibold border border-red-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Usuário (LDAP ou Local)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
              placeholder="Digite seu usuário..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-bold text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mt-4 cursor-pointer"
          >
            <LogIn size={18} />
            Entrar no Sistema
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 font-semibold mt-8">
          Hotel Fasano Salvador © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
