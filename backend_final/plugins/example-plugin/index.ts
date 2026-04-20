// Example plugin - demonstrates plugin system features

import { definePlugin } from '../../src/plugins/define-plugin.ts';

export default definePlugin({
  id: 'example-plugin',
  name: 'Example Plugin',
  description: 'Example plugin demonstrating the plugin system',
  tools: [
    {
      name: 'example_greet',
      description: 'Returns a greeting message',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' }
        },
        required: ['name']
      },
      execute: async (input: unknown) => {
        const { name } = input as { name: string };
        const greeting = 'Hello';
        return { message: `${greeting}, ${name}!` };
      }
    },
    {
      name: 'example_echo',
      description: 'Echoes back the input',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'Value to echo' }
        },
        required: ['value']
      },
      execute: async (input: unknown) => {
        return input;
      }
    }
  ],
  hooks: [
    {
      events: 'before_agent_start',
      handler: async (event, ctx) => {
        console.log('[example-plugin] before_agent_start hook fired', { sessionId: ctx.sessionId });
      }
    },
    {
      events: 'after_tool_call',
      handler: async (event, ctx) => {
        console.log('[example-plugin] after_tool_call hook fired', { sessionId: ctx.sessionId });
      }
    }
  ],
  register: (api) => {
    // Register an HTTP route
    api.registerHttpRoute({
      method: 'GET',
      path: '/example/health',
      handler: async () => {
        return { status: 'ok', plugin: 'example-plugin' };
      },
      auth: 'none'
    });

    api.registerHttpRoute({
      method: 'GET',
      path: '/example/config',
      handler: async () => {
        return {
          greeting: api.config.greeting || 'Hello'
        };
      },
      auth: 'none'
    });

    // Register a service
    api.registerService({
      id: 'example-service',
      name: 'Example Service',
      init: async (serviceApi) => {
        console.log('[example-plugin] Example service initialized');
      },
      destroy: async (serviceApi) => {
        console.log('[example-plugin] Example service destroyed');
      }
    });

    console.log('[example-plugin] Registered with config:', api.config);
  }
});
