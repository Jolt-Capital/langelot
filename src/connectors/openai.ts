import OpenAI from 'openai';

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface WebSearchResponse {
  content: string;
  model: string;
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMCallLog {
  timestamp: Date;
  prompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
  response: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  duration: number;
}

export class OpenAIConnector {
  private client: OpenAI;
  private verbose: boolean = false;
  private callLogs: LLMCallLog[] = [];

  constructor(apiKey?: string, verbose: boolean = false) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.verbose = verbose;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  getCallLogs(): LLMCallLog[] {
    return [...this.callLogs];
  }

  clearLogs(): void {
    this.callLogs = [];
  }

  async webSearchCall(
    input: string,
    model: string = 'gpt-4.1',
    role?: string
  ): Promise<WebSearchResponse> {
    const startTime = Date.now();
    const timestamp = new Date();

    if (this.verbose) {
      console.log(`\n🔍 ${role || 'WEB-SEARCH'} Call [${timestamp.toISOString()}]`);
      console.log(`Model: ${model} | Tool: web_search_preview`);
      console.log(`Input (${input.length} chars):`);
      console.log('─'.repeat(50));
      console.log(input);
      console.log('─'.repeat(50));
    }

    try {
      // Use the responses.create method with web_search_preview tool
      const response = await this.client.responses.create({
        model,
        tools: [{ type: "web_search_preview" }],
        input,
      });
      if (this.verbose) {
        console.log('Response:');
        console.log(response);
      }

      const duration = Date.now() - startTime;
      const responseContent = response.output_text;
      
      // Extract sources if available
      const sources = response.sources || [];
      
      const usage = response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      } : undefined;

      // Log the call
      const callLog: LLMCallLog = {
        timestamp,
        prompt: input,
        model: response.model || model,
        maxTokens: 0, // Not applicable for responses API
        temperature: 0, // Not applicable for responses API
        response: responseContent,
        usage,
        duration,
      };
      this.callLogs.push(callLog);

      if (this.verbose) {
        console.log(`\n✅ ${role || 'WEB-SEARCH'} Response (${duration}ms):`);
        if (usage) {
          console.log(`Tokens: ${usage.prompt_tokens} + ${usage.completion_tokens} = ${usage.total_tokens}`);
        }
        if (sources.length > 0) {
          console.log(`Sources found: ${sources.length}`);
        }
        console.log('─'.repeat(50));
        console.log(responseContent);
        console.log('─'.repeat(50));
      }

      return {
        content: responseContent,
        model: response.model || model,
        sources,
        usage,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      if (this.verbose) {
        console.log(`\n❌ ${role || 'WEB-SEARCH'} Error (${duration}ms): ${error}`);
      }
      throw new Error(`OpenAI Web Search API call failed: ${error}`);
    }
  }

  async llmCall(
    prompt: string,
    model: string = 'gpt-4.1',
    maxTokens: number = 1000,
    temperature: number = 0.7,
    role?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const timestamp = new Date();

    if (this.verbose) {
      console.log(`\n🤖 ${role || 'LLM'} Call [${timestamp.toISOString()}]`);
      console.log(`Model: ${model} | Max Tokens: ${maxTokens} | Temperature: ${temperature}`);
      console.log(`Prompt (${prompt.length} chars):`);
      console.log('─'.repeat(50));
      console.log(prompt.length > 500 ? prompt.substring(0, 500) + '...' : prompt);
      console.log('─'.repeat(50));
    }

    try {
      const response = await this.client.responses.create({
        model,
        input: prompt,
        temperature,
      });

      const responseContent = response.output_text;
      if (!responseContent) {
        throw new Error('No content received from OpenAI');
      }

      const duration = Date.now() - startTime;
      const usage = response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      } : undefined;

      // Log the call
      const callLog: LLMCallLog = {
        timestamp,
        prompt,
        model: response.model || model,
        maxTokens,
        temperature,
        response: responseContent,
        usage,
        duration,
      };
      this.callLogs.push(callLog);

      if (this.verbose) {
        console.log(`\n✅ ${role || 'LLM'} Response (${duration}ms):`);
        if (usage) {
          console.log(`Tokens: ${usage.prompt_tokens} + ${usage.completion_tokens} = ${usage.total_tokens}`);
        }
        console.log('─'.repeat(50));
        console.log(responseContent.length > 500 ? responseContent.substring(0, 500) + '...' : responseContent);
        console.log('─'.repeat(50));
      }

      return {
        content: responseContent,
        model: response.model || model,
        usage,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      if (this.verbose) {
        console.log(`\n❌ ${role || 'LLM'} Error (${duration}ms): ${error}`);
      }
      throw new Error(`OpenAI API call failed: ${error}`);
    }
  }
}