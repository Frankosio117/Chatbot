'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function EmbedClassManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && pathname.includes('/embed/')) {
      document.documentElement.classList.add('embed-page');
      document.documentElement.style.setProperty('background', 'transparent', 'important');
      document.documentElement.style.setProperty('background-color', 'transparent', 'important');
      document.body.style.setProperty('background', 'transparent', 'important');
      document.body.style.setProperty('background-color', 'transparent', 'important');
    } else {
      document.documentElement.classList.remove('embed-page');
      document.documentElement.style.background = '';
      document.documentElement.style.backgroundColor = '';
      document.body.style.background = '';
      document.body.style.backgroundColor = '';
    }
  }, [pathname]);

  return null;
}
