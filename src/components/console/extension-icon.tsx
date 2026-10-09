import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { extensionIconSrc } from "@/lib/extension-ui";

type ExtensionIconProps = {
  handle?: string;
  /** Also tried as a catalog handle, for rows keyed by id. */
  id?: string;
  /** Shown as initials when the extension has no icon.svg. */
  name?: string;
  /** xs: home shortcut, sm: breadcrumb, md: legacy home, lg: onboarding card. */
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  xs: "size-4 text-[8px]",
  sm: "size-5 text-[9px]",
  md: "size-8 text-xs",
  lg: "size-[68px] text-xl",
} as const;

function mark(label: string): string {
  const source = label.trim();
  if (!source) return "";
  const words = source.split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return source.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
}

/** Brand badge from ui/icon.svg, or a quiet initials disc when that file is absent. */
export default function ExtensionIcon({
  handle,
  id,
  name,
  size = "md",
  className,
}: ExtensionIconProps) {
  const src = extensionIconSrc(handle, id);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const frame = cn("shrink-0 rounded-full", SIZE_CLASS[size], className);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className={cn(frame, "object-cover")}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        frame,
        "inline-flex items-center justify-center bg-muted font-medium leading-none text-muted-foreground",
      )}
    >
      {mark(name || handle || id || "")}
    </span>
  );
}
