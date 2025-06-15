import path from 'path';
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
      documents: options.documents || [],
    };
  }

  private getOrchestratorPrompt(task: string): string {
    const contextInfo = Object.keys(this.options.context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(this.options.context, null, 2)}`
      : '';

    const documentsInfo = this.options.documents.length > 0
      ? `\n\nAvailable documents for analysis: ${this.options.documents.map(d => path.basename(d)).join(', ')}`
      : '';

    return `You are a task orchestrator. Your job is to analyze a complex task and break it down into 2-3 distinct subtask approaches that can be handled by specialized AI agents.

Task: ${task}${contextInfo}${documentsInfo}

Available agent types:
- SIMPLE: Fast, cost-effective agent (gpt-4.1-mini) for straightforward tasks that don't need real-time data or documents
- SEARCH: Web search agent (gpt-4.1) that can access current information, news, trends, and real-time data
- LIBRARIAN: Document analysis agent (gpt-4.1) that can analyze uploaded documents${this.options.documents.length > 0 ? ' (documents are available)' : ' (no documents provided)'}

Please analyze this task and generate 2-3 different approaches. For each approach, choose the most appropriate agent type based on the requirements.

Format your response as follows:
<approach>Brief name for approach 1</approach>
<agent>simple|search|librarian</agent>
<description>Detailed description of what this approach should accomplish and why this agent type is best suited for it</description>

<approach>Brief name for approach 2</approach>
<agent>simple|search|librarian</agent>
<description>Detailed description of what this approach should accomplish and why this agent type is best suited for it</description>

<approach>Brief name for approach 3</approach>
<agent>simple|search|librarian</agent>
<description>Detailed description of what this approach should accomplish and why this agent type is best suited for it</description>

Focus on creating complementary approaches that together will provide a comprehensive solution. Choose agent types strategically - use SEARCH for current information, LIBRARIAN for document analysis, and SIMPLE for reasoning tasks.`;
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
      // Step 1: Generate subtask strategies with agent type selection
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

      // Step 2: Execute mixed worker tasks in parallel based on chosen agent types
      const results = await this.executeMixedWorkers(strategies, task);

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

  private async executeMixedWorkers(strategies: SubtaskStrategy[], task: string): Promise<WorkerResult[]> {
    // Initialize workers once, reuse for multiple tasks
    let librarianWorker: LibrarianWorker | null = null;
    let webSearchWorker: WebSearchWorker | null = null;
    let simpleWorker: SimpleWorker | null = null;

    // Check if we need librarian worker and validate documents
    const needsLibrarian = strategies.some(s => s.agentType === 'librarian');
    if (needsLibrarian && this.options.documents.length === 0) {
      console.warn('Librarian agent requested but no documents provided. Converting to simple agent.');
    }

    // Initialize librarian worker if needed and documents are available
    if (needsLibrarian && this.options.documents.length > 0) {
      try {
        librarianWorker = new LibrarianWorker(this.connector, {
          model: this.options.model,
          maxTokens: this.options.maxTokens,
          temperature: this.options.temperature,
          filePaths: this.options.documents,
        });
        await librarianWorker.initialize();
      } catch (error) {
        console.warn(`Librarian worker initialization failed: ${error}. Converting librarian tasks to simple agent.`);
        librarianWorker = null;
      }
    }

    // Execute all strategies in parallel
    const executionPromises = strategies.map(async (strategy): Promise<WorkerResult> => {
      let agentType = strategy.agentType;
      
      // Fallback to simple if librarian requested but no documents or initialization failed
      if (agentType === 'librarian' && (this.options.documents.length === 0 || !librarianWorker)) {
        agentType = 'simple';
      }

      switch (agentType) {
        case 'librarian':
          if (!librarianWorker) {
            throw new Error('Librarian worker not initialized');
          }
          const libResult = await librarianWorker.execute(task, strategy.approach, strategy.description, this.options.context);
          return {
            approach: libResult.approach,
            result: libResult.result,
            filesUsed: libResult.filesUsed,
            workerType: 'librarian' as const,
            model: libResult.model,
            duration: libResult.duration,
          };

        case 'search':
          if (!webSearchWorker) {
            webSearchWorker = new WebSearchWorker(this.connector, {
              model: this.options.model,
            });
          }
          const searchResult = await webSearchWorker.execute(task, strategy.approach, strategy.description, this.options.context);
          return {
            approach: searchResult.approach,
            result: searchResult.result,
            sources: searchResult.sources,
            searchPerformed: searchResult.searchPerformed,
            workerType: 'search' as const,
          };

        case 'simple':
        default:
          if (!simpleWorker) {
            simpleWorker = new SimpleWorker(this.connector, {
              model: 'gpt-4.1-mini',
              maxTokens: this.options.maxTokens,
              temperature: this.options.temperature,
            });
          }
          const simpleResult = await simpleWorker.execute(task, strategy.approach, strategy.description, this.options.context);
          return {
            approach: simpleResult.approach,
            result: simpleResult.result,
            workerType: 'simple' as const,
            model: simpleResult.model,
            duration: simpleResult.duration,
          };
      }
    });

    return await Promise.all(executionPromises);
  }
}