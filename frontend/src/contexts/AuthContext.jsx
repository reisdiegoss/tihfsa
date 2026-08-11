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

  const isAdmin = user?.role === "admin" || user?.role === "technician";
  const isManager = user?.role === "manager";

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
