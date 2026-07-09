// Central Gemini model id used across all AI features (receipt scan, statement
// import, Fina chat, monthly reports). Keep this pinned to a current GA model —
// `gemini-1.5-flash` was retired by Google and returned 404 on generateContent.
// Bumping the model is now a one-line change here.
export const GEMINI_MODEL = "gemini-2.0-flash";
