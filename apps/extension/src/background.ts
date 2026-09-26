import {
  edgeEverRequest,
  getInstanceOrigin,
  getSettings,
  listNotebooks,
  uploadMemoImage,
  type ExtensionSettings,
} from "./extension";
import {
  filenameForImage,
  imageFromBase64,
  imageFromBytes,
  imageHostName,
  imageOriginPattern,
  isPageImageRead,
  MAX_IMAGE_BYTES,
  noteTitleForImage,
  preferredImageUrls,
  saveCapturedImageNote,
  type ImageNoteClient,
  type PageImageRead,
  type StoredImage,
  type StoredImageFailure,
} from "./image-clip";
import { t } from "./i18n";

type CapturedPage = {
  title: string;
  url: string;
  markdown: string;
};

type PendingImageSave = {
  urls: string[];
  srcUrl: string;
  pageUrl: string;
  pageTitle: string;
  tabId: number | null;
  frameId: number | null;
  originPattern: string;
  host: string;
};

const IMAGE_MENU_ID = "save-image";
const PENDING_IMAGE_SAVE_KEY = "pendingImageSave";
const IMAGE_SAVE_WINDOW_KEY = "imageSaveWindowId";

const toMarkdown = (page: CapturedPage) => {
  const capturedAt = new Date().toISOString();
  return `# ${page.title.replace(/\n/g, " ")}\n\n${t("sourceLabel")}: [${page.url}](${page.url})\n\n${t("capturedAtLabel")}: ${capturedAt}\n\n---\n\n${page.markdown}`;
};

const compactError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 180);
};

const describeCaptureError = (error: unknown) => {
  const message = compactError(error);
  if (message === t("captureTimeout")) {
    return message;
  }
  if (/cannot access (contents|a page)|missing host permission|extensions gallery|chrome:\/\/|edge:\/\/|about:\/\//i.test(message)) {
    return t("pageAccessDenied");
  }
  return t("captureScriptFailed", message || t("captureUnknownError"));
};

const describeSaveError = (error: unknown) => {
  const message = compactError(error);
  if (/write:resources/i.test(message)) {
    return t("imageResourceScopeRequired");
  }
  if (/failed to fetch|networkerror|load failed|network request/i.test(message)) {
    return t("instanceNetworkFailed");
  }
  return t("saveFailedWithReason", message || t("saveFailed"));
};

const createMemo = async (settings: ExtensionSettings, page: CapturedPage) => {
  const notebooks = await listNotebooks(settings);
  const notebookId = settings.notebookId || notebooks.notebooks[0]?.id;
  if (!notebookId) {
    throw new Error(t("noAvailableNotebooks"));
  }

  await edgeEverRequest(settings, "/api/v1/memos", {
    method: "POST",
    body: JSON.stringify({
      notebookId,
      title: page.title,
      contentMarkdown: toMarkdown(page),
      tags: ["web-clip"],
    }),
  });
};

const imageNoteClient = (settings: ExtensionSettings): ImageNoteClient => ({
  listNotebooks: () => listNotebooks(settings),
  createMemo: (body) => edgeEverRequest(settings, "/api/v1/memos", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  uploadImage: async (memoId, file) => {
    const uploaded = await uploadMemoImage(settings, memoId, file);
    return uploaded.resource;
  },
  createEditSession: (memoId) => edgeEverRequest(
    settings,
    `/api/v1/memos/${encodeURIComponent(memoId)}/edit-sessions`,
    { method: "POST", body: JSON.stringify({}) },
  ),
  saveMemo: (memoId, body) => edgeEverRequest(
    settings,
    `/api/v1/memos/${encodeURIComponent(memoId)}/save`,
    { method: "POST", body: JSON.stringify(body) },
  ),
  deleteMemo: (memoId) => edgeEverRequest(
    settings,
    `/api/v1/memos/${encodeURIComponent(memoId)}?permanent=1`,
    { method: "DELETE" },
  ),
});

const scriptTarget = (tabId: number, frameId: number | null) =>
  typeof frameId === "number" ? { tabId, frameIds: [frameId] } : { tabId };

const injectImageHelper = async (tabId: number, frameId: number | null, payload: unknown) => {
  const target = scriptTarget(tabId, frameId);
  await chrome.scripting.executeScript({
    target,
    func: (value: unknown) => {
      (globalThis as { __edgeeverImageClipPayload?: unknown }).__edgeeverImageClipPayload = value;
    },
    args: [payload],
  });
  await chrome.scripting.executeScript({
    target,
    files: ["assets/capture-image.js"],
  });
};

const showFeedback = async (
  tabId: number | null,
  frameId: number | null,
  message: string,
  kind: "success" | "error",
) => {
  if (tabId) {
    try {
      await injectImageHelper(tabId, frameId, { action: "toast", message, kind });
      return;
    } catch {
      // Restricted pages cannot host the toast. The toolbar badge still reports the result.
    }
  }
  await chrome.action.setBadgeBackgroundColor({ color: kind === "error" ? "#b91c1c" : "#0f766e" });
  await chrome.action.setBadgeText({ text: kind === "error" ? "!" : "✓" });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: "" });
  }, 4000);
};

