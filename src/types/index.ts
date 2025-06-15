export interface OrchestratorOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  context?: Record<string, any>;
  enableWebSearch?: boolean;
  enableLibrarian?: boolean;
  librarianFiles?: string[];
  workerType?: 'simple' | 'search' | 'librarian' | 'auto';
}

export interface WorkerOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
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
  filesUsed?: string[];
  workerType?: 'simple' | 'search' | 'librarian';
  model?: string;
  duration?: number;
}

export interface OrchestratorResult {
  task: string;
  strategies: SubtaskStrategy[];
  results: WorkerResult[];
  synthesis: string;
}