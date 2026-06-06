import { z } from "zod";
import { ProviderError } from "./provider-error";

export const TranslationModeSchema = z.enum(["quick", "deep"]);

export const TranslationRequestSchema = z
  .object({
    text: z.string(),
    from: z.string(),
    to: z.string(),
    context: z.string().optional(),
    mode: TranslationModeSchema,
    providerId: z.string().optional(),
    ieltsMode: z.boolean().optional(),
    ieltsTarget: z.string().optional(),
  })
  .strict();

export const TranslationExampleSchema = z
  .object({
    src: z.string(),
    tgt: z.string(),
  })
  .strict();

export const PartOfSpeechEntrySchema = z
  .object({
    pos: z.string(),
    definition: z.string(),
  })
  .strict();

export const TranslationResultSchema = z
  .object({
    originalText: z.string(),
    translatedText: z.string(),
    provider: z.string(),
    phonetic: z.string().optional(),
    alternatives: z.array(z.string()).optional(),
    explanation: z.string().optional(),
    examples: z.array(TranslationExampleSchema).optional(),
    partOfSpeech: z.array(PartOfSpeechEntrySchema).optional(),
    fromCache: z.boolean().optional(),
    streamed: z.boolean().optional(),
    isError: z.boolean().optional(),
    errorMessage: z.string().optional(),
  })
  .strict();

const ProviderCredentialSchema = z
  .object({
    apiKey: z.string().optional(),
    apiUser: z.string().optional(),
    apiBase: z.string().optional(),
    model: z.string().optional(),
    extra: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const SettingsSchema = z
  .object({
    triggerMode: z.enum(["selection", "altSelection", "shortcut"]),
    autoRead: z.boolean(),
    fontSize: z.number(),
    bubbleOpacity: z.number(),
    theme: z.enum(["system", "light", "dark"]),
    sourceLang: z.string(),
    targetLang: z.string(),
    primaryProvider: z.string(),
    fallbackChain: z.array(z.string()),
    deepProvider: z.string(),
    llmProProvider: z.string(),
    vocabExampleProvider: z.string(),
    immersiveEnabled: z.boolean(),
    immersiveDefaultEngine: z.string(),
    whitelist: z.array(z.string()),
    pdfEnabled: z.boolean(),
    inputEnhanceEnabled: z.boolean(),
    inputEnhanceAutoExpandToolbar: z.boolean(),
    vocabHighlightEnabled: z.boolean(),
    ieltsMode: z.boolean(),
    ieltsTarget: z.enum(["6.0", "6.5", "7.0", "7.5", "8.0+"]),
    credentials: z.record(z.string(), ProviderCredentialSchema),
    migratedTo: z.string().optional(),
  })
  .strict();

export const SettingsPatchSchema = SettingsSchema.partial();

export const TranslationSelectionRequestSchema = TranslationRequestSchema.extend({
  openSidePanel: z.boolean().optional(),
});

export const MessageEnvelopeSchema = z
  .object({
    type: z.string(),
    payload: z.unknown().optional(),
  })
  .strict();

export const MessagePayloadSchemas = {
  "settings:update": SettingsPatchSchema,
  "translate:request": TranslationRequestSchema,
  "translate:selection": TranslationSelectionRequestSchema,
} as const;

export const GoogleTranslateResponseSchema = z
  .object({
    sentences: z.array(z.object({ trans: z.string().optional() }).passthrough()).optional(),
    src: z.string().optional(),
  })
  .passthrough();

export const BingTranslateResponseSchema = z.array(
  z
    .object({
      translations: z.array(z.object({ text: z.string().optional() }).passthrough()).optional(),
    })
    .passthrough()
);

export const MyMemoryResponseSchema = z
  .object({
    responseData: z.object({ translatedText: z.string().optional() }).passthrough().optional(),
    responseStatus: z.number().optional(),
    responseDetails: z.string().optional(),
  })
  .passthrough();

export const DeepLResponseSchema = z
  .object({
    translations: z
      .array(
        z
          .object({
            text: z.string().optional(),
            detected_source_language: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export const VolcanoResponseSchema = z
  .object({
    translation: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const ChatCompletionStreamChunkSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            delta: z.object({ content: z.string().optional() }).passthrough().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export const ClaudeStreamChunkSchema = z
  .object({
    type: z.string().optional(),
    delta: z
      .object({
        type: z.string().optional(),
        text: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const GeminiStreamChunkSchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            content: z
              .object({
                parts: z.array(z.object({ text: z.string().optional() }).passthrough()).optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export const OllamaChatChunkSchema = z
  .object({
    message: z.object({ content: z.string().optional() }).passthrough().optional(),
    done: z.boolean().optional(),
  })
  .passthrough();

export const DeepPayloadSchema = TranslationResultSchema.pick({
  translatedText: true,
  phonetic: true,
  alternatives: true,
  explanation: true,
  examples: true,
  partOfSpeech: true,
}).partial();

export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;
export type TranslationResult = z.infer<typeof TranslationResultSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "payload";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseProviderJson<T>(
  schema: z.ZodType<T>,
  value: unknown,
  providerId: string,
  label: string
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ProviderError({
      code: "PARSE_ERROR",
      providerId,
      retryable: true,
      userMessage: `${label} invalid response: ${formatValidationError(result.error)}`,
    });
  }
  return result.data;
}