const imageFailureMessage = (reason: StoredImageFailure["error"]) => {
  if (reason === "too-large") return t("imageTooLarge");
  if (reason === "unsupported") return t("imageUnsupportedType");
  return t("imageUnreadable");
};

const describeImageError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (
    message === t("instancePermissionRequired")
    || message === t("completePluginConfiguration")
    || message === t("noAvailableNotebooks")
    || message === t("imageTooLarge")
    || message === t("imageUnsupportedType")
    || message === t("imageUnreadable")
  ) {
    return message;
  }
  return describeSaveError(error);
};

const ensureClipperReady = async () => {
  const settings = await getSettings();
  if (!settings.instanceUrl || !settings.token) {
    throw new Error(t("completePluginConfiguration"));
  }
  const granted = await chrome.permissions.contains({ origins: [`${getInstanceOrigin(settings.instanceUrl)}/*`] });
  if (!granted) throw new Error(t("instancePermissionRequired"));
  return settings;
};

const persistImage = async (
  settings: ExtensionSettings,
  image: StoredImage,
  context: { srcUrl: string; pageUrl: string; pageTitle: string; alt: string },
) => {
  try {
    await saveCapturedImageNote(imageNoteClient(settings), {
      notebookId: settings.notebookId,
      title: noteTitleForImage(context.pageTitle, context.alt, t("imageNoteFallbackTitle")),
      alt: context.alt,
      filename: filenameForImage(context.srcUrl, image.mimeType),
      mimeType: image.mimeType,
      bytes: image.bytes,
      pageUrl: context.pageUrl,
      capturedAt: new Date().toISOString(),
      sourceLabel: t("sourceLabel"),
      capturedAtLabel: t("capturedAtLabel"),
      altFallback: t("imageAltFallback"),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "no-notebook") {
      throw new Error(t("noAvailableNotebooks"));
    }
    throw error;
  }
};

const downloadImage = async (urls: string[]): Promise<StoredImage | StoredImageFailure> => {
  const matchUrl = urls[urls.length - 1] ?? "";
  let matchError: StoredImageFailure["error"] | "" = "";
  for (const url of urls) {
    if (!/^https?:/i.test(url)) continue;
    for (const credentials of ["omit", "include"] as const) {
      try {
        const response = await fetch(url, { credentials });
        if (!response.ok) continue;
        const declared = Number(response.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
          if (url === matchUrl) matchError = "too-large";
          continue;
        }
        const image = imageFromBytes(new Uint8Array(await response.arrayBuffer()), response.headers.get("content-type") ?? "");
        if (!("error" in image)) return image;
        if (url === matchUrl) matchError = image.error;
      } catch {
        if (url === matchUrl) matchError = matchError || "unreadable";
      }
    }
  }
  if (matchError === "too-large" || matchError === "unsupported") return { error: matchError };
  return { error: "unreadable" };
};

const hasImagePermission = async (urls: string[]) => {
  const patterns = [...new Set(urls.map(imageOriginPattern).filter((pattern): pattern is string => Boolean(pattern)))];
  for (const pattern of patterns) {
    if (await chrome.permissions.contains({ origins: [pattern] })) return true;
  }
  return false;
};

const isPendingImageSave = (value: unknown): value is PendingImageSave => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PendingImageSave>;
  return Array.isArray(record.urls)
    && record.urls.every((url) => typeof url === "string")
    && typeof record.srcUrl === "string"
    && typeof record.pageUrl === "string"
    && typeof record.pageTitle === "string"
    && typeof record.originPattern === "string"
    && typeof record.host === "string";
};

const readPendingImageSave = async () => {
  const stored = await chrome.storage.session.get(PENDING_IMAGE_SAVE_KEY);
  return isPendingImageSave(stored[PENDING_IMAGE_SAVE_KEY]) ? stored[PENDING_IMAGE_SAVE_KEY] : null;
};

