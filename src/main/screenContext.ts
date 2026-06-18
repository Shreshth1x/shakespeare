import { desktopCapturer } from "electron";
import { createWorker } from "tesseract.js";
import { trimOcrText } from "../shared/ocrText.js";
import type { ScreenContextSnapshot } from "../shared/types";

const THUMBNAIL_WIDTH = 1440;
const THUMBNAIL_HEIGHT = 900;

export interface ScreenFrame {
  png: Buffer;
  sourceName: string;
  capturedAt: string;
  startedAt: number;
}

export interface ScreenContextService {
  capture: () => Promise<ScreenContextSnapshot>;
  captureFrame: () => Promise<ScreenFrame>;
  ocrFrame: (frame: ScreenFrame) => Promise<ScreenContextSnapshot>;
  getLatest: () => ScreenContextSnapshot | null;
  isBusy: () => boolean;
  clear: () => void;
}

export function createScreenContextService(): ScreenContextService {
  let latest: ScreenContextSnapshot | null = null;
  let busy = false;

  // Cheap: grab the screen pixels without OCR. Used to preserve a terminal draft before the
  // selection probe (which sends Ctrl+C) runs, without paying the OCR cost on every rewrite.
  async function captureFrame(): Promise<ScreenFrame> {
    const startedAt = Date.now();
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

    return {
      png: source.thumbnail.toPNG(),
      sourceName: source.name || "Screen",
      capturedAt: new Date().toISOString(),
      startedAt
    };
  }

  // Expensive: OCR a previously captured frame. Only run when screen text is actually needed.
  async function ocrFrame(frame: ScreenFrame): Promise<ScreenContextSnapshot> {
    if (busy) {
      throw new Error("Screen context capture is already running.");
    }

    busy = true;
    try {
      const text = await recognizePng(frame.png);
      latest = {
        text: trimOcrText(text),
        sourceName: frame.sourceName,
        capturedAt: frame.capturedAt,
        latencyMs: Date.now() - frame.startedAt,
        warning: text.trim().length === 0 ? "No readable text was found in the screen capture." : undefined
      };
      return structuredClone(latest);
    } finally {
      busy = false;
    }
  }

  return {
    captureFrame,
    ocrFrame,
    capture: async () => {
      const frame = await captureFrame();
      return ocrFrame(frame);
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
