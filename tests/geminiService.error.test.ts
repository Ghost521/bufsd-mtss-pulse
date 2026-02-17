import { describe, expect, it } from "vitest";
import { ApiError, getAiFailureInfo } from "../src/services/geminiService";

describe("getAiFailureInfo", () => {
  it("marks rate-limit responses as retryable and parses retry delay", () => {
    const info = getAiFailureInfo(new ApiError("Gemini rate limit reached. Please retry in about 34 seconds.", 429));
    expect(info.isRetryable).toBe(true);
    expect(info.retryAfterSeconds).toBe(34);
    expect(info.status).toBe(429);
  });

  it("handles temporary service availability errors", () => {
    const info = getAiFailureInfo(new ApiError("Service temporarily unavailable.", 503));
    expect(info.isRetryable).toBe(true);
    expect(info.retryAfterSeconds).toBeUndefined();
    expect(info.status).toBe(503);
  });

  it("defaults unknown errors to non-retryable fallback", () => {
    const info = getAiFailureInfo(null, "Fallback message");
    expect(info.isRetryable).toBe(false);
    expect(info.message).toBe("Fallback message");
  });
});
