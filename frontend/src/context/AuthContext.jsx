import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then(res => {
        const u = res.data.user;
        const userData = {
          user_id: u.user_id,
          ho_ten: u.ho_ten,
          email: u.email,
          vai_tro: u.ten_vai_tro,
          vai_tros: u.vai_tros || [],
          ...(u.ma_gv ? { ma_gv: u.ma_gv, giang_vien_id: u.giang_vien_id, hoc_vi: u.hoc_vi } : {}),
          ...(u.ma_sv ? { ma_sv: u.ma_sv, sinh_vien_id: u.sinh_vien_id, lop_hanh_chinh_id: u.lop_hanh_chinh_id } : {}),
        };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, mat_khau) => {
    const res = await api.post('/auth/login', { email, mat_khau });
    const { token, user: userData } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Local cleanup still has to happen if the server session is already invalid.
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
