/**
 * OptiPlan 360 - AI/ML Service Frontend Integration
 * AI/ML servisleri için frontend API client ve hook'lar
 */

import { apiRequest } from './apiClient';

// Local adapter — wraps apiRequest to match the axios-style { data } pattern
const apiClient = {
  get: async <T>(path: string): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, { method: 'GET' });
    return { data };
  },
  post: async <T>(path: string, body?: unknown, _opts?: unknown): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
};

// Types
export interface LLMGenerateRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

export interface LLMGenerateResponse {
  response: string;
  tokens_used: number;
  model: string;
}

export interface ImageClassifyRequest {
  image_path: string;
  top_k?: number;
}

export interface ImageClassifyResult {
  label: string;
  score: number;
}

export interface ZeroShotClassifyRequest {
  image_path: string;
  labels: string[];
}

export interface DiffusionGenerateRequest {
  prompt: string;
  num_images?: number;
  negative_prompt?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, {
    status: string;
    latency_ms: number;
    last_check: string;
    details: Record<string, unknown>;
  }>;
}

// AI Service API Client
export const aiService = {
  // LLM Operations
  async generateText(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const response = await apiClient.post('/api/v1/integration/ai/llm/generate', request);
    return response.data;
  },

  async chatCompletion(messages: { role: string; content: string }[]): Promise<string> {
    const response = await apiClient.post('/api/v1/integration/ai/llm/chat', { messages });
    return response.data.response;
  },

  // Vision Operations
  async classifyImage(request: ImageClassifyRequest): Promise<ImageClassifyResult[]> {
    const response = await apiClient.post('/api/v1/integration/ai/vit/classify', request);
    return response.data.results;
  },

  async zeroShotClassify(request: ZeroShotClassifyRequest): Promise<ImageClassifyResult[]> {
    const response = await apiClient.post('/api/v1/integration/ai/vit/zero-shot', request);
    return response.data.results;
  },

  async generateCaption(image_path: string): Promise<string> {
    const response = await apiClient.post('/api/v1/integration/ai/vit/caption', { image_path });
    return response.data.caption;
  },

  // Diffusion Operations
  async generateImage(request: DiffusionGenerateRequest): Promise<{ message: string; paths: string[] }> {
    const response = await apiClient.post('/api/v1/integration/ai/diffusion/generate', request);
    return response.data;
  },

  async imageToImage(
    image_path: string,
    prompt: string,
    strength?: number
  ): Promise<{ path: string }> {
    const response = await apiClient.post('/api/v1/integration/ai/diffusion/img2img', {
      image_path,
      prompt,
      strength
    });
    return response.data;
  },

  // Meta-learning Operations
  async fewShotPredict(
    supportImages: string[],
    supportLabels: string[],
    queryImage: string
  ): Promise<string> {
    const response = await apiClient.post('/api/v1/integration/ai/meta/few-shot', {
      support_images: supportImages,
      support_labels: supportLabels,
      query_image: queryImage
    });
    return response.data.prediction;
  },
};

// Integration Service API Client
export const integrationService = {
  // Health Check
  async getHealthStatus(): Promise<HealthStatus> {
    const response = await apiClient.get('/api/v1/integration/health');
    return response.data;
  },

  // Initialize Services
  async initializeServices(): Promise<{ message: string; status: string }> {
    const response = await apiClient.post('/api/v1/integration/initialize');
    return response.data;
  },

  // Checkpoint Management
  async getCheckpointStatus(): Promise<{
    active_checkpoints: number;
    completed_checkpoints: number;
    recovered_checkpoints: number;
  }> {
    const response = await apiClient.get('/api/v1/integration/checkpoint/status');
    return response.data;
  },

  async cleanupOldCheckpoints(maxAgeHours: number = 168): Promise<{ cleaned: number }> {
    const response = await apiClient.post('/api/v1/integration/checkpoint/cleanup', null, {
      params: { max_age_hours: maxAgeHours }
    });
    return response.data;
  },

  // Lock Management
  async getLockStats(): Promise<{
    total_locks: number;
    active_locks: number;
    by_type: Record<string, number>;
    expired: number;
  }> {
    const response = await apiClient.get('/api/v1/integration/lock/stats');
    return response.data;
  },

  async cleanupExpiredLocks(): Promise<{ cleaned: number }> {
    const response = await apiClient.post('/api/v1/integration/lock/cleanup');
    return response.data;
  },

  async releaseOwnerLocks(owner: string): Promise<{ released: number }> {
    const response = await apiClient.post(`/api/v1/integration/lock/release-owner/${owner}`);
    return response.data;
  },

  // Bant Validation
  async getBantMappingSummary(): Promise<{
    total_mappings: number;
    valid_mappings: number;
    warning_mappings: number;
    error_mappings: number;
    summary_by_thickness: Record<string, number>;
  }> {
    const response = await apiClient.get('/api/v1/integration/bant/mapping-summary');
    return response.data;
  },

  async getBantValidOptions(): Promise<{ options: string[] }> {
    const response = await apiClient.get('/api/v1/integration/bant/valid-options');
    return response.data;
  },

  async validateBantExportRow(data: {
    bant_kalinligi_ui?: string;
    bant_kalinligi_export?: string;
    u1_ui?: boolean;
    u1_export?: string;
    context?: string;
  }): Promise<{ valid: boolean; errors: string[] }> {
    const response = await apiClient.post('/api/v1/integration/bant/validate-export-row', data);
    return response.data;
  },

  // Atomic Export with Validation
  async atomicExportWithValidation(data: {
    islem_id: string;
    records: unknown[];
    target_dir?: string;
    filename?: string;
    bant_kalinligi?: string;
    user_id?: string;
  }): Promise<{
    status: string;
    message: string;
    transaction_id: string;
    download_url?: string;
  }> {
    const response = await apiClient.post('/api/v1/integration/export/atomic', data);
    return response.data;
  }
};

export default { aiService, integrationService };
