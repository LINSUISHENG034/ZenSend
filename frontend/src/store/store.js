import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import contactsReducer from './slices/contactsSlice';
import templatesReducer from './slices/templatesSlice';
import campaignsReducer from './slices/campaignsSlice'; // Import the campaigns reducer

const store = configureStore({
  reducer: {
    auth: authReducer,
    contacts: contactsReducer,
    templates: templatesReducer,
    campaigns: campaignsReducer, // Add campaigns reducer
    // Add other reducers here as your application grows
  },
  // Middleware can be added here, Redux Toolkit includes thunk by default
  // devTools can be configured here (true by default in development)
});

export default store;
