'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Trash2, Edit2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface FeatureFlag {
  id: string;
  hospitalId: string | null;
  key: string;
  enabled: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    key: '',
    enabled: false,
    description: '',
    hospitalId: '',
  });

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await api.get('/feature-flags');
      setFlags(response.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch feature flags',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/feature-flags', {
        key: formData.key,
        enabled: formData.enabled,
        description: formData.description || null,
        hospitalId: formData.hospitalId || null,
      });

      toast({
        title: 'Success',
        description: 'Feature flag created successfully',
      });

      setShowCreateDialog(false);
      setFormData({ key: '', enabled: false, description: '', hospitalId: '' });
      fetchFlags();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create feature flag',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await api.patch(`/feature-flags/${flag.id}`, {
        enabled: !flag.enabled,
      });

      toast({
        title: 'Success',
        description: `Feature flag ${flag.enabled ? 'disabled' : 'enabled'}`,
      });

      fetchFlags();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update feature flag',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) {
      return;
    }

    try {
      await api.delete(`/feature-flags/${id}`);

      toast({
        title: 'Success',
        description: 'Feature flag deleted successfully',
      });

      fetchFlags();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete feature flag',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading feature flags...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground mt-1">
            Manage feature rollout across hospitals
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchFlags}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Flag
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No feature flags found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono font-medium">{flag.key}</TableCell>
                  <TableCell>{flag.description || '—'}</TableCell>
                  <TableCell>
                    {flag.hospitalId ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Hospital
                      </span>
                    ) : (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        Global
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={() => handleToggle(flag)}
                      />
                      <span className={flag.enabled ? 'text-green-600' : 'text-gray-400'}>
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(flag.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(flag.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
            <DialogDescription>
              Add a new feature flag to control feature rollout.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key">Flag Key *</Label>
              <Input
                id="key"
                placeholder="e.g., clinical_module, billing_enabled"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this feature"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hospitalId">Hospital ID (optional)</Label>
              <Input
                id="hospitalId"
                placeholder="Leave empty for global flag"
                value={formData.hospitalId}
                onChange={(e) =>
                  setFormData({ ...formData, hospitalId: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to create a global flag (applies to all hospitals)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
              <Label htmlFor="enabled">Enable immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.key}>
              Create Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
