import { NavLink } from 'react-router-dom';

import ExtensionIcon from '@/components/console/extension-icon';

import type { HomeExtension } from './types';

type ExtensionShortcutProps = {
  portfolioId: string;
  orgId: string;
  extension: HomeExtension;
};

/** Fixed width so icon spacing does not depend on the extension name length. */
const SHORTCUT_WIDTH_CLASS = 'w-10';

export default function ExtensionShortcut({
  portfolioId,
  orgId,
  extension,
}: ExtensionShortcutProps) {
  return (
    <NavLink
      to={`/${portfolioId}/${orgId}/${extension.id}`}
      title={`Open ${extension.name}`}
      className={`group/app ${SHORTCUT_WIDTH_CLASS} flex shrink-0 flex-col items-center gap-0.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground`}
    >
      <span className="transition duration-200 group-hover/app:-translate-y-0.5 group-focus-visible/app:-translate-y-0.5">
        <span className="block opacity-45 grayscale transition duration-200 group-hover/app:opacity-100 group-hover/app:grayscale-0 group-focus-visible/app:opacity-100 group-focus-visible/app:grayscale-0">
          <ExtensionIcon
            handle={extension.handle}
            id={extension.id}
            name={extension.name}
            size="xs"
          />
        </span>
      </span>
      <span className="w-full min-w-0 truncate text-center opacity-0 transition-opacity group-hover/app:opacity-100 group-focus-visible/app:opacity-100">
        {extension.name}
      </span>
    </NavLink>
  );
}
