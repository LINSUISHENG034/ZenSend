import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, selectAuthLoading, selectAuthError, selectIsAuthenticated, clearError } from '../store/slices/authSlice';

const { Title } = Typography;

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isLoading = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [form] = Form.useForm();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/'); // Redirect to home if already authenticated
    }
    // Clear any previous errors when component mounts or isAuthenticated changes,
    // but only if there's an error to clear.
    if (authError) {
      return () => {
        dispatch(clearError());
      };
    }
  }, [isAuthenticated, navigate, dispatch, authError]);

  const onFinish = (values) => {
    // Credentials will be { email: '...', password: '...' }
    dispatch(loginUser(values));
    // Navigation will be handled by the useEffect hook when isAuthenticated changes.
    // Error display is handled by the Alert component reacting to authError.
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 24 }}>Login</Title>
        {authError && (
          <Alert
            message={typeof authError === 'object' ? JSON.stringify(authError) : authError}
            type="error"
            showIcon
            closable
            onClose={() => dispatch(clearError())}
            style={{ marginBottom: 20 }}
          />
        )}
        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          initialValues={{ remember: true }} // Ant Design's default, can be removed if not needed
          scrollToFirstError
        >
          <Form.Item
            name="email" // Changed from username for consistency if backend expects email
            rules={[{ required: true, message: 'Please input your Email!', type: 'email' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your Password!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} style={{ width: '100%' }}>
              Log in
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            Or <Link to="/register">register now!</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
