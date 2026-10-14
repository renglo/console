import assert from "node:assert/strict";
import test from "node:test";

import { localeList, localeText } from "./locale-text.ts";

const fallback = {
  home: { new: "New" },
  onboarding: {
    start: { title: "Start here", kicker: "" },
    entity: { types: [] as string[] },
    review: { detail: "Entity: {name}" },
  },
};

test("missing key uses the generic fallback", () => {
  assert.equal(localeText({}, fallback, "home.new"), "New");
  assert.equal(localeText(undefined, fallback, "onboarding.start.title"), "Start here");
});

test("loaded locale replaces the fallback", () => {
  const locale = { home: { new: "Start a project" } };
  assert.equal(localeText(locale, fallback, "home.new"), "Start a project");
});

test("explicit empty string hides an optional line", () => {
  const locale = { onboarding: { start: { kicker: "" } } };
  assert.equal(localeText(locale, { onboarding: { start: { kicker: "Let's make something" } } }, "onboarding.start.kicker"), "");
});

test("placeholders are filled from the caller", () => {
  assert.equal(
    localeText({}, fallback, "onboarding.review.detail", { name: "North" }),
    "Entity: North",
  );
});

test("an explicit empty type list stays empty", () => {
  assert.deepEqual(localeList({ onboarding: { entity: { types: [] } } }, { onboarding: { entity: { types: ["Movie"] } } }, "onboarding.entity.types"), []);
});

test("a missing type list uses the fallback list", () => {
  assert.deepEqual(
    localeList({}, { onboarding: { entity: { types: ["Movie", "TV"] } } }, "onboarding.entity.types"),
    ["Movie", "TV"],
  );
});
