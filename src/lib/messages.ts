import { locales } from "@/lib/branding";

import { fallbackMessages } from "./fallback-messages";
import { localeList, localeText } from "./locale-text";

/** Caption from the loaded locale, or the generic fallback when that key is missing. */
export function caption(path: string, vars?: Record<string, string>): string {
  return localeText(locales?.en, fallbackMessages, path, vars);
}

/** String list from the loaded locale. An explicit empty list stays empty. */
export function captionList(path: string): string[] {
  return localeList(locales?.en, fallbackMessages, path);
}