const openImagePermissionWindow = async (pending: PendingImageSave) => {
  await chrome.storage.session.set({ [PENDING_IMAGE_SAVE_KEY]: pending });
  const stored = await chrome.storage.session.get(IMAGE_SAVE_WINDOW_KEY);
  const existingId = stored[IMAGE_SAVE_WINDOW_KEY];
  if (typeof existingId === "number") {
    try {
      const existing = await chrome.windows.get(existingId, { populate: true });
      const tabId = existing.tabs?.[0]?.id;
      if (tabId) {
        await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("image-save.html") });
        await chrome.windows.update(existingId, { focused: true });
        return;
      }
    } catch {
      // The previous permission window has already closed.
    }
  }
  const created = await chrome.windows.create({
    url: chrome.runtime.getURL("image-save.html"),
    type: "popup",
    width: 440,
    height: 640,
    focused: true,
  });
  if (created.id) await chrome.storage.session.set({ [IMAGE_SAVE_WINDOW_KEY]: created.id });
};

let pendingCapture: ((page: CapturedPage) => void) | null = null;
const pendingImageReads = new Map<string, (result: unknown) => void>();
let imageSaveQueue = Promise.resolve();
let completingImageSave = false;

const enqueueImageSave = (job: () => Promise<void>) => {
  const run = imageSaveQueue.then(job, job);
  imageSaveQueue = run.then(() => undefined, () => undefined);
  return run;
};

const readImageFromPage = async (tabId: number, frameId: number | null, urls: string[], matchUrl: string) => {
  const requestId = crypto.randomUUID();
  const result = await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingImageReads.delete(requestId);
      reject(new Error("timeout"));
    }, 20_000);
    pendingImageReads.set(requestId, (value) => {
      clearTimeout(timeout);
      resolve(value);
    });
    void injectImageHelper(tabId, frameId, {
      action: "read",
      requestId,
      urls,
      matchUrl,
      maxBytes: MAX_IMAGE_BYTES,
    }).catch((error: unknown) => {
      clearTimeout(timeout);
      pendingImageReads.delete(requestId);
      reject(error);
    });
  });
  return isPageImageRead(result) ? result : { ok: false as const, reason: "unreadable" as const };
};

const reportImageFailure = async (tabId: number | null, frameId: number | null, error: unknown) => {
  const message = describeImageError(error);
  if (message === t("completePluginConfiguration") || message === t("instancePermissionRequired")) {
    await chrome.runtime.openOptionsPage();
  }
  await showFeedback(tabId, frameId, message, "error");
};

const saveDownloadedImage = async (
  pending: Pick<PendingImageSave, "urls" | "srcUrl" | "pageUrl" | "pageTitle" | "tabId" | "frameId">,
  alt: string,
) => {
  const settings = await ensureClipperReady();
  const downloaded = await downloadImage(pending.urls);
  if ("error" in downloaded) throw new Error(imageFailureMessage(downloaded.error));
  await persistImage(settings, downloaded, {
    srcUrl: pending.srcUrl,
    pageUrl: pending.pageUrl,
    pageTitle: pending.pageTitle,
    alt,
  });
  await chrome.storage.session.remove(PENDING_IMAGE_SAVE_KEY);
  await showFeedback(pending.tabId, pending.frameId, t("imageSaved"), "success");
};

const saveImageFromMenu = async (
  info: { srcUrl?: string; pageUrl?: string; frameId?: number },
  tab?: { id?: number; url?: string; title?: string },
) => {
  const tabId = typeof tab?.id === "number" ? tab.id : null;
  const frameId = typeof info.frameId === "number" ? info.frameId : null;
  const srcUrl = info.srcUrl ?? "";
  const pageUrl = tab?.url || info.pageUrl || "";
  const pageTitle = tab?.title || "";
  try {
    await ensureClipperReady();
    if (!srcUrl) throw new Error(t("imageUnreadable"));
    await showFeedback(tabId, frameId, t("savingImage"), "success");
    const urls = preferredImageUrls(srcUrl);
    let pageRead: PageImageRead | null = null;
    if (tabId) {
      try {
        pageRead = await readImageFromPage(tabId, frameId, urls, srcUrl);
      } catch {
        pageRead = null;
      }
    }
    if (pageRead?.ok) {
      const image = imageFromBase64(pageRead.base64, pageRead.mimeType, pageRead.byteSize);
      if ("error" in image) throw new Error(imageFailureMessage(image.error));
      const settings = await ensureClipperReady();
      await persistImage(settings, image, { srcUrl, pageUrl, pageTitle, alt: pageRead.alt });
      await chrome.storage.session.remove(PENDING_IMAGE_SAVE_KEY);
      await showFeedback(tabId, frameId, t("imageSaved"), "success");
      return;
    }
    if (pageRead && !pageRead.ok && (pageRead.reason === "too-large" || pageRead.reason === "unsupported")) {
      throw new Error(imageFailureMessage(pageRead.reason));
    }
    if (await hasImagePermission(urls)) {
      await saveDownloadedImage({ urls, srcUrl, pageUrl, pageTitle, tabId, frameId }, "");
      return;
    }
    const originPattern = imageOriginPattern(srcUrl);
    const host = imageHostName(srcUrl);
    if (!originPattern || !host) throw new Error(t("imageUnreadable"));
    await openImagePermissionWindow({
      urls,
      srcUrl,
      pageUrl,
      pageTitle,
      tabId,
      frameId,
      originPattern,
      host,
    });
    await showFeedback(tabId, frameId, t("imagePermissionToast"), "success");
  } catch (error) {
    await reportImageFailure(tabId, frameId, error);
  }
};

