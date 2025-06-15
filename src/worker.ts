import { OpenAIConnector } from './connectors/index.js';
import { extractSingleXml } from './utils/xml-parser.js';

export interface WorkerOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class Worker {
  private connector: OpenAIConnector;
  private options: Required<WorkerOptions>;

  constructor(connector: OpenAIConnector, options: WorkerOptions = {}) {
    this.connector = connector;
    this.options = {
      model: options.model || 'gpt-4.1',
      maxTokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
    };
  }

  async execute(task: string, approach: string, description: string, context?: Record<string, any>): Promise<string> {
    const contextInfo = context && Object.keys(context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';

    const prompt = `You are a specialized worker tasked with executing a specific approach to solve part of a larger task.

Original Task: ${task}
Your Approach: ${approach}
Approach Description: ${description}${contextInfo}

Execute this approach thoroughly and provide your result. Focus on delivering high-quality output that addresses the specific approach you've been assigned.

Format your response as:
<result>
Your detailed result here
</result>`;

    try {
      const response = await this.connector.llmCall(
        prompt,
        this.options.model,
        this.options.maxTokens,
        this.options.temperature
      );

      const result = extractSingleXml(response.content, 'result');
      return result || response.content;
    } catch (error) {
      throw new Error(`Worker execution failed: ${error}`);
    }
  }
}