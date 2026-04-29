import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// OpenRouter is OpenAI-compatible — we use the OpenAI SDK pointed at OpenRouter's base URL.
// This means we can swap models (DeepSeek, Hunyuan, GPT-4o) without changing any code,
// just by changing the model string. Same API contract, different backends.
@Injectable()
export class OpenRouterService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenRouterService.name);

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.get<string>('OPENROUTER_API_KEY'),
      baseURL: config.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
      defaultHeaders: {
        'HTTP-Referer': config.get<string>('WEB_URL', 'https://empleadoia.com'),
        'X-Title': 'Empleado IA',
      },
    });
  }

  async chat(
    model: string,
    messages: OpenAI.ChatCompletionMessageParam[],
    tools?: OpenAI.ChatCompletionTool[],
    temperature = 0.3,
    maxTokens = 500,
  ): Promise<OpenAI.ChatCompletion> {
    this.logger.debug(`Calling model: ${model} (${messages.length} messages)`);

    const response = await this.client.chat.completions.create({
      model,
      messages,
      tools: tools?.length ? tools : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
      temperature,
      max_tokens: maxTokens,
    });

    return response;
  }

  // Attempt with primary model, fallback to secondary on rate limit or server error
  async chatWithFallback(
    primaryModel: string,
    fallbackModel: string,
    messages: OpenAI.ChatCompletionMessageParam[],
    tools?: OpenAI.ChatCompletionTool[],
    temperature = 0.3,
    maxTokens = 500,
  ): Promise<{ response: OpenAI.ChatCompletion; modelUsed: string }> {
    try {
      const response = await this.chat(primaryModel, messages, tools, temperature, maxTokens);
      return { response, modelUsed: primaryModel };
    } catch (error) {
      const err = error as { status?: number; message?: string };
      const shouldFallback = err.status === 429 || err.status === 500 || err.status === 503;

      if (shouldFallback && fallbackModel !== primaryModel) {
        this.logger.warn(
          `Primary model ${primaryModel} failed (${err.status}), falling back to ${fallbackModel}`,
        );
        const response = await this.chat(fallbackModel, messages, tools, temperature, maxTokens);
        return { response, modelUsed: fallbackModel };
      }

      throw error;
    }
  }

  getModelsForAgent(modelName: string, fallbackModelName: string) {
    return { primary: modelName, fallback: fallbackModelName };
  }
}
