/**
 * Super Admin Dashboard - ClickUp Professional Style
 * System-wide overview and hospital management
 * Context-aware: Shows hospital-specific data when a hospital is selected
 */

'use client';

import { useState, useCallback } from 'react';
import { Hospital, Users, Building2, Activity, Plus, UserPlus, BarChart3, Filter, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { cn } from '@/lib/utils';
import { CreateHospitalModal } from '@/components/modals/create-hospital-modal';
import api from '@/lib/api';

export default function SuperAdminDashboard() {
  const { user } = useAuthStore();
  const { selectedHospital, setHospitals } = useHospitalStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Refresh hospitals list
  const refreshHospitals = useCallback(async () => {
    try {
      const response = await api.get('/hospitals');
      setHospitals(response.data || []);
    } catch (error) {
      console.error('[SuperAdmin] Failed to refresh hospitals:', error);
    }
  }, [setHospitals]);

  // Stats change based on selected hospital
  const stats = selectedHospital
    ? [
        {
          label: 'Hospital Pharmacies',
          value: '3',
          icon: Building2,
          bgColor: 'bg-[hsl(var(--teal-light))]',
          iconColor: 'text-[hsl(var(--teal))]',
          trend: '+0%',
        },
        {
          label: 'Hospital Users',
          value: '12',
          icon: Users,
          bgColor: 'bg-[hsl(var(--pink-light))]',
          iconColor: 'text-[hsl(var(--pink))]',
          trend: '+2 this month',
        },
        {
          label: 'Total Patients',
          value: '145',
          icon: Users,
          bgColor: 'bg-[hsl(var(--navy-light))]',
          iconColor: 'text-[hsl(var(--navy))]',
          trend: '+23 today',
        },
        {
          label: 'Stock Status',
          value: 'Good',
          icon: Activity,
          bgColor: 'bg-primary/10',
          iconColor: 'text-primary',
          trend: '98% filled',
        },
      ]
    : [
        {
          label: 'Total Hospitals',
          value: '2',
          icon: Hospital,
          bgColor: 'bg-[hsl(var(--teal-light))]',
          iconColor: 'text-[hsl(var(--teal))]',
          trend: '+0%',
        },
        {
          label: 'Total Users',
          value: '3',
          icon: Users,
          bgColor: 'bg-[hsl(var(--pink-light))]',
          iconColor: 'text-[hsl(var(--pink))]',
          trend: '+0%',
        },
        {
          label: 'Active Pharmacies',
          value: '6',
          icon: Building2,
          bgColor: 'bg-[hsl(var(--navy-light))]',
          iconColor: 'text-[hsl(var(--navy))]',
          trend: '+0%',
        },
        {
          label: 'System Status',
          value: 'Online',
          icon: Activity,
          bgColor: 'bg-primary/10',
          iconColor: 'text-primary',
          trend: '100%',
        },
      ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedHospital ? selectedHospital.name : 'Super Admin Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedHospital ? (
              <>
                <span className="font-medium text-primary">{selectedHospital.code}</span> - Hospital-specific view
              </>
            ) : (
              <>Welcome back, {user?.fullName}! Manage all hospitals and system-wide operations.</>
            )}
          </p>
        </div>
        {selectedHospital ? (
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent">
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow">
              <Plus className="h-4 w-4" />
              Add User
            </button>
          </div>
        ) : (
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow">
            <Plus className="h-4 w-4" />
            New Hospital
          </button>
        )}
      </div>

      {/* Stats Grid - ClickUp Style */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-primary">{stat.trend}</span> {selectedHospital ? 'for this hospital' : 'from last month'}
                  </p>
                </div>
                <div className={cn('rounded-lg p-2.5', stat.bgColor)}>
                  <Icon className={cn('h-5 w-5', stat.iconColor)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Indicator - Shows when hospital is selected */}
      {selectedHospital && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <AlertCircle className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Viewing Hospital-Specific Data
            </p>
            <p className="text-xs text-muted-foreground">
              All data below is filtered for <span className="font-medium text-primary">{selectedHospital.name}</span>. 
              Use the dropdown in the header to switch context.
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-primary hover:shadow-sm"
          >
            <div className="rounded-lg bg-primary/10 p-2">
              <Hospital className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Create Hospital</p>
              <p className="text-xs text-muted-foreground">Add new hospital</p>
            </div>
          </button>

          <button className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-secondary hover:shadow-sm">
            <div className="rounded-lg bg-secondary/10 p-2">
              <UserPlus className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Assign Admin</p>
              <p className="text-xs text-muted-foreground">Hospital Admin role</p>
            </div>
          </button>

          <button className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-all hover:border-accent hover:shadow-sm">
            <div className="rounded-lg bg-accent/10 p-2">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">View Reports</p>
              <p className="text-xs text-muted-foreground">System analytics</p>
            </div>
          </button>
        </div>
      </div>

      {/* Hospitals List - Only show when viewing all hospitals */}
      {!selectedHospital && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Hospitals</h2>
              <span className="text-xs text-muted-foreground">2 hospitals</span>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {[
                { name: 'City General Hospital', code: 'CGH001', status: 'Active', pharmacies: 3 },
                { name: 'District Medical Center', code: 'DMC002', status: 'Active', pharmacies: 3 },
              ].map((hospital) => (
                <div
                  key={hospital.code}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Hospital className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{hospital.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {hospital.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-medium text-muted-foreground">{hospital.pharmacies} Pharmacies</p>
                      <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {hospital.status}
                      </span>
                    </div>
                    <button className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary">
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hospital-Specific Content - Only show when hospital is selected */}
      {selectedHospital && (
        <div className="space-y-6">
          {/* Pharmacies Section */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Pharmacies</h2>
                <span className="text-xs text-muted-foreground">3 pharmacies</span>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[
                  { name: 'Main Pharmacy', type: 'Main', status: 'Active', stock: '1,245 items' },
                  { name: 'Emergency Pharmacy', type: 'Sub', status: 'Active', stock: '567 items' },
                  { name: 'OPD Pharmacy', type: 'Sub', status: 'Active', stock: '892 items' },
                ].map((pharmacy, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-all hover:border-secondary hover:shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                        <Building2 className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{pharmacy.name}</p>
                        <p className="text-xs text-muted-foreground">Type: {pharmacy.type} Pharmacy</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-medium text-muted-foreground">{pharmacy.stock}</p>
                        <span className="mt-1 inline-block rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-secondary">
                          {pharmacy.status}
                        </span>
                      </div>
                      <button className="rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-secondary hover:text-secondary-foreground hover:border-secondary">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Users Section */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Recent Users</h2>
                <button className="text-xs font-medium text-primary hover:underline">View All</button>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {[
                  { name: 'Dr. Sarah Johnson', role: 'DOCTOR', status: 'Online' },
                  { name: 'John Smith', role: 'PHARMACY_STAFF', status: 'Offline' },
                  { name: 'Emma Wilson', role: 'REGISTRATION_STAFF', status: 'Online' },
                ].map((user, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-background p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.role.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      user.status === 'Online' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {user.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Hospital Modal */}
      <CreateHospitalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // Refresh hospitals list
          refreshHospitals();
          console.log('[SuperAdmin] Hospital created successfully');
        }}
      />
    </div>
  );
}
