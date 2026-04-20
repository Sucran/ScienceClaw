// Memory runtime types for memory plugin support

export type MemoryPluginRuntime = {
  // Memory runtime methods
  addMemory?: (params: AddMemoryParams) => Promise<AddMemoryResult>;
  retrieveMemories?: (params: RetrieveMemoriesParams) => Promise<RetrieveMemoriesResult>;
  deleteMemory?: (params: DeleteMemoryParams) => Promise<void>;
  searchMemories?: (params: SearchMemoriesParams) => Promise<SearchMemoriesResult>;
};

export type AddMemoryParams = {
  scope?: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type AddMemoryResult = {
  id: string;
  createdAt: number;
};

export type RetrieveMemoriesParams = {
  scope?: string;
  limit?: number;
  since?: number;
};

export type RetrieveMemoriesResult = {
  memories: Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    createdAt: number;
  }>;
};

export type SearchMemoriesParams = {
  query: string;
  scope?: string;
  limit?: number;
};

export type SearchMemoriesResult = {
  results: Array<{
    id: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
  }>;
};

export type DeleteMemoryParams = {
  id: string;
  scope?: string;
};

export type MemoryPromptSectionBuilder = (params: {
  scope?: string;
  sessionId?: string;
  agentId?: string;
}) => Promise<MemoryPromptSection>;

export type MemoryPromptSection = {
  title: string;
  content: string;
  priority?: number;
};

export type PluginEmbeddingProvider = {
  embed: (input: string | string[]) => Promise<number[][]>;
  dimensions: number;
  normalize?: boolean;
};
