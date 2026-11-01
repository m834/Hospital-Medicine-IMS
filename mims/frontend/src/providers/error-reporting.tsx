'use client';

import { useEffect } from 'react';
import { installGlobalErrorReporting } from '@/lib/error-reporter';

/** Reports uncaught errors and unhandled rejections from every page. */
export function ErrorReporting() {
  useEffect(() => installGlobalErrorReporting(), []);
  return null;
}
