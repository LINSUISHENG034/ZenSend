import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api';

// Helper to extract error message
const getErrorMessage = (error) => {
  return error.response?.data?.detail || error.response?.data?.error || error.response?.data?.message || error.message || 'An unexpected error occurred.';
};

const initialState = {
  templates: [],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalTemplates: 0,
    pageSize: 10, // Default page size
    next: null,
    previous: null,
  },
  currentTemplate: null,
  isLoading: false, // For fetching lists or single template
  isSubmitting: false, // For CUD operations on templates
  error: null,
  aiGeneratedContent: null,
  isGeneratingAiContent: false,
  aiError: null, // Separate error state for AI generation
};

// Async Thunks
export const fetchTemplates = createAsyncThunk(
  'templates/fetchTemplates',
  async ({ page = 1, pageSize = 10 } = {}, { rejectWithValue }) => { // Provide default empty object
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('page_size', pageSize);
      const response = await apiClient.get(`/templates/templates/?${params.toString()}`);
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

export const fetchTemplateById = createAsyncThunk(
  'templates/fetchTemplateById',
  async (templateId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/templates/templates/${templateId}/`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const createTemplate = createAsyncThunk(
  'templates/createTemplate',
  async (templateData, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/templates/templates/', templateData);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateTemplate = createAsyncThunk(
  'templates/updateTemplate',
  async ({ templateId, templateData }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/templates/templates/${templateId}/`, templateData);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const deleteTemplate = createAsyncThunk(
  'templates/deleteTemplate',
  async (templateId, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/templates/templates/${templateId}/`);
      return templateId; // Return id for removal from state
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const generateAiContent = createAsyncThunk(
  'templates/generateAiContent',
  async (prompt, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/ai/generate/', { prompt }); // Ensure this matches your API endpoint
      return response.data.generated_text; // Assuming { "generated_text": "..." }
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    clearCurrentTemplate(state) {
      state.currentTemplate = null;
    },
    clearAiGeneratedContent(state) {
      state.aiGeneratedContent = null;
      state.aiError = null;
    },
    setCurrentTemplateLocally(state, action) { // For setting template data from list without fetching
        state.currentTemplate = action.payload;
    },
    // Reducers for pagination if handled synchronously
    setTemplatesCurrentPage(state, action) {
        state.pagination.currentPage = action.payload;
    },
    setTemplatesPageSize(state, action) {
        state.pagination.pageSize = action.payload;
        state.pagination.currentPage = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Templates
      .addCase(fetchTemplates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.isLoading = false;
        state.templates = action.payload.results;
        state.pagination.totalTemplates = action.payload.count;
        state.pagination.next = action.payload.next;
        state.pagination.previous = action.payload.previous;
        state.pagination.currentPage = action.payload.currentPage;
        state.pagination.pageSize = action.payload.pageSize;
        state.pagination.totalPages = Math.ceil(action.payload.count / action.payload.pageSize);
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch Template By ID
      .addCase(fetchTemplateById.pending, (state) => {
        state.isLoading = true;
        state.currentTemplate = null;
        state.error = null;
      })
      .addCase(fetchTemplateById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTemplate = action.payload;
      })
      .addCase(fetchTemplateById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create Template
      .addCase(createTemplate.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.isSubmitting = false;
        // state.templates.unshift(action.payload); // Optionally add to list, or rely on re-fetch
        // state.pagination.totalTemplates += 1;
      })
      .addCase(createTemplate.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })
      // Update Template
      .addCase(updateTemplate.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.currentTemplate = action.payload;
        const index = state.templates.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.templates[index] = action.payload;
        }
      })
      .addCase(updateTemplate.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })
      // Delete Template
      .addCase(deleteTemplate.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.isSubmitting = false;
        state.templates = state.templates.filter(t => t.id !== action.payload);
        state.pagination.totalTemplates -= 1;
      })
      .addCase(deleteTemplate.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })
      // Generate AI Content
      .addCase(generateAiContent.pending, (state) => {
        state.isGeneratingAiContent = true;
        state.aiGeneratedContent = null;
        state.aiError = null;
      })
      .addCase(generateAiContent.fulfilled, (state, action) => {
        state.isGeneratingAiContent = false;
        state.aiGeneratedContent = action.payload;
      })
      .addCase(generateAiContent.rejected, (state, action) => {
        state.isGeneratingAiContent = false;
        state.aiError = action.payload;
      });
  },
});

export const {
    clearCurrentTemplate,
    clearAiGeneratedContent,
    setCurrentTemplateLocally,
    setTemplatesCurrentPage,
    setTemplatesPageSize,
} = templatesSlice.actions;

// Selectors
export const selectAllTemplates = (state) => state.templates.templates;
export const selectTemplatesPagination = (state) => state.templates.pagination;
export const selectCurrentTemplate = (state) => state.templates.currentTemplate;
export const selectTemplatesLoading = (state) => state.templates.isLoading;
export const selectTemplatesSubmitting = (state) => state.templates.isSubmitting;
export const selectTemplatesError = (state) => state.templates.error;
export const selectAiGeneratedContent = (state) => state.templates.aiGeneratedContent;
export const selectIsGeneratingAiContent = (state) => state.templates.isGeneratingAiContent;
export const selectAiError = (state) => state.templates.aiError;

export default templatesSlice.reducer;
