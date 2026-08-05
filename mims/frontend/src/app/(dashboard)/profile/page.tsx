'use client';

/**
 * My Profile
 * Shows the signed-in user's own account details and lets them change their
 * own password (current password required — this is not the admin reset).
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import api from '@/lib/api';
import { format } from 'date-fns';

interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  status: string;
  lastLogin?: string | null;
  createdAt?: string | null;
  hospital?: { id: string; name: string; code: string } | null;
  pharmacy?: { id: string; name: string; code: string; type: string } | null;
}

// Same presentation the header uses for role names
const formatRoleName = (role: string) =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

// Mirrors the policy the backend enforces on change-password
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        PASSWORD_PATTERN,
        'Password must contain uppercase, lowercase, number, and special character',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current one',
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/profile');
      setProfile(res.data ?? null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PasswordFormData) => {
    setSaving(true);
    setSuccess(false);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      reset();
      setShowCurrent(false);
      setShowNew(false);
      setSuccess(true);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to change password';
      // A wrong current password is the common case — point at that field
      setError(
        /current password/i.test(String(message)) ? 'currentPassword' : 'root',
        { type: 'manual', message: String(message) },
      );
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value?: string | null) =>
    value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : '—';

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details and password
        </p>
      </div>

      {/* Account details */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Contact an administrator to change your name, role or assignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!profile ? (
            <p className="text-sm text-muted-foreground">
              Could not load your profile. Please refresh the page.
            </p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Full Name" value={profile.fullName} />
              <Detail label="Email" value={profile.email} />
              <Detail label="Phone" value={profile.phone || '—'} />
              <Detail label="Role" value={formatRoleName(profile.role)} />
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge variant={profile.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {profile.status}
                  </Badge>
                </dd>
              </div>
              <Detail
                label="Hospital"
                value={
                  profile.hospital
                    ? `${profile.hospital.name} (${profile.hospital.code})`
                    : '—'
                }
              />
              <Detail
                label="Pharmacy"
                value={
                  profile.pharmacy
                    ? `${profile.pharmacy.name} (${profile.pharmacy.code}) · ${profile.pharmacy.type}`
                    : '—'
                }
              />
              <Detail label="Last Login" value={formatDate(profile.lastLogin)} />
              <Detail label="Account Created" value={formatDate(profile.createdAt)} />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Enter your current password, then choose a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle className="h-4 w-4" />
              Password changed successfully.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  {...register('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                  {...register('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
              </p>
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type={showNew ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{errors.root.message}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
