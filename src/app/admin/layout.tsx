
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Add padding to create space around the content on admin pages.
  return <div className="p-4 sm:p-6 md:p-8">{children}</div>;
}

    