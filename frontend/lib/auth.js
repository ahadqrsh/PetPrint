"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On load, restore the session by asking the API who we are.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const registerOwner = useCallback(async (payload) => {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const registerClinic = useCallback(async (payload) => {
    const res = await api.post("/auth/register-clinic", payload);
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, registerOwner, registerClinic }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
