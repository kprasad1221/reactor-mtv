import test from "node:test";
import assert from "node:assert/strict";
import { STYLES, promptFor } from "../dist/src/styles.js";
test("every directing selection maps to a distinct image-guided audiovisual prompt", () => {
  assert.equal(new Set(STYLES.map((s) => s.id)).size, 6);
  const prompts = STYLES.map((s) => promptFor(s.id));
  assert.equal(new Set(prompts).size, 6);
  for (const prompt of prompts) {
    assert.match(prompt, /^MUSIC DIRECTION\n/);
    assert.match(prompt, /\nVIDEO DIRECTION\n/);
    assert.match(prompt, /<Picture 1>/);
    assert.doesNotMatch(prompt, /Deep Ocean|Pixel Rhythms/);
  }
});
