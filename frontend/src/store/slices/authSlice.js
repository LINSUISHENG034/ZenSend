import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api'; // Adjusted path

// Helper to extract error message
const getErrorMessage = (error) => {
  return error.response?.data?.detail || error.response?.data?.error || error.response?.data?.message || error.message || 'An unexpected error occurred.';
};

// Async Thunk for Login
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/auth/login/', credentials);
      // Assuming backend returns { access: "token", user: { ... } } or similar
      // Or just { access: "token" } and user data is fetched separately or part of token
      // For this subtask, expect { access: token, user: userData }
      const token = response.data.access_token || response.data.access || response.data.token; // Common token names
      const user = response.data.user || null; // User data might not always be returned directly

      if (!token) {
        return rejectWithValue('Token not found in login response.');
      }

      localStorage.setItem('token', token);
      if (user) {
        // localStorage.setItem('user', JSON.stringify(user)); // Optional: persist user details
      }
      return { user, token };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Async Thunk for Registration
export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData, { dispatch, rejectWithValue }) => {
    try {
      // Assuming register endpoint is '/auth/register/' or '/auth/users/'
      await apiClient.post('/auth/register/', userData);
      // After successful registration, attempt to log in the user automatically
      // This assumes the registration doesn't return a token directly
      // If it does, this logic can be simplified.
      const loginCredentials = { email: userData.email, password: userData.password };
      const loginResponse = await dispatch(loginUser(loginCredentials)); // Dispatch loginUser thunk
      if (loginUser.fulfilled.match(loginResponse)) { // Check if login was successful
         return loginResponse.payload; // This will be the { user, token } from loginUser
      } else {
        // If login after registration fails, reject with the error from loginUser
        return rejectWithValue(loginResponse.payload || 'Login after registration failed.');
      }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Async Thunk for Logout
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      // Optional: Call backend logout endpoint if it exists and does something useful (e.g., invalidates refresh token)
      // await apiClient.post('/auth/logout/');
    } catch (error) {
      // Log error but don't let it stop client-side logout
      console.error('Backend logout failed:', getErrorMessage(error));
    } finally {
      localStorage.removeItem('token');
      // localStorage.removeItem('user'); // If user details were stored
      // Dispatching the synchronous logout action is handled by extraReducers fulfilled case
    }
    return; // No payload needed for successful logout
  }
);


const initialState = {
  user: null, // JSON.parse(localStorage.getItem('user')) || null, // If user details were stored
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // loginStart, loginSuccess, loginFailure are now handled by createAsyncThunk lifecycle
    // Synchronous logout action
    logoutClient(state) { // Renamed to avoid conflict if logoutUser thunk was also named logout
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.error = null;
      // localStorage items are removed by the thunk itself to ensure it happens even if API call fails
    },
    clearError(state) {
      state.error = null;
    },
    // Action to manually set token if needed (e.g., from OAuth redirect)
    setAuthToken(state, action) {
        state.token = action.payload.token;
        state.user = action.payload.user || null; // Optional user data
        state.isAuthenticated = !!action.payload.token;
        localStorage.setItem('token', action.payload.token);
        if (action.payload.user) {
            // localStorage.setItem('user', JSON.stringify(action.payload.user));
        }
    }
  },
  extraReducers: (builder) => {
    builder
      // Login User
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload; // Error message from rejectWithValue
        localStorage.removeItem('token'); // Ensure token is cleared on login failure
        // localStorage.removeItem('user');
      })
      // Register User (handles only its own pending/rejected for loading/error, success is via loginUser)
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true; // Or a specific registerLoading state
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        // If registerUser directly logs in and returns {user, token}
        // This state update will be handled by loginUser.fulfilled if registerUser dispatches and returns loginUser's result
        // If registerUser itself was to set state, it would be here:
        // state.isLoading = false;
        // state.isAuthenticated = true;
        // state.user = action.payload.user;
        // state.token = action.payload.token;
        // state.error = null;
        // However, since it dispatches loginUser, loginUser.fulfilled will handle the auth state update.
        // We just need to ensure isLoading is false.
        state.isLoading = false;
        state.error = null; // Clear any registration-specific error
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        // Error is set specific to registration attempt.
        // loginUser.rejected will handle clearing token if login part fails.
        state.error = action.payload;
      })
      // Logout User
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true; // Optional: show loading state during logout API call
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = null;
        // localStorage is handled by the thunk.
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        // Even if backend logout fails, client-side state should be cleared for security.
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.error = action.payload || 'Logout failed. Cleared client session.'; // Potentially an error from backend logout
        // localStorage is handled by the thunk.
      });
  }
});

export const {
  clearError,
  logoutClient, // Exporting the synchronous client-side logout action
  setAuthToken,
} = authSlice.actions;

// Selectors
export const selectIsAuthenticated = state => state.auth.isAuthenticated;
export const selectUser = state => state.auth.user;
export const selectAuthToken = state => state.auth.token;
export const selectAuthLoading = state => state.auth.isLoading;
export const selectAuthError = state => state.auth.error;

export default authSlice.reducer;
