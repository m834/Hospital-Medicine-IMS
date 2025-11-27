'use client';

import { Clock } from 'lucide-react';
import Link from 'next/link';

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  user?: string;
  type?: 'success' | 'info' | 'warning';
  href?: string;
}

interface RecentActivityWidgetProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
}

const typeColors = {
  success: 'bg-green-100 text-green-600',
  info: 'bg-blue-100 text-blue-600',
  warning: 'bg-yellow-100 text-yellow-600',
};

export default function RecentActivityWidget({
  activities,
  title = 'Recent Activity',
  maxItems = 10,
}: RecentActivityWidgetProps) {
  const displayedActivities = activities.slice(0, maxItems);

  if (displayedActivities.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="mb-2 h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-500">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {activities.length > maxItems && (
          <span className="text-xs text-gray-500">
            Showing {maxItems} of {activities.length}
          </span>
        )}
      </div>
      <div className="flow-root">
        <ul className="-mb-8">
          {displayedActivities.map((activity, index) => {
            const isLast = index === displayedActivities.length - 1;
            const typeColor = activity.type ? typeColors[activity.type] : 'bg-gray-100 text-gray-600';

            const content = (
              <li>
                <div className="relative pb-8">
                  {!isLast && (
                    <span
                      className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${typeColor}`}
                      >
                        <Clock className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{activity.description}</p>
                        {activity.user && (
                          <p className="mt-0.5 text-xs text-gray-400">by {activity.user}</p>
                        )}
                      </div>
                      <div className="whitespace-nowrap text-right text-xs text-gray-400">
                        <time dateTime={activity.timestamp.toISOString()}>
                          {formatTimestamp(activity.timestamp)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );

            if (activity.href) {
              return (
                <Link key={activity.id} href={activity.href} className="block hover:bg-gray-50">
                  {content}
                </Link>
              );
            }

            return <div key={activity.id}>{content}</div>;
          })}
        </ul>
      </div>
    </div>
  );
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return date.toLocaleDateString();
}
