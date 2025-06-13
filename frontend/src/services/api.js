import axios from 'axios';
import store from '../store/store'; // Import the Redux store
import { logoutUser, setAuthToken } from '../store/slices/authSlice'; // Import the async thunk for logout and potentially setAuthToken

// Determine the base URL based on the environment
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: To add the auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage, as it's the source of truth initialized by authSlice
    const token = localStorage.getItem('token');
    // Or use store: const token = store.getState().auth.token;
    // Using localStorage directly here avoids issues if store is not yet fully initialized when apiClient is first used.

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: To handle global errors like 401 (Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  async (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    const originalRequest = error.config;

    // Handle 401 Unauthorized specifically
    if (error.response && error.response.status === 401) {
      // Check if it's a token refresh scenario (if you implement token refresh)
      // For example, if the error is due to an expired access token and you have a refresh token.
      // This part is complex and depends on your auth setup (e.g., using a refresh token endpoint).
      // Example for refresh token logic (simplified, assumes /auth/refresh/ endpoint):
      if (!originalRequest._retry && originalRequest.url !== '/auth/refresh/') { // Avoid retry loops for refresh endpoint
        originalRequest._retry = true; // Mark that we've retried this request
        try {
          const refreshToken = localStorage.getItem('refreshToken'); // Assuming you store refresh token
          if (refreshToken) {
            const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken });
            const newAccessToken = refreshResponse.data.access;
            if (newAccessToken) {
              localStorage.setItem('token', newAccessToken);
              // Dispatch action to update token in Redux store
              store.dispatch(setAuthToken({ token: newAccessToken, user: store.getState().auth.user /* keep existing user or update if provided */ }));
              apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
              return apiClient(originalRequest); // Retry the original request with the new token
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, proceed to logout
          store.dispatch(logoutUser());
          // window.location.href = '/login'; // Or use React Router navigation
          return Promise.reject(refreshError); // Or error
        }
      }

      // If not a refresh scenario, or refresh failed, or it's a 401 for other reasons:
      // Dispatch logoutUser or a more specific action.
      // Ensure this doesn't loop if the logout action itself causes a 401.
      if (originalRequest.url !== '/auth/logout/' && originalRequest.url !== '/auth/login/') {
         store.dispatch(logoutUser());
        // Optionally redirect to login page
        // Note: Direct navigation here can be problematic if this code runs outside React component lifecycle.
        // It's often better to let components react to the isAuthenticated state change.
        // window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
