export interface OrchestratorOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  context?: Record<string, any>;
}

export interface SubtaskStrategy {
  approach: string;
  description: string;
}

export interface WorkerResult {
  approach: string;
  result: string;
}

export interface OrchestratorResult {
  task: string;
  strategies: SubtaskStrategy[];
  results: WorkerResult[];
  synthesis: string;
}