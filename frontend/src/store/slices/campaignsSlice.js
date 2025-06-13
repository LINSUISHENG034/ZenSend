import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

const getErrorMessage = (error) => {
  return error.response?.data?.detail || error.response?.data?.error || error.response?.data?.message || error.message || 'An unexpected error occurred.';
};

const initialWizardData = {
    name: '',
    subject: '',
    recipient_group: { type: 'all_contacts', ids: [] },
    template_id: null,
    scheduled_at: null,
};

const initialState = {
  campaigns: [],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCampaigns: 0,
    pageSize: 10,
    next: null,
    previous: null,
  },
  currentCampaign: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  searchTerm: '',
  filters: { status: '' },
  wizardState: {
    currentStep: 1,
    campaignData: { ...initialWizardData },
  },
  // For Campaign Statistics
  currentCampaignStats: null,
  isFetchingStats: false,
  fetchStatsError: null,
};

// Async Thunks (existing thunks like fetchCampaigns, createCampaign etc. remain the same)
export const fetchCampaigns = createAsyncThunk( /* ... existing code ... */
  'campaigns/fetchCampaigns',
  async ({ page = 1, pageSize = 10, search = '', filters = {} } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('page_size', pageSize);
      if (search) params.append('search', search);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await apiClient.get(`/campaigns/campaigns/?${params.toString()}`);
      return { ...response.data, currentPage: page, pageSize };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const fetchCampaignById = createAsyncThunk( /* ... existing code ... */
  'campaigns/fetchCampaignById',
  async (campaignId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/campaigns/campaigns/${campaignId}/`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const createCampaign = createAsyncThunk( /* ... existing code ... */
  'campaigns/createCampaign',
  async (campaignData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/campaigns/campaigns/', campaignData);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateCampaign = createAsyncThunk( /* ... existing code ... */
  'campaigns/updateCampaign',
  async ({ campaignId, campaignData }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/campaigns/campaigns/${campaignId}/`, campaignData);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const deleteCampaign = createAsyncThunk( /* ... existing code ... */
  'campaigns/deleteCampaign',
  async (campaignId, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/campaigns/campaigns/${campaignId}/`);
      return campaignId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const sendCampaignNow = createAsyncThunk( /* ... existing code ... */
  'campaigns/sendCampaignNow',
  async (campaignId, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/campaigns/campaigns/${campaignId}/send-now/`);
      return { campaignId, data: response.data };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const scheduleCampaign = createAsyncThunk( /* ... existing code ... */
  'campaigns/scheduleCampaign',
  async ({ campaignId, scheduled_at }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/campaigns/campaigns/${campaignId}/schedule/`, { scheduled_at });
      return { campaignId, data: response.data };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const cancelCampaignSchedule = createAsyncThunk( /* ... existing code ... */
  'campaigns/cancelCampaignSchedule',
  async (campaignId, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/campaigns/campaigns/${campaignId}/cancel-schedule/`);
      return { campaignId, data: response.data };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// New Thunk for Campaign Stats
export const fetchCampaignStats = createAsyncThunk(
  'campaigns/fetchCampaignStats',
  async (campaignId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/campaigns/campaigns/${campaignId}/stats/`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);


const campaignsSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    // Existing reducers (setCampaignsCurrentPage, etc.)
    setCampaignsCurrentPage(state, action) { state.pagination.currentPage = action.payload; },
    setCampaignsPageSize(state, action) { state.pagination.pageSize = action.payload; state.pagination.currentPage = 1;},
    setCampaignsSearchTerm(state, action) { state.searchTerm = action.payload; state.pagination.currentPage = 1; },
    setCampaignsFilters(state, action) { state.filters = { ...state.filters, ...action.payload }; state.pagination.currentPage = 1; },
    clearCurrentCampaign(state) { state.currentCampaign = null; },
    setWizardStep(state, action) { state.wizardState.currentStep = action.payload; },
    updateWizardData(state, action) { state.wizardState.campaignData = { ...state.wizardState.campaignData, ...action.payload };},
    resetWizard(state) {
      state.wizardState.currentStep = 1;
      state.wizardState.campaignData = { ...initialWizardData };
      state.currentCampaign = null;
    },
    loadCampaignIntoWizard(state, action) {
        state.wizardState.campaignData = {
            name: action.payload.name,
            subject: action.payload.subject,
            recipient_group: action.payload.recipient_group || initialWizardData.recipient_group,
            template_id: action.payload.template?.id || action.payload.template || null,
            scheduled_at: action.payload.scheduled_at || null,
        };
        state.currentCampaign = action.payload;
        state.wizardState.currentStep = 1;
    },
    // New reducer for clearing stats
    clearCampaignStats(state) {
        state.currentCampaignStats = null;
        state.isFetchingStats = false;
        state.fetchStatsError = null;
    }
  },
  extraReducers: (builder) => {
    const handlePending = (state) => { state.isLoading = true; state.error = null; };
    const handleSubmitPending = (state) => { state.isSubmitting = true; state.error = null; };
    const handleRejected = (state, action) => {
      state.isLoading = false;
      state.isSubmitting = false;
      state.error = action.payload;
    };
    const updateCampaignInList = (state, updatedCampaign) => {
        const index = state.campaigns.findIndex(c => c.id === updatedCampaign.id);
        if (index !== -1) state.campaigns[index] = updatedCampaign;
        if (state.currentCampaign && state.currentCampaign.id === updatedCampaign.id) {
            state.currentCampaign = updatedCampaign;
        }
    };

    // Existing extraReducers for fetchCampaigns, fetchCampaignById, CUD, send, schedule, cancel
    builder
      .addCase(fetchCampaigns.pending, handlePending)
      .addCase(fetchCampaigns.fulfilled, (state, action) => { /* ... */
        state.isLoading = false;
        state.campaigns = action.payload.results;
        state.pagination = {
          ...state.pagination,
          totalCampaigns: action.payload.count,
          next: action.payload.next,
          previous: action.payload.previous,
          currentPage: action.payload.currentPage,
          pageSize: action.payload.pageSize,
          totalPages: Math.ceil(action.payload.count / action.payload.pageSize),
        };
      })
      .addCase(fetchCampaigns.rejected, handleRejected)
      .addCase(fetchCampaignById.pending, handlePending)
      .addCase(fetchCampaignById.fulfilled, (state, action) => { /* ... */
        state.isLoading = false;
        campaignsSlice.caseReducers.loadCampaignIntoWizard(state, action);
      })
      .addCase(fetchCampaignById.rejected, handleRejected)
      .addCase(createCampaign.pending, handleSubmitPending)
      .addCase(createCampaign.fulfilled, (state, action) => { /* ... */
        state.isSubmitting = false;
        state.currentCampaign = action.payload;
      })
      .addCase(createCampaign.rejected, handleRejected)
      .addCase(updateCampaign.pending, handleSubmitPending)
      .addCase(updateCampaign.fulfilled, (state, action) => { /* ... */
        state.isSubmitting = false;
        updateCampaignInList(state, action.payload);
      })
      .addCase(updateCampaign.rejected, handleRejected)
      .addCase(deleteCampaign.pending, handleSubmitPending)
      .addCase(deleteCampaign.fulfilled, (state, action) => { /* ... */
        state.isSubmitting = false;
        state.campaigns = state.campaigns.filter(c => c.id !== action.payload);
        state.pagination.totalCampaigns -= 1;
      })
      .addCase(deleteCampaign.rejected, handleRejected)
      .addCase(sendCampaignNow.pending, handleSubmitPending)
      .addCase(sendCampaignNow.fulfilled, (state, action) => { /* ... */
        state.isSubmitting = false;
        updateCampaignInList(state, action.payload.data);
      })
      .addCase(sendCampaignNow.rejected, handleRejected)
      .addCase(scheduleCampaign.pending, handleSubmitPending)
      .addCase(scheduleCampaign.fulfilled, (state, action) => { /* ... */
        state.isSubmitting = false;
        updateCampaignInList(state, action.payload.data);
      })
      .addCase(scheduleCampaign.rejected, handleRejected)
      .addCase(cancelCampaignSchedule.pending, handleSubmitPending)
      .addCase(cancelCampaignSchedule.fulfilled, (state, action) => { /* ... */
        state.isSubmitting = false;
        updateCampaignInList(state, action.payload.data);
      })
      .addCase(cancelCampaignSchedule.rejected, handleRejected)
      // New extraReducers for fetchCampaignStats
      .addCase(fetchCampaignStats.pending, (state) => {
        state.isFetchingStats = true;
        state.currentCampaignStats = null;
        state.fetchStatsError = null;
      })
      .addCase(fetchCampaignStats.fulfilled, (state, action) => {
        state.isFetchingStats = false;
        state.currentCampaignStats = action.payload;
      })
      .addCase(fetchCampaignStats.rejected, (state, action) => {
        state.isFetchingStats = false;
        state.fetchStatsError = action.payload;
      });
  },
});

export const {
  setCampaignsCurrentPage,
  setCampaignsPageSize,
  setCampaignsSearchTerm,
  setCampaignsFilters,
  clearCurrentCampaign,
  setWizardStep,
  updateWizardData,
  resetWizard,
  loadCampaignIntoWizard,
  clearCampaignStats, // Export new reducer
} = campaignsSlice.actions;

// Existing Selectors
export const selectAllCampaigns = (state) => state.campaigns.campaigns;
export const selectCampaignsPagination = (state) => state.campaigns.pagination;
export const selectCurrentCampaignData = (state) => state.campaigns.currentCampaign;
export const selectCampaignsLoading = (state) => state.campaigns.isLoading;
export const selectCampaignsSubmitting = (state) => state.campaigns.isSubmitting;
export const selectCampaignsError = (state) => state.campaigns.error;
export const selectCampaignsSearchTerm = (state) => state.campaigns.searchTerm;
export const selectCampaignsFilters = (state) => state.campaigns.filters;
export const selectCampaignWizardState = (state) => state.campaigns.wizardState;

// New Selectors for Stats
export const selectCurrentCampaignStats = (state) => state.campaigns.currentCampaignStats;
export const selectIsFetchingStats = (state) => state.campaigns.isFetchingStats;
export const selectFetchStatsError = (state) => state.campaigns.fetchStatsError;


export default campaignsSlice.reducer;
