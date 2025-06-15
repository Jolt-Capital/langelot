import { OpenAIConnector, LLMResponse } from './connectors/index.js';
import { parseSubtaskStrategies, parseWorkerResults } from './utils/xml-parser.js';
import { OrchestratorOptions, SubtaskStrategy, WorkerResult, OrchestratorResult } from './types/index.js';
import { WebSearchWorker, WebSearchResult, SimpleWorker, LibrarianWorker } from './workers/index.js';

export class FlexibleOrchestrator {
  private connector: OpenAIConnector;
  private options: Required<OrchestratorOptions>;

  constructor(connector: OpenAIConnector, options: OrchestratorOptions = {}) {
    this.connector = connector;
    this.options = {
      model: options.model || 'gpt-4.1',
      maxTokens: options.maxTokens || 1500,
      temperature: options.temperature || 0.7,
      context: options.context || {},
      enableWebSearch: options.enableWebSearch || false,
      enableLibrarian: options.enableLibrarian || false,
      librarianFiles: options.librarianFiles || [],
      workerType: options.workerType || 'auto',
    };
  }

  private getOrchestratorPrompt(task: string): string {
    const contextInfo = Object.keys(this.options.context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(this.options.context, null, 2)}`
      : '';

    return `You are a task orchestrator. Your job is to analyze a complex task and break it down into 2-3 distinct subtask approaches that can be handled by specialized workers.

Task: ${task}${contextInfo}

Please analyze this task and generate 2-3 different approaches for tackling it. Each approach should be distinct and offer a different perspective or method.

Format your response as follows:
<approach>Brief name for approach 1</approach>
<description>Detailed description of what this approach should accomplish and how</description>

<approach>Brief name for approach 2</approach>
<description>Detailed description of what this approach should accomplish and how</description>

<approach>Brief name for approach 3</approach>
<description>Detailed description of what this approach should accomplish and how</description>

Focus on creating complementary approaches that together will provide a comprehensive solution to the task.`;
  }

  private getWorkerPrompt(task: string, approach: string, description: string): string {
    const contextInfo = Object.keys(this.options.context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(this.options.context, null, 2)}`
      : '';

    return `You are a specialized worker tasked with executing a specific approach to solve part of a larger task.

Original Task: ${task}
Your Approach: ${approach}
Approach Description: ${description}${contextInfo}

Execute this approach thoroughly and provide your result. Focus on delivering high-quality output that addresses the specific approach you've been assigned.

Format your response as:
<result>
Your detailed result here
</result>`;
  }

  private getSynthesisPrompt(task: string, results: WorkerResult[]): string {
    const resultsText = results.map(r => 
      `Approach: ${r.approach}\nResult:\n${r.result}`
    ).join('\n\n---\n\n');

    return `You are a synthesis specialist. Your job is to combine multiple approaches to a task into a comprehensive, cohesive final result.

Original Task: ${task}

Worker Results:
${resultsText}

Please synthesize these results into a single, comprehensive response that:
1. Incorporates the best elements from each approach
2. Resolves any conflicts or contradictions
3. Provides a cohesive, well-structured final answer
4. Maintains the strengths of each individual approach

Provide your synthesis:`;
  }

  async orchestrate(task: string): Promise<OrchestratorResult> {
    try {
      // Step 1: Generate subtask strategies
      const orchestratorPrompt = this.getOrchestratorPrompt(task);
      const orchestratorResponse = await this.connector.llmCall(
        orchestratorPrompt,
        this.options.model,
        this.options.maxTokens,
        this.options.temperature,
        'ORCHESTRATOR'
      );

      const strategies = parseSubtaskStrategies(orchestratorResponse.content);
      
      if (strategies.length === 0) {
        throw new Error('Failed to generate subtask strategies');
      }

      // Step 2: Execute worker tasks in parallel based on worker type
      let results: WorkerResult[];
      
      if (this.options.workerType === 'librarian' || this.options.enableLibrarian) {
        results = await this.executeLibrarianWorkers(strategies, task);
      } else if (this.options.workerType === 'search' || this.options.enableWebSearch) {
        results = await this.executeWebSearchWorkers(strategies, task);
      } else if (this.options.workerType === 'simple') {
        results = await this.executeSimpleWorkers(strategies, task);
      } else {
        // Auto mode: choose best worker type based on task
        results = await this.executeAutoWorkers(strategies, task);
      }

      // Step 3: Synthesize results
      const synthesisPrompt = this.getSynthesisPrompt(task, results);
      const synthesisResponse = await this.connector.llmCall(
        synthesisPrompt,
        this.options.model,
        this.options.maxTokens,
        this.options.temperature,
        'SYNTHESIZER'
      );

      return {
        task,
        strategies,
        results,
        synthesis: synthesisResponse.content,
      };

    } catch (error) {
      throw new Error(`Orchestration failed: ${error}`);
    }
  }

