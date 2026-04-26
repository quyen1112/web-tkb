/**
 * LoginPage.jsx
 * Refactor UI theo layout cong thong tin dao tao Thang Long.
 * Giu nguyen toan bo logic auth, validation va redirect theo vai tro.
 */

import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import campusImg from '../assets/images/login-background.webp'
import logoImg from '../assets/images/TLU.png';

const ROLE_TO_PATH = {
  admin: '/admin',
  giao_vu: '/giao-vu',
  giang_vien: '/giang-vien',
  sinh_vien: '/sinh-vien',
  truong_khoa: '/truong-khoa',
};

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      const user = await login(values.email, values.mat_khau);
      message.success(`Chào mừng ${user.ho_ten}!`);

      const redirectPath = ROLE_TO_PATH[user.vai_tro] ?? '/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (err) {
      message.error(err.response?.data?.error || 'Đăng nhập thất bại!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-visual">
        <img src={campusImg} alt="Thang Long University campus" className="login-visual-image" />
        <div className="login-visual-overlay" />
      </div>

      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-brand">
            <img src={logoImg} alt="TLU logo" className="login-brand-logo" />
            <div className="login-brand-text">
              <div className="login-brand-school">TRƯỜNG ĐẠI HỌC THĂNG LONG</div>
              <div className="login-brand-portal">CỔNG THÔNG TIN ĐÀO TẠO</div>
            </div>
          </div>

          <Card className="login-card" bordered={false}>
            <div className="login-card-header">
              <h1>ĐĂNG NHẬP</h1>
              <p>Cổng thông tin đào tạo</p>
            </div>

            <Form
              name="login"
              className="login-form"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email!' },
                  { type: 'email', message: 'Email không hợp lệ!' },
                ]}
              >
                <Input
                  prefix={<UserOutlined className="login-input-icon" />}
                  placeholder="Email hoặc Tên đăng nhập"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item
                name="mat_khau"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className="login-input-icon" />}
                  placeholder="Mật khẩu"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  block
                  className="login-submit-btn"
                >
                  Đăng nhập
                </Button>
              </Form.Item>
            </Form>

            <div className="login-footer">
              Liên hệ quản trị hệ thống nếu bạn cần cấp hoặc khôi phục tài khoản.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
