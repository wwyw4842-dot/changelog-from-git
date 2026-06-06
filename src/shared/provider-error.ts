export type ProviderErrorCode =
  | "EMPTY_TEXT"
  | "MISSING_CREDENTIALS"
  | "AUTHENTICATION_FAILURE"
  | "HTTP_ERROR"
  | "EMPTY_RESULT"
  | "UNSUPPORTED_PROVIDER"
  | "RESPONSE_BODY_UNAVAILABLE"
  | "PARSE_ERROR";

export interface ProviderErrorOptions {
  code: ProviderErrorCode;
  providerId?: string;
  status?: number;
  retryable?: boolean;
  userMessage: string;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId?: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(options: ProviderErrorOptions) {
    super(options.userMessage);
    this.name = "ProviderError";
    this.code = options.code;
    this.providerId = options.providerId;
    this.status = options.status;
    this.retryable = options.retryable ?? isRetryableStatus(options.status);
    this.userMessage = options.userMessage;
  }
}

function isRetryableStatus(status?: number): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  );
}
