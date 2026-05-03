import OpenAI from "openai";
import { logger } from "../../utils/logger";

export type ResponseFormat = "json" | "text";

export interface ChatCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: ResponseFormat;
  jsonSchema?: Record<string, unknown>;
}

export interface ChatCompletionResponse {
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
}

export class OpenAIService {
  private client: OpenAI;
  private defaultModel: string = "poolside/laguna-xs.2:free";

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }

  /**
   * Common function to call chat completion API
   * Supports different prompts, response formats, and configurations
   */
  async chatCompletion(
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse> {
    try {
      const {
        prompt,
        systemPrompt,
        model = this.defaultModel,
        temperature = 0.7,
        maxTokens = 2000,
        responseFormat = "text",
        jsonSchema,
      } = options;

      // Build messages array
      const messages: OpenAI.ChatCompletionMessageParam[] = [];

      if (systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: prompt,
      });

      // Prepare request parameters
      const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      // Add response format if JSON
      if (responseFormat === "json") {
        if (jsonSchema) {
          // Use structured output with JSON schema (for newer models)
          (requestParams as any).response_format = {
            type: "json_schema",
            json_schema: {
              name: "response",
              schema: jsonSchema,
              strict: true,
            },
          };
        } else {
          // Fallback to JSON mode
          (requestParams as any).response_format = {
            type: "json_object",
          };
        }
      }

      logger.info(`Calling OpenAI API with model: ${model}`);

      const response = await this.client.chat.completions.create(requestParams);

      const content = response.choices[0]?.message?.content || "";

      // Parse JSON if response format is JSON
      let parsedContent = content;
      if (responseFormat === "json") {
        try {
          parsedContent = JSON.stringify(JSON.parse(content));
        } catch {
          logger.warn("Failed to parse JSON response, returning raw content");
        }
      }

      return {
        content: parsedContent,
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finishReason: response.choices[0]?.finish_reason || "unknown",
      };
    } catch (error) {
      logger.error("OpenAI API error:");
      throw {
        status: 500,
        message: "Failed to process with OpenAI",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate text content (general purpose)
   */
  async generateText(
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
  ): Promise<string> {
    const response = await this.chatCompletion({
      prompt,
      systemPrompt,
      temperature,
      responseFormat: "text",
    });
    return response.content;
  }

  /**
   * Generate JSON response with schema validation
   */
  async generateJSON(
    prompt: string,
    jsonSchema?: Record<string, unknown>,
    systemPrompt?: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.chatCompletion({
      prompt,
      systemPrompt,
      responseFormat: "json",
      jsonSchema,
    });

    try {
      return JSON.parse(response.content);
    } catch {
      logger.error("Failed to parse JSON response");
      throw {
        status: 400,
        message: "Invalid JSON response from OpenAI",
      };
    }
  }

  /**
   * Chat with conversation history
   */
  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: Partial<ChatCompletionOptions>,
  ): Promise<ChatCompletionResponse> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens || 2000;

      const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens,
      };

      const response = await this.client.chat.completions.create(requestParams);

      const content = response.choices[0]?.message?.content || "";

      return {
        content,
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finishReason: response.choices[0]?.finish_reason || "unknown",
      };
    } catch (error) {
      logger.error("OpenAI chat error:");
      throw {
        status: 500,
        message: "Failed to process chat with OpenAI",
      };
    }
  }

  /**
   * Get available models
   */
  async listModels() {
    try {
      const models = await this.client.models.list();
      return models.data.map((m) => ({
        id: m.id,
        owned_by: m.owned_by,
      }));
    } catch (error) {
      logger.error("Failed to list models:");
      throw {
        status: 500,
        message: "Failed to list OpenAI models",
      };
    }
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();
