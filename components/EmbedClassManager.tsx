'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function EmbedClassManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && pathname.includes('/embed/')) {
      document.documentElement.classList.add('embed-page');
      document.documentElement.style.setProperty('background-color', 'transparent', 'important');
      document.documentElement.style.setProperty('background-image', 'none', 'important');
      document.body.style.setProperty('background-color', 'transparent', 'important');
      document.body.style.setProperty('background-image', 'none', 'important');
    } else {
      document.documentElement.classList.remove('embed-page');
      document.documentElement.style.backgroundColor = '';
      document.documentElement.style.backgroundImage = '';
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = '';
    }
  }, [pathname]);

  return null;
}