const registerImageMenu = () => {
  chrome.contextMenus.create({
    id: IMAGE_MENU_ID,
    title: t("saveImageToEdgeEver"),
    contexts: ["image"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  }, () => {
    void chrome.runtime.lastError;
  });
};

chrome.runtime.onInstalled.addListener(registerImageMenu);
registerImageMenu();

chrome.contextMenus.onClicked.addListener((info: { menuItemId?: string | number; srcUrl?: string; pageUrl?: string; frameId?: number }, tab?: { id?: number; url?: string; title?: string }) => {
  if (info.menuItemId !== IMAGE_MENU_ID) return;
  void enqueueImageSave(() => saveImageFromMenu(info, tab));
});

chrome.windows.onRemoved.addListener((windowId: number) => {
  void chrome.storage.session.get(IMAGE_SAVE_WINDOW_KEY).then((stored: Record<string, unknown>) => {
    if (stored[IMAGE_SAVE_WINDOW_KEY] === windowId) {
      void chrome.storage.session.remove(IMAGE_SAVE_WINDOW_KEY);
    }
  }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: { type?: string; page?: CapturedPage; requestId?: string; result?: unknown }, _sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === "capturedPage" && message.page) {
    pendingCapture?.(message.page);
    pendingCapture = null;
    return false;
  }

  if (message.type === "pageImageRead" && message.requestId) {
    pendingImageReads.get(message.requestId)?.(message.result);
    pendingImageReads.delete(message.requestId);
    return false;
  }

  if (message.type === "getPendingImageSave") {
    void readPendingImageSave().then((pending) => {
      sendResponse(pending ? { originPattern: pending.originPattern, host: pending.host } : null);
    }, () => sendResponse(null));
    return true;
  }

  if (message.type === "completePendingImageSave") {
    if (completingImageSave) {
      sendResponse({ ok: false, message: t("savingImage") });
      return false;
    }
    completingImageSave = true;
    void (async () => {
      const pending = await readPendingImageSave();
      if (!pending) {
        sendResponse({ ok: false, message: t("imageSaveExpired") });
        return;
      }
      try {
        await showFeedback(pending.tabId, pending.frameId, t("savingImage"), "success");
        await saveDownloadedImage(pending, "");
        sendResponse({ ok: true });
      } catch (error) {
        const message = describeImageError(error);
        await showFeedback(pending.tabId, pending.frameId, message, "error");
        sendResponse({ ok: false, message });
      }
    })().catch((error: unknown) => {
      sendResponse({ ok: false, message: describeImageError(error) });
    }).finally(() => {
      completingImageSave = false;
    });
    return true;
  }

  if (message.type === "testConnection") {
    void (async () => {
      try {
        const settings = await getSettings();
        const notebooks = await listNotebooks(settings);
        sendResponse({ ok: true, notebooks: notebooks.notebooks });
      } catch (error) {
        sendResponse({ ok: false, message: error instanceof Error ? error.message : t("connectionFailed") });
      }
    })();
    return true;
  }

  if (message.type === "captureCurrentPage") {
    void (async () => {
      try {
        const settings = await getSettings();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          throw new Error(t("currentPageNotFound"));
        }

        const page = await new Promise<CapturedPage>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingCapture = null;
            reject(new Error(t("captureTimeout")));
          }, 15_000);

          pendingCapture = (capturedPage) => {
            clearTimeout(timeout);
            resolve(capturedPage);
          };

          void chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["assets/capture.js"],
          }).catch((error: unknown) => {
            clearTimeout(timeout);
            pendingCapture = null;
            reject(new Error(describeCaptureError(error)));
          });
        });
        await createMemo(settings, page);
        sendResponse({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        sendResponse({
          ok: false,
          message: message === t("captureTimeout") || message.startsWith(t("captureScriptFailed", ""))
            ? describeCaptureError(error)
            : describeSaveError(error),
        });
      }
    })();
    return true;
  }

  return false;
});
