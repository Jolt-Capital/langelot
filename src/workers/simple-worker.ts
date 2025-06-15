import { OpenAIConnector } from '../connectors/index.js';
import { WorkerOptions } from '../types/index.js';

export interface SimpleWorkerResult {
  approach: string;
  result: string;
  model: string;
  duration: number;
}

export class SimpleWorker {
  private connector: OpenAIConnector;
  private options: Required<WorkerOptions>;

  constructor(connector: OpenAIConnector, options: WorkerOptions = {}) {
    this.connector = connector;
    this.options = {
      model: options.model || 'gpt-4.1-mini',
      maxTokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
    };
  }

  async execute(
    task: string,
    approach: string,
    description: string,
    context?: Record<string, any>
  ): Promise<SimpleWorkerResult> {
    const startTime = Date.now();
    
    const contextInfo = context && Object.keys(context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';

    const prompt = `You are a specialized worker tasked with executing a specific approach to solve part of a larger task.

Original Task: ${task}
Your Approach: ${approach}
Approach Description: ${description}${contextInfo}

Execute this approach efficiently and provide your result. Focus on delivering high-quality output that addresses the specific approach you've been assigned using your training data and reasoning capabilities.

Format your response as:
<result>
Your detailed result here
</result>`;

    try {
      const response = await this.connector.llmCall(
        prompt,
        this.options.model,
        this.options.maxTokens,
        this.options.temperature,
        `SIMPLE-WORKER (${approach})`
      );

      const duration = Date.now() - startTime;

      // Extract result from XML tags
      const resultMatch = response.content.match(/<result>([\s\S]*?)<\/result>/);
      const result = resultMatch ? resultMatch[1].trim() : response.content;

      return {
        approach,
        result,
        model: this.options.model,
        duration,
      };

    } catch (error) {
      throw new Error(`SimpleWorker execution failed: ${error}`);
    }
  }
}