import React from 'react';
import { Typography, Layout, Button } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser, selectUser, selectAuthLoading } from '../store/slices/authSlice'; // Changed to logoutUser thunk
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Header, Content } = Layout;

const HomePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser); // Get user info from Redux state
  const isLoading = useSelector(selectAuthLoading); // For logout loading state

  const handleLogout = () => {
    dispatch(logoutUser());
    // The ProtectedRoute/PublicRoute or useEffect in LoginPage will handle navigation
    // once isAuthenticated state changes.
    // However, explicitly navigating can be clearer for user experience if not immediately handled.
    // navigate('/login'); // This can be kept or removed depending on desired behavior.
    // For now, let's assume the state change and route protection handle it.
    // If logoutUser thunk is slow due to backend call, navigate('/login') might run too soon.
    // Better to rely on useEffect watching isAuthenticated in App.js or ProtectedRoute.
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>My App Dashboard</Title>
        <div>
          {user && <span style={{ marginRight: '15px' }}>Welcome, {user?.email || user?.username || 'User'}!</span>}
          <Button type="primary" onClick={handleLogout} loading={isLoading}>
            Logout
          </Button>
        </div>
      </Header>
      <Content style={{ padding: '20px 50px' }}>
        <Title level={2}>Home Page</Title>
        <p>This is a placeholder for the application's home page or dashboard.</p>
        <p>Authenticated users will see their relevant information and tools here.</p>
        {user && (
          <div>
            <Title level={4}>User Details (from Redux)</Title>
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default HomePage;
