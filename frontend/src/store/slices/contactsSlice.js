import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

// Helper to extract error message
const getErrorMessage = (error) => {
  // Handle cases where error.response.data might be a string or an object
  if (error.response && error.response.data) {
    if (typeof error.response.data === 'string') return error.response.data;
    return error.response.data.detail || error.response.data.error || error.response.data.message || JSON.stringify(error.response.data);
  }
  return error.message || 'An unexpected error occurred.';
};

const initialState = {
  contacts: [],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalContacts: 0,
    pageSize: 10,
    next: null,
    previous: null,
  },
  currentContact: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  searchTerm: '',
  filters: {},
  uploadStatus: {
    isLoading: false,
    error: null, // General error message for the upload process
    message: null, // Success or summary message
    errorDetails: null, // Array of row-specific errors or detailed error info
  }
};

// Async Thunks (fetchContacts, fetchContactById, createContact, updateContact, deleteContact remain unchanged from previous correct version)
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async ({ page = 1, pageSize = 10, search = '', filters = {} }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('page_size', pageSize);
      if (search) {
        params.append('search', search);
      }
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await apiClient.get(`/contacts/contacts/?${params.toString()}`);
      return {
        results: response.data.results,
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        currentPage: page,
        pageSize: pageSize,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const fetchContactById = createAsyncThunk(
  'contacts/fetchContactById',
  async (contactId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/contacts/contacts/${contactId}/`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const createContact = createAsyncThunk(
  'contacts/createContact',
  async (contactData, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.post('/contacts/contacts/', contactData);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateContact = createAsyncThunk(
  'contacts/updateContact',
  async ({ contactId, contactData }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/contacts/contacts/${contactId}/`, contactData);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const deleteContact = createAsyncThunk(
  'contacts/deleteContact',
  async (contactId, { dispatch, getState, rejectWithValue }) => {
    try {
      await apiClient.delete(`/contacts/contacts/${contactId}/`);
      return contactId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const uploadContactsFile = createAsyncThunk(
  'contacts/uploadContactsFile',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/contacts/contacts/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // Expect response like { message: "...", success_count: X, failure_count: Y, errors: [...] }
      return response.data;
    } catch (error) {
      // If error.response.data exists, it might contain structured error details from the backend
      const errorPayload = error.response && error.response.data ? error.response.data : getErrorMessage(error);
      return rejectWithValue(errorPayload);
    }
  }
);


const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    setCurrentPage(state, action) {
      state.pagination.currentPage = action.payload;
    },
    setPageSize(state, action) {
      state.pagination.pageSize = action.payload;
      state.pagination.currentPage = 1;
    },
    setSearchTerm(state, action) {
      state.searchTerm = action.payload;
      state.pagination.currentPage = 1;
    },
    setFilters(state, action) {
      state.filters = action.payload;
      state.pagination.currentPage = 1;
    },
    clearCurrentContact(state) {
      state.currentContact = null;
    },
    clearUploadStatus(state) {
        state.uploadStatus = { isLoading: false, error: null, message: null, errorDetails: null };
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchContacts (no change from previous version)
      .addCase(fetchContacts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.contacts = action.payload.results;
        state.pagination.totalContacts = action.payload.count;
        state.pagination.next = action.payload.next;
        state.pagination.previous = action.payload.previous;
        state.pagination.currentPage = action.payload.currentPage;
        state.pagination.pageSize = action.payload.pageSize;
        state.pagination.totalPages = Math.ceil(action.payload.count / action.payload.pageSize);
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // fetchContactById (no change)
      .addCase(fetchContactById.pending, (state) => { state.isLoading = true; state.currentContact = null; state.error = null; })
      .addCase(fetchContactById.fulfilled, (state, action) => { state.isLoading = false; state.currentContact = action.payload; })
      .addCase(fetchContactById.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; })
      // createContact (no change)
      .addCase(createContact.pending, (state) => { state.isSubmitting = true; state.error = null; })
      .addCase(createContact.fulfilled, (state, action) => { state.isSubmitting = false; /* Rely on re-fetch */ })
      .addCase(createContact.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload; })
      // updateContact (no change)
      .addCase(updateContact.pending, (state) => { state.isSubmitting = true; state.error = null; })
      .addCase(updateContact.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentContact = action.payload;
        const index = state.contacts.findIndex(c => c.id === action.payload.id);
        if (index !== -1) state.contacts[index] = action.payload;
      })
      .addCase(updateContact.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload; })
      // deleteContact (no change)
      .addCase(deleteContact.pending, (state) => { state.isSubmitting = true; state.error = null; })
      .addCase(deleteContact.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.contacts = state.contacts.filter(c => c.id !== action.payload);
        state.pagination.totalContacts -= 1;
      })
      .addCase(deleteContact.rejected, (state, action) => { state.isSubmitting = false; state.error = action.payload; })
      // uploadContactsFile - REFINED
      .addCase(uploadContactsFile.pending, (state) => {
        state.uploadStatus.isLoading = true;
        state.uploadStatus.error = null;
        state.uploadStatus.message = null;
        state.uploadStatus.errorDetails = null;
      })
      .addCase(uploadContactsFile.fulfilled, (state, action) => {
        state.uploadStatus.isLoading = false;
        // Assuming action.payload is the response object from the backend
        // e.g., { message: "Processed X entries.", success_count: Y, failure_count: Z, errors: [{row: 1, error: "..."}] }
        state.uploadStatus.message = action.payload.message ||
                                     `Successfully imported: ${action.payload.success_count || 0}. Failed: ${action.payload.failure_count || 0}.`;
        state.uploadStatus.errorDetails = action.payload.errors || null; // Store detailed errors if provided
        state.uploadStatus.error = action.payload.failure_count > 0 ? "Some contacts could not be imported." : null;
      })
      .addCase(uploadContactsFile.rejected, (state, action) => {
        state.uploadStatus.isLoading = false;
        // action.payload could be a string from getErrorMessage or an object from backend (e.g. validation errors on file itself)
        if (typeof action.payload === 'string') {
            state.uploadStatus.error = action.payload;
        } else if (action.payload && typeof action.payload === 'object') {
            // If backend returns structured error for the upload itself (not row errors)
            state.uploadStatus.error = action.payload.detail || action.payload.message || JSON.stringify(action.payload);
            state.uploadStatus.errorDetails = action.payload.errors || null; // e.g. errors related to file format
        } else {
            state.uploadStatus.error = 'File upload failed.';
        }
        state.uploadStatus.message = 'File upload failed.';
      });
  },
});

export const {
  setCurrentPage,
  setPageSize,
  setSearchTerm,
  setFilters,
  clearCurrentContact,
  clearUploadStatus,
} = contactsSlice.actions;

// Selectors (no change from previous version)
export const selectContacts = (state) => state.contacts.contacts;
export const selectContactsPagination = (state) => state.contacts.pagination;
export const selectCurrentContact = (state) => state.contacts.currentContact;
export const selectContactsLoading = (state) => state.contacts.isLoading;
export const selectContactsSubmitting = (state) => state.contacts.isSubmitting;
export const selectContactsError = (state) => state.contacts.error;
export const selectContactsSearchTerm = (state) => state.contacts.searchTerm;
export const selectContactsFilters = (state) => state.contacts.filters;
export const selectContactsUploadStatus = (state) => state.contacts.uploadStatus;


export default contactsSlice.reducer;
