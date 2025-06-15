import { OpenAIConnector, WebSearchResponse } from '../connectors/index.js';
import { extractSingleXml } from '../utils/xml-parser.js';

export interface WebSearchWorkerOptions {
  model?: string;
}

export interface WebSearchResult {
  approach: string;
  result: string;
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  searchPerformed: boolean;
}

export class WebSearchWorker {
  private connector: OpenAIConnector;
  private options: Required<WebSearchWorkerOptions>;

  constructor(connector: OpenAIConnector, options: WebSearchWorkerOptions = {}) {
    this.connector = connector;
    this.options = {
      model: options.model || 'gpt-4.1',
    };
  }

  async execute(task: string, approach: string, description: string, context?: Record<string, any>): Promise<WebSearchResult> {
    const contextInfo = context && Object.keys(context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';

    // Create a search query based on the task and approach
    const searchInput = this.createSearchInput(task, approach, description, contextInfo);

    try {
      // Use OpenAI's web search tool
      const response = await this.connector.webSearchCall(
        searchInput,
        this.options.model,
        `WEB-SEARCH-WORKER (${approach})`
      );

      // Format the result with search findings
      const result = this.formatSearchResult(response, approach, description);

      return {
        approach,
        result,
        sources: response.sources,
        searchPerformed: true,
      };
    } catch (error) {
      // Fallback to regular worker without web search
      console.warn(`Web search failed for ${approach}, falling back to regular processing: ${error}`);
      
      const fallbackResult = await this.executeFallback(task, approach, description, context);
      
      return {
        approach,
        result: fallbackResult,
        sources: undefined,
        searchPerformed: false,
      };
    }
  }

  private createSearchInput(task: string, approach: string, description: string, contextInfo: string): string {
    return `Task: ${task}
Approach: ${approach}
Description: ${description}${contextInfo}

Based on the above task and approach, search for current, relevant information that would help complete this task effectively. Focus on finding recent data, facts, or insights that would be valuable for the "${approach}" approach.`;
  }

  private formatSearchResult(response: WebSearchResponse, approach: string, description: string): string {
    let result = `Using the "${approach}" approach with web search:\n\n`;
    
    result += response.content;
    
    if (response.sources && response.sources.length > 0) {
      result += '\n\nSources consulted:\n';
      response.sources.forEach((source, index) => {
        result += `${index + 1}. ${source.title} - ${source.url}\n`;
        if (source.snippet) {
          result += `   ${source.snippet}\n`;
        }
      });
    }

    return result;
  }

  private async executeFallback(task: string, approach: string, description: string, context?: Record<string, any>): Promise<string> {
    const contextInfo = context && Object.keys(context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';

    const prompt = `You are a specialized worker tasked with executing a specific approach to solve part of a larger task.

Original Task: ${task}
Your Approach: ${approach}
Approach Description: ${description}${contextInfo}

Note: Web search is not available. Please use your training data to provide the best possible answer, but clearly indicate when information might be outdated or when real-time data would be more valuable.

Execute this approach thoroughly and provide your result. Focus on delivering high-quality output that addresses the specific approach you've been assigned.

Format your response as:
<result>
Your detailed result here
</result>`;

    try {
      const response = await this.connector.llmCall(
        prompt,
        this.options.model,
        1500,
        0.7,
        `FALLBACK-WORKER (${approach})`
      );

      const result = extractSingleXml(response.content, 'result') || response.content;
      return `${result.trim()}\n\n[Note: This response used training data only as web search was unavailable]`;
    } catch (error) {
      throw new Error(`Fallback worker execution failed: ${error}`);
    }
  }
}