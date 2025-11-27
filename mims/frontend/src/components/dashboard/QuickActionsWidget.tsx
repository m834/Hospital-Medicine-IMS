'use client';

import { QuickAction } from '@/lib/rbac-config';
import Link from 'next/link';

interface QuickActionsWidgetProps {
  actions: QuickAction[];
  title?: string;
}

export default function QuickActionsWidget({
  actions,
  title = 'Quick Actions',
}: QuickActionsWidgetProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-start rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-500 hover:bg-blue-50 hover:shadow-md"
            >
              <div className="flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  {action.label}
                </p>
                <p className="mt-1 text-xs text-gray-500">{action.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
