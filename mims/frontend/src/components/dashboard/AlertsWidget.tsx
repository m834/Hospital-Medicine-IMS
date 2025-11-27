'use client';

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  href?: string;
  actionLabel?: string;
  timestamp?: Date;
}

interface AlertsWidgetProps {
  alerts: Alert[];
  title?: string;
  maxItems?: number;
}

const alertStyles = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
    Icon: AlertCircle,
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-500',
    text: 'text-yellow-800',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
    Icon: Info,
  },
};

export default function AlertsWidget({ alerts, title = 'Alerts', maxItems = 5 }: AlertsWidgetProps) {
  const displayedAlerts = alerts.slice(0, maxItems);

  if (displayedAlerts.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Info className="mb-2 h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-500">No alerts at this time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {alerts.length > maxItems && (
          <span className="text-xs text-gray-500">
            Showing {maxItems} of {alerts.length}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {displayedAlerts.map((alert) => {
          const style = alertStyles[alert.type];
          const Icon = style.Icon;

          const content = (
            <div
              className={`${style.bg} ${style.border} rounded-lg border p-4 transition-all ${
                alert.href ? 'cursor-pointer hover:shadow-md' : ''
              }`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <Icon className={`h-5 w-5 ${style.icon}`} />
                </div>
                <div className="ml-3 flex-1">
                  <h4 className={`text-sm font-medium ${style.text}`}>{alert.title}</h4>
                  <p className="mt-1 text-xs text-gray-600">{alert.message}</p>
                  {alert.timestamp && (
                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );

          if (alert.href) {
            return (
              <Link key={alert.id} href={alert.href}>
                {content}
              </Link>
            );
          }

          return <div key={alert.id}>{content}</div>;
        })}
      </div>
    </div>
  );
}
