/**
 * AuthContext — estado de autenticacao global.
 * Gerencia login/logout e armazena dados do usuario no localStorage.
 */
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("tihfsa_user");
    const token = localStorage.getItem("tihfsa_token");
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const { data } = await api.post("/auth/login", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const userData = {
      id: data.user_id,
      displayName: data.display_name,
      role: data.role,
      roles: data.roles || [data.role],
    };

    localStorage.setItem("tihfsa_token", data.access_token);
    localStorage.setItem("tihfsa_user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("tihfsa_token");
    localStorage.removeItem("tihfsa_user");
    setUser(null);
  };

  const userRoles = (user?.roles && user.roles.length > 0 ? user.roles : [user?.role || "user"]).map(r => r.toLowerCase());
  const isAdmin = userRoles.includes("admin");
  const isTechnician = userRoles.includes("tecnico") || userRoles.includes("technician");
  const isManager = userRoles.includes("manager") || userRoles.includes("gerente");
  const isStaff = isAdmin || isTechnician || isManager;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isTechnician, isManager, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
