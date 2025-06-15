export interface OrchestratorOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  context?: Record<string, any>;
  enableWebSearch?: boolean;
}

export interface SubtaskStrategy {
  approach: string;
  description: string;
}

export interface WorkerResult {
  approach: string;
  result: string;
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  searchPerformed?: boolean;
}

export interface OrchestratorResult {
  task: string;
  strategies: SubtaskStrategy[];
  results: WorkerResult[];
  synthesis: string;
}