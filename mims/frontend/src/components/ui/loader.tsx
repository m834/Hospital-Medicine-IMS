/**
 * Custom Loader Components
 * Reusable loading spinners for the entire application
 */

import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

/**
 * Spinner Loader
 * Rotating circle loader
 */
export function Spinner({ className, size = 'md' }: LoaderProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-4 border-gray-200 border-t-blue-600',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Dots Loader
 * Three bouncing dots
 */
export function DotsLoader({ className, size = 'md' }: LoaderProps) {
  const dotSize = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
    xl: 'h-5 w-5',
  };

  return (
    <div className={cn('flex items-center justify-center gap-2', className)} role="status" aria-label="Loading">
      <div className={cn('animate-bounce rounded-full bg-blue-600', dotSize[size])} style={{ animationDelay: '0ms' }} />
      <div className={cn('animate-bounce rounded-full bg-blue-600', dotSize[size])} style={{ animationDelay: '150ms' }} />
      <div className={cn('animate-bounce rounded-full bg-blue-600', dotSize[size])} style={{ animationDelay: '300ms' }} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Pulse Loader
 * Pulsing circle
 */
export function PulseLoader({ className, size = 'md' }: LoaderProps) {
  return (
    <div className={cn('flex items-center justify-center', className)} role="status" aria-label="Loading">
      <div className={cn('animate-pulse rounded-full bg-blue-600', sizeClasses[size])} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Full Page Loader
 * Centered loader that covers entire screen
 */
interface FullPageLoaderProps {
  message?: string;
  variant?: 'spinner' | 'dots' | 'pulse';
}

export function FullPageLoader({ message = 'Loading...', variant = 'spinner' }: FullPageLoaderProps) {
  const LoaderComponent = {
    spinner: Spinner,
    dots: DotsLoader,
    pulse: PulseLoader,
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <LoaderComponent size="lg" />
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}

/**
 * Inline Loader
 * Small loader for buttons and inline usage
 */
interface InlineLoaderProps {
  className?: string;
  text?: string;
}

export function InlineLoader({ className, text = 'Loading...' }: InlineLoaderProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size="sm" />
      <span className="text-sm text-gray-600">{text}</span>
    </div>
  );
}

/**
 * Card Loader
 * Loader for card components
 */
export function CardLoader({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8', className)}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size="md" />
        <p className="text-sm text-gray-500">Loading data...</p>
      </div>
    </div>
  );
}

/**
 * Default Loader Export
 * Use as <Loader /> for default spinner
 */
export default function Loader({ className, size = 'md', variant = 'spinner' }: LoaderProps) {
  const LoaderComponent = {
    spinner: Spinner,
    dots: DotsLoader,
    pulse: PulseLoader,
  }[variant];

  return <LoaderComponent className={className} size={size} />;
}
