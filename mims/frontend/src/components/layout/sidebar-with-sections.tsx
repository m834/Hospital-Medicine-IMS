'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/lib/constants';
import { getSidebarSectionsForRole } from '@/lib/rbac-config';
import { HeartPulse, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SidebarProps {
  userRole: UserRole;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function SidebarWithSections({ userRole, isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const sections = getSidebarSectionsForRole(userRole);
  
  // Track which sections are expanded (all by default)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    sections.reduce((acc, section) => ({ ...acc, [section.title]: true }), {})
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r border-border bg-[hsl(var(--sidebar-bg))] transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Toggle Button - Positioned outside sidebar */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-muted))] shadow-md transition-all hover:bg-primary hover:text-primary-foreground"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {/* Logo Header */}
      <div className="flex h-16 items-center justify-center border-b border-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <HeartPulse className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[hsl(var(--sidebar-fg))]">M-IMS</span>
              <span className="text-[10px] text-[hsl(var(--sidebar-muted))]">Medicine System</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, sectionIndex) => {
          const isExpanded = expandedSections[section.title];

          return (
            <div key={section.title} className={cn(sectionIndex > 0 && 'mt-6')}>
              {/* Section Header */}
              {!isCollapsed && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="mb-2 flex w-full items-center justify-between px-3 py-1 text-[10px] font-bold tracking-wider text-[hsl(var(--sidebar-muted))] transition-colors hover:text-[hsl(var(--sidebar-fg))]"
                >
                  <span>{section.title}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}

              {/* Section Items */}
              {(isCollapsed || isExpanded) && (
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href || pathname.startsWith(item.href + '/');

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-primary',
                          isCollapsed && 'justify-center'
                        )}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 flex-shrink-0',
                            isActive
                              ? ''
                              : 'text-[hsl(var(--sidebar-muted))] group-hover:text-primary'
                          )}
                        />
                        {!isCollapsed && (
                          <span className="flex-1">{item.label}</span>
                        )}
                        {!isCollapsed && item.badge && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Section Divider */}
              {!isCollapsed && sectionIndex < sections.length - 1 && (
                <div className="mt-3 border-b border-border/50" />
              )}
            </div>
          );
        })}
      </nav>

      {/* User Info Footer */}
      {!isCollapsed && (
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-semibold text-primary">
                {userRole.charAt(0)}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-[hsl(var(--sidebar-fg))]">
                {userRole.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-[hsl(var(--sidebar-muted))]">Active</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
