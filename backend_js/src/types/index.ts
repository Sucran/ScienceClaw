// API Response format
export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T | null;
}

// Auth types
export interface AuthUser {
  id: string;
  username: string;
  fullname: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username?: string;
  fullname: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// Session types
export interface Session {
  session_id: string;
  thread_id: string;
  user_id: string;
  mode: string;
  model_config?: Record<string, unknown>;
  vm_root_dir: string;
  created_at: number;
  updated_at: number;
  status: 'pending' | 'running' | 'completed';
  events: SessionEvent[];
  plan: PlanStep[];
  title?: string;
  unread_message_count: number;
  is_shared: boolean;
  latest_message: string;
  latest_message_at: number;
  pinned: boolean;
  source?: string;
}

export interface SessionEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

export interface PlanStep {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tools: string[];
  files: string[];
  priority: 'low' | 'medium' | 'high';
}

// Model config
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  base_url?: string;
  api_key?: string;
  model_name: string;
  context_window?: number;
  is_system: boolean;
  user_id?: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

// Task settings
export interface TaskSettings {
  agent_stream_timeout: number;
  sandbox_exec_timeout: number;
  max_tokens: number;
  output_reserve: number;
  max_history_rounds: number;
  max_output_chars: number;
}