  private async executeLibrarianWorkers(strategies: SubtaskStrategy[], task: string): Promise<WorkerResult[]> {
    if (this.options.librarianFiles.length === 0) {
      throw new Error('Librarian workers require files to be specified');
    }

    const librarianWorker = new LibrarianWorker(this.connector, {
      model: this.options.model,
      maxTokens: this.options.maxTokens,
      temperature: this.options.temperature,
      filePaths: this.options.librarianFiles,
    });

    await librarianWorker.initialize();

    const librarianPromises = strategies.map(strategy =>
      librarianWorker.execute(task, strategy.approach, strategy.description, this.options.context)
    );

    const librarianResults = await Promise.all(librarianPromises);
    return librarianResults.map(result => ({
      approach: result.approach,
      result: result.result,
      filesUsed: result.filesUsed,
      workerType: 'librarian' as const,
      model: result.model,
      duration: result.duration,
    }));
  }

  private async executeWebSearchWorkers(strategies: SubtaskStrategy[], task: string): Promise<WorkerResult[]> {
    const webSearchWorker = new WebSearchWorker(this.connector, {
      model: this.options.model,
    });

    const webSearchPromises = strategies.map(strategy =>
      webSearchWorker.execute(task, strategy.approach, strategy.description, this.options.context)
    );

    const webSearchResults = await Promise.all(webSearchPromises);
    return webSearchResults.map(result => ({
      approach: result.approach,
      result: result.result,
      sources: result.sources,
      searchPerformed: result.searchPerformed,
      workerType: 'search' as const,
    }));
  }

  private async executeSimpleWorkers(strategies: SubtaskStrategy[], task: string): Promise<WorkerResult[]> {
    const simpleWorker = new SimpleWorker(this.connector, {
      model: 'gpt-4.1-mini',
      maxTokens: this.options.maxTokens,
      temperature: this.options.temperature,
    });

    const simplePromises = strategies.map(strategy =>
      simpleWorker.execute(task, strategy.approach, strategy.description, this.options.context)
    );

    const simpleResults = await Promise.all(simplePromises);
    return simpleResults.map(result => ({
      approach: result.approach,
      result: result.result,
      workerType: 'simple' as const,
      model: result.model,
      duration: result.duration,
    }));
  }

  private async executeAutoWorkers(strategies: SubtaskStrategy[], task: string): Promise<WorkerResult[]> {
    // Auto mode logic: determine best worker type based on task characteristics
    const taskLower = task.toLowerCase();
    const needsFiles = this.options.librarianFiles.length > 0;
    const needsWebSearch = /\b(current|latest|recent|today|now|2024|2025)\b/.test(taskLower) ||
                          /\b(news|price|stock|weather|trends)\b/.test(taskLower);
    const isSimpleTask = taskLower.length < 100 && !/\b(complex|detailed|comprehensive|analysis)\b/.test(taskLower);

    if (needsFiles) {
      return await this.executeLibrarianWorkers(strategies, task);
    } else if (needsWebSearch) {
      return await this.executeWebSearchWorkers(strategies, task);
    } else if (isSimpleTask) {
      return await this.executeSimpleWorkers(strategies, task);
    } else {
      // Default to web search for complex tasks
      return await this.executeWebSearchWorkers(strategies, task);
    }
  }
}