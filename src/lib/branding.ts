import {
  background,
  captions,
  largeLogo,
  locales,
  smallLogo,
} from "@wl";

export { captions, locales };

/** Header / menu logo. */
export function wlLogoUrl(): string {
  return smallLogo;
}

/** Login hero logo. */
export function wlLoginLogoUrl(): string {
  return largeLogo;
}

/** Login page background image. */
export function wlBackgroundUrl(): string {
  return background;
}
