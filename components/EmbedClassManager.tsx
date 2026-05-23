'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function EmbedClassManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && pathname.includes('/embed/')) {
      document.documentElement.classList.add('embed-page');
    } else {
      document.documentElement.classList.remove('embed-page');
    }
  }, [pathname]);

  return null;
}
