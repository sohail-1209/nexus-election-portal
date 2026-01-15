
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  // This layout is simplified to just pass children through, removing padding.
  return <>{children}</>;
}
