import { describe, it, expect } from 'vitest'
import type {
  ApiResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  Session,
  SessionEvent,
  PlanStep,
  ModelConfig,
  TaskSettings
} from '../../src/types/index.ts'

describe('Types', () => {
  describe('ApiResponse', () => {
    it('should have correct structure for success response', () => {
      const response: ApiResponse<string> = {
        code: 200,
        msg: 'Success',
        data: 'test data'
      }
      expect(response.code).toBe(200)
      expect(response.msg).toBe('Success')
      expect(response.data).toBe('test data')
    })

    it('should allow null data', () => {
      const response: ApiResponse<null> = {
        code: 404,
        msg: 'Not found',
        data: null
      }
      expect(response.data).toBeNull()
    })

    it('should support complex data types', () => {
      const response: ApiResponse<{ items: string[] }> = {
        code: 200,
        msg: 'OK',
        data: { items: ['a', 'b', 'c'] }
      }
      expect(response.data?.items).toEqual(['a', 'b', 'c'])
    })
  })

  describe('AuthUser', () => {
    it('should have correct structure', () => {
      const user: AuthUser = {
        id: 'user-123',
        username: 'testuser',
        fullname: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      expect(user.id).toBe('user-123')
      expect(user.username).toBe('testuser')
      expect(user.is_active).toBe(true)
    })

    it('should allow optional last_login_at', () => {
      const user: AuthUser = {
        id: 'user-123',
        username: 'testuser',
        fullname: 'Test User',
        email: 'test@example.com',
        role: 'user',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login_at: '2024-01-02T00:00:00Z'
      }
      expect(user.last_login_at).toBe('2024-01-02T00:00:00Z')
    })
  })

  describe('LoginRequest', () => {
    it('should have correct structure', () => {
      const request: LoginRequest = {
        username: 'testuser',
        password: 'password123'
      }
      expect(request.username).toBe('testuser')
      expect(request.password).toBe('password123')
    })
  })

  describe('RegisterRequest', () => {
    it('should have correct structure with all fields', () => {
      const request: RegisterRequest = {
        username: 'newuser',
        fullname: 'New User',
        email: 'new@example.com',
        password: 'securepass'
      }
      expect(request.username).toBe('newuser')
      expect(request.fullname).toBe('New User')
      expect(request.email).toBe('new@example.com')
    })

    it('should allow missing username', () => {
      const request: RegisterRequest = {
        fullname: 'New User',
        email: 'new@example.com',
        password: 'securepass'
      }
      expect(request.username).toBeUndefined()
    })
  })

  describe('TokenResponse', () => {
    it('should have correct structure', () => {
      const response: TokenResponse = {
        user: {
          id: 'user-123',
          username: 'testuser',
          fullname: 'Test User',
          email: 'test@example.com',
          role: 'user',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        token_type: 'Bearer'
      }
      expect(response.access_token).toContain('.')
      expect(response.refresh_token).toContain('.')
      expect(response.token_type).toBe('Bearer')
    })
  })

  describe('Session', () => {
    it('should have correct structure', () => {
      const session: Session = {
        session_id: 'session-123',
        thread_id: 'thread-456',
        user_id: 'user-789',
        mode: 'chat',
        vm_root_dir: '/workspace',
        created_at: Date.now(),
        updated_at: Date.now(),
        status: 'running',
        events: [],
        plan: [],
        unread_message_count: 0,
        is_shared: false,
        latest_message: 'Hello',
        latest_message_at: Date.now(),
        pinned: false
      }
      expect(session.session_id).toBe('session-123')
      expect(session.status).toBe('running')
    })

    it('should allow optional fields', () => {
      const session: Session = {
        session_id: 'session-123',
        thread_id: 'thread-456',
        user_id: 'user-789',
        mode: 'chat',
        vm_root_dir: '/workspace',
        created_at: Date.now(),
        updated_at: Date.now(),
        status: 'completed',
        events: [],
        plan: [],
        unread_message_count: 0,
        is_shared: false,
        latest_message: 'Hello',
        latest_message_at: Date.now(),
        pinned: false,
        title: 'My Session',
        source: 'api'
      }
      expect(session.title).toBe('My Session')
      expect(session.source).toBe('api')
    })

    it('should support different status values', () => {
      const pendingSession: Session = {
        session_id: 's1',
        thread_id: 't1',
        user_id: 'u1',
        mode: 'chat',
        vm_root_dir: '/workspace',
        created_at: Date.now(),
        updated_at: Date.now(),
        status: 'pending',
        events: [],
        plan: [],
        unread_message_count: 0,
        is_shared: false,
        latest_message: '',
        latest_message_at: Date.now(),
        pinned: false
      }
      expect(pendingSession.status).toBe('pending')
    })
  })

  describe('SessionEvent', () => {
    it('should have correct structure', () => {
      const event: SessionEvent = {
        event: 'message',
        data: { content: 'Hello' },
        timestamp: Date.now()
      }
      expect(event.event).toBe('message')
      expect(event.data.content).toBe('Hello')
    })

    it('should allow optional timestamp', () => {
      const event: SessionEvent = {
        event: 'error',
        data: { error: 'Something went wrong' }
      }
      expect(event.timestamp).toBeUndefined()
    })
  })

  describe('PlanStep', () => {
    it('should have correct structure', () => {
      const step: PlanStep = {
        id: 'step-1',
        content: 'Do something',
        status: 'in_progress',
        tools: ['tool1'],
        files: ['file1.txt'],
        priority: 'high'
      }
      expect(step.id).toBe('step-1')
      expect(step.status).toBe('in_progress')
    })

    it('should support all status values', () => {
      const statuses: PlanStep['status'][] = ['pending', 'in_progress', 'completed', 'failed']
      for (const status of statuses) {
        const step: PlanStep = {
          id: 's',
          content: 'c',
          status,
          tools: [],
          files: [],
          priority: 'medium'
        }
        expect(step.status).toBe(status)
      }
    })

    it('should support all priority values', () => {
      const priorities: PlanStep['priority'][] = ['low', 'medium', 'high']
      for (const priority of priorities) {
        const step: PlanStep = {
          id: 's',
          content: 'c',
          status: 'pending',
          tools: [],
          files: [],
          priority
        }
        expect(step.priority).toBe(priority)
      }
    })
  })

  describe('ModelConfig', () => {
    it('should have correct structure', () => {
      const config: ModelConfig = {
        id: 'model-1',
        name: 'GPT-4',
        provider: 'openai',
        model_name: 'gpt-4',
        is_system: false,
        is_active: true,
        created_at: Date.now(),
        updated_at: Date.now()
      }
      expect(config.provider).toBe('openai')
      expect(config.model_name).toBe('gpt-4')
    })

    it('should allow optional fields', () => {
      const config: ModelConfig = {
        id: 'model-1',
        name: 'DeepSeek',
        provider: 'deepseek',
        base_url: 'https://api.deepseek.com/v1',
        api_key: 'sk-xxx',
        model_name: 'deepseek-chat',
        context_window: 64000,
        is_system: true,
        is_active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        user_id: 'user-123'
      }
      expect(config.base_url).toBe('https://api.deepseek.com/v1')
      expect(config.context_window).toBe(64000)
    })
  })

  describe('TaskSettings', () => {
    it('should have correct structure', () => {
      const settings: TaskSettings = {
        agent_stream_timeout: 120,
        sandbox_exec_timeout: 300,
        max_tokens: 4000,
        output_reserve: 16384,
        max_history_rounds: 6,
        max_output_chars: 50000
      }
      expect(settings.max_tokens).toBe(4000)
      expect(settings.sandbox_exec_timeout).toBe(300)
    })

    it('should have reasonable default-like values', () => {
      const settings: TaskSettings = {
        agent_stream_timeout: 120,
        sandbox_exec_timeout: 600,
        max_tokens: 8000,
        output_reserve: 16384,
        max_history_rounds: 6,
        max_output_chars: 100000
      }
      expect(settings.max_history_rounds).toBe(6)
      expect(settings.output_reserve).toBeGreaterThan(0)
    })
  })
})
