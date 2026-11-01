import assert from "node:assert/strict";
import test from "node:test";

import { coverCropSourceRect, THUMBNAIL_EDGE } from "./image-upload.ts";

test("a wide photo is center-cropped to a square", () => {
  const crop = coverCropSourceRect(1000, 500);
  assert.equal(crop.sw, 500);
  assert.equal(crop.sh, 500);
  assert.equal(crop.sx, 250);
  assert.equal(crop.sy, 0);
});

test("a tall photo is center-cropped to a square", () => {
  const crop = coverCropSourceRect(400, 800);
  assert.equal(crop.sw, 400);
  assert.equal(crop.sh, 400);
  assert.equal(crop.sx, 0);
  assert.equal(crop.sy, 200);
});

test("a smaller image is scaled up to the thumbnail edge", () => {
  const crop = coverCropSourceRect(100, 100);
  assert.equal(crop.sx, 0);
  assert.equal(crop.sy, 0);
  assert.equal(crop.sw, 100);
  assert.equal(crop.sh, 100);
  assert.equal(THUMBNAIL_EDGE, 500);
});
