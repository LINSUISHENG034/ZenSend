import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from './store/slices/authSlice';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ContactsPage from './pages/ContactsPage';
import TemplatesPage from './pages/TemplatesPage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import CampaignsPage from './pages/CampaignsPage';
import CampaignEditorPage from './pages/CampaignEditorPage';
import CampaignReportPage from './pages/CampaignReportPage'; // Import CampaignReportPage

// ProtectedRoute component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// PublicRoute component
const PublicRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
};


function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={<ProtectedRoute><HomePage /></ProtectedRoute>}
        />
        <Route
          path="/contacts"
          element={<ProtectedRoute><ContactsPage /></ProtectedRoute>}
        />
        <Route
          path="/templates"
          element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>}
        />
        <Route
          path="/templates/new"
          element={<ProtectedRoute><TemplateEditorPage /></ProtectedRoute>}
        />
        <Route
          path="/templates/edit/:templateId"
          element={<ProtectedRoute><TemplateEditorPage /></ProtectedRoute>}
        />
        <Route
          path="/campaigns"
          element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>}
        />
        <Route
          path="/campaigns/new"
          element={<ProtectedRoute><CampaignEditorPage /></ProtectedRoute>}
        />
        <Route
          path="/campaigns/edit/:campaignId"
          element={<ProtectedRoute><CampaignEditorPage /></ProtectedRoute>}
        />
        <Route
          path="/campaigns/report/:campaignId"
          element={<ProtectedRoute><CampaignReportPage /></ProtectedRoute>}
        />

        {/* Fallback for unknown routes (optional) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
