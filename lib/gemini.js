// Central Gemini model id used across all AI features (receipt scan, statement
// import, Fina chat, monthly reports).

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Translate a raw Gemini/@google/generative-ai error into a short, user-facing
// message so the UI can toast something actionable instead of a generic
// "Failed to ..." string. The SDK throws GoogleGenerativeAIFetchError with an
// HTTP `status`; we also sniff the message text as a fallback because some
// errors (network, safety blocks) don't carry a status.
//
// `fallback` is what we show when the cause isn't recognized (e.g. a generic
// "Failed to scan receipt.").
export function getFriendlyAIError(error, fallback = "Something went wrong with the AI service. Please try again.") {
  const status = error?.status;
  // Normalize message + nested detail reasons to lowercase for matching.
  const raw = [
    error?.message,
    error?.statusText,
    // errorDetails is an array of { reason, ... } objects on fetch errors.
    ...(Array.isArray(error?.errorDetails)
      ? error.errorDetails.map((d) => `${d?.reason || ""} ${d?.message || ""}`)
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const has = (...needles) => needles.some((n) => raw.includes(n));

  // Rate limit / quota exhausted.
  if (status === 429 || has("429", "quota", "resource_exhausted", "rate limit", "too many requests")) {
    return "The AI service is rate-limited or out of quota right now. Please wait a minute and try again, or check the Gemini API plan/billing.";
  }

  // Invalid or missing API key.
  if (has("api key not valid", "api_key_invalid", "invalid api key", "api key expired", "no api key")) {
    return "The Gemini API key is invalid, expired, or missing. Please check the configured API key.";
  }

  // Permission denied / billing not enabled.
  if (status === 403 || has("permission_denied", "permission denied", "billing")) {
    return "Access to the AI service was denied. The API key may lack permission or billing isn't enabled for the project.";
  }

  // Model not found / unavailable.
  if (status === 404 || has("is not found for api version", "model not found")) {
    return "The configured AI model is unavailable. Please check the model name (GEMINI_MODEL).";
  }

  // Service overloaded / temporarily unavailable.
  if (status === 503 || status === 500 || has("overloaded", "unavailable", "try again later")) {
    return "The AI service is temporarily overloaded. Please try again in a few moments.";
  }

  // Content blocked by safety filters.
  if (has("safety", "blocked", "recitation")) {
    return "The AI couldn't process this content (it was blocked by safety filters). Please try a different file or request.";
  }

  return fallback;
}
