import assert from "node:assert/strict";
import test from "node:test";
import { trimOcrText } from "../src/shared/ocrText";

test("trimOcrText normalizes whitespace and preserves readable text", () => {
  assert.equal(trimOcrText("  hello   world\r\n\r\n\r\nnext  line  "), "hello world\n\nnext line");
});

test("trimOcrText bounds large OCR output", () => {
  const trimmed = trimOcrText("x".repeat(6000));
  assert.equal(trimmed.length, 5000);
  assert.equal(trimmed.endsWith("…"), true);
});
