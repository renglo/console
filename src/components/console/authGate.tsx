import { useEffect, type ReactNode } from 'react';

import { signIn, usesHostedDirectory } from './authClient';

/** Account pages that Cognito renders itself. A hosted directory sends the browser to sign-in. */
export function HostedAccountGate({ children }: { children: ReactNode }) {
  const hosted = usesHostedDirectory();
  useEffect(() => {
    if (hosted) {
      void signIn();
    }
  }, [hosted]);
  if (hosted) {
    return null;
  }
  return children;
}
