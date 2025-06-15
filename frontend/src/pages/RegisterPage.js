import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'; // UserOutlined might be for username if you add it
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, selectAuthLoading, selectAuthError, selectIsAuthenticated, clearError } from '../store/slices/authSlice';

const { Title } = Typography;

const RegisterPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isLoading = useSelector(selectAuthLoading); // Use Redux loading state
  const authError = useSelector(selectAuthError);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [form] = Form.useForm();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/'); // Redirect to home if already authenticated (e.g., after registration and auto-login)
    }
    // Clear any previous errors when component mounts or isAuthenticated changes
    if (authError) {
      return () => {
        dispatch(clearError());
      };
    }
  }, [isAuthenticated, navigate, dispatch, authError]);

  const onFinish = (values) => {
    // Values will include email, password, confirm.
    // The registerUser thunk expects userData, which might include more fields if your form has them.
    // For this example, it primarily needs email and password.
    // Other fields like username, first_name, last_name can be added to the form and passed in `values`.
    dispatch(registerUser(values));
    // Navigation and error display are handled by useEffect and Alert component.
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 24 }}>Register</Title>
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
          name="register"
          onFinish={onFinish}
          initialValues={{}} // Clear initialValues or set specific defaults if needed
          scrollToFirstError
        >
          {/* Example: Add a username field if your backend requires it
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please input your Username!', whitespace: true }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>
          */}

          <Form.Item
            name="email"
            rules={[{ required: true, message: 'Please input your Email!', type: 'email' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your Password!' }]}
            hasFeedback
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item
            name="confirm"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The two passwords that you entered do not match!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} style={{ width: '100%' }}>
              Register
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterPage;
