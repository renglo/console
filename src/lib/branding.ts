import {
  background,
  captions,
  largeLogo,
  locales,
  smallLogo,
} from "@wl";

export { captions, locales };

/** Subject line shown in the invite email, for the /invite form hint. */
export function inviteEmailSubjectHint(): string {
  const invite = locales.en.email?.invite;
  const template = invite?.subjectHint || invite?.subject || "";
  return template
    .replaceAll("{appName}", locales.en.appName || "this system")
    .replaceAll("{team}", "a team");
}

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
