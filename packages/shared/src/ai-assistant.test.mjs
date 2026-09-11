import { afterEach, describe, expect, test } from "bun:test";
import {
  AI_ASSISTANT_LAST_ACTION_STORAGE_KEY,
  buildAiAssistantLastActionPreference,
  getDefaultAiAction,
  parseAiAssistantLastActionPreference,
  readStoredAiAssistantLastActionPreference,
  resolveAiAssistantLastAction,
  serializeAiAssistantLastActionPreference,
  writeStoredAiAssistantLastActionPreference,
} from "./ai-assistant.ts";

const prompts = [
  { id: "ws_aiprompt_summarize", action: "summarize", seedKey: "summarize" },
  { id: "ws_aiprompt_translate", action: "translate", seedKey: "translate" },
  { id: "ws_custom_weekly", action: "custom", seedKey: null },
];

const originalWindow = globalThis.window;
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

afterEach(() => {
  globalThis.window = originalWindow;
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

describe("AI assistant last processing action", () => {
  test("keeps summarize and polish only as first-time fallbacks", () => {
    expect(getDefaultAiAction(false)).toBe("summarize");
    expect(getDefaultAiAction(true)).toBe("improve-writing");
  });

  test("restores a remembered prompt by id, then seed, then custom", () => {
    expect(resolveAiAssistantLastAction({
      fallbackAction: "summarize",
      preference: {
        action: "custom",
        promptId: "ws_custom_weekly",
        seedKey: null,
      },
      prompts,
    })).toEqual({
      action: "custom",
      selectedPromptId: "ws_custom_weekly",
    });

    expect(resolveAiAssistantLastAction({
      fallbackAction: "summarize",
      preference: {
        action: "translate",
        promptId: "deleted-prompt",
        seedKey: "translate",
        targetLanguage: "ja",
      },
      prompts,
    })).toEqual({
      action: "translate",
      selectedPromptId: "ws_aiprompt_translate",
      targetLanguage: "ja",
    });

    expect(resolveAiAssistantLastAction({
      fallbackAction: "summarize",
      preference: {
        action: "custom",
        promptId: "deleted-custom",
        seedKey: null,
      },
      prompts,
    })).toEqual({
      action: "custom",
      selectedPromptId: null,
    });
  });

  test("falls back to the scope default when nothing has been remembered", () => {
    expect(resolveAiAssistantLastAction({
      fallbackAction: "summarize",
      preference: null,
      prompts,
    })).toEqual({
      action: "summarize",
      selectedPromptId: "ws_aiprompt_summarize",
    });
    expect(resolveAiAssistantLastAction({
      fallbackAction: "improve-writing",
      preference: null,
      prompts: [
        { id: "ws_aiprompt_summarize", action: "summarize", seedKey: "summarize" },
        { id: "ws_aiprompt_improve", action: "improve-writing", seedKey: "improve-writing" },
      ],
    })).toEqual({
      action: "improve-writing",
      selectedPromptId: "ws_aiprompt_improve",
    });
  });

  test("ignores malformed stored preferences", () => {
    expect(parseAiAssistantLastActionPreference(null)).toBe(null);
    expect(parseAiAssistantLastActionPreference("{")).toBe(null);
    expect(parseAiAssistantLastActionPreference(JSON.stringify({ promptId: "x" }))).toBe(null);
    expect(parseAiAssistantLastActionPreference(JSON.stringify({
      action: "not-an-action",
      promptId: "x",
      seedKey: "summarize",
    }))).toBe(null);
  });

  test("round-trips a preference through local storage", () => {
    const values = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
      },
    });

    const preference = buildAiAssistantLastActionPreference({
      action: "translate",
      promptId: "ws_aiprompt_translate",
      seedKey: "translate",
      targetLanguage: "en",
      tone: "friendly",
    });
    writeStoredAiAssistantLastActionPreference(preference);
    expect(values.get(AI_ASSISTANT_LAST_ACTION_STORAGE_KEY)).toBe(
      serializeAiAssistantLastActionPreference(preference),
    );
    expect(readStoredAiAssistantLastActionPreference()).toEqual(preference);
  });
});
