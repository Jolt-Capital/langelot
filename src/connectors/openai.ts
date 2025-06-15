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

export class OpenAIConnector {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async llmCall(
    prompt: string,
    model: string = 'gpt-4',
    maxTokens: number = 1000,
    temperature: number = 0.7
  ): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content received from OpenAI');
      }

      return {
        content: choice.message.content,
        model: response.model,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      throw new Error(`OpenAI API call failed: ${error}`);
    }
  }
}