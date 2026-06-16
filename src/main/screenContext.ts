import { desktopCapturer } from "electron";
import { createWorker } from "tesseract.js";
import { trimOcrText } from "../shared/ocrText.js";
import type { ScreenContextSnapshot } from "../shared/types";

const THUMBNAIL_WIDTH = 1440;
const THUMBNAIL_HEIGHT = 900;

export interface ScreenContextService {
  capture: () => Promise<ScreenContextSnapshot>;
  getLatest: () => ScreenContextSnapshot | null;
  isBusy: () => boolean;
  clear: () => void;
}

export function createScreenContextService(): ScreenContextService {
  let latest: ScreenContextSnapshot | null = null;
  let busy = false;

  return {
    capture: async () => {
      if (busy) {
        throw new Error("Screen context capture is already running.");
      }

      busy = true;
      const startedAt = Date.now();
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: {
            width: THUMBNAIL_WIDTH,
            height: THUMBNAIL_HEIGHT
          }
        });

        const source = sources[0];
        if (!source) {
          throw new Error("No screen source is available.");
        }

        const png = source.thumbnail.toPNG();
        const text = await recognizePng(png);
        latest = {
          text: trimOcrText(text),
          sourceName: source.name || "Screen",
          capturedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          warning: text.trim().length === 0 ? "No readable text was found in the screen capture." : undefined
        };
        return structuredClone(latest);
      } finally {
        busy = false;
      }
    },
    getLatest: () => (latest ? structuredClone(latest) : null),
    isBusy: () => busy,
    clear: () => {
      latest = null;
    }
  };
}

async function recognizePng(image: Buffer): Promise<string> {
  const worker = await createWorker("eng", 1, {
    logger: () => undefined
  });
  try {
    const result = await worker.recognize(image);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
