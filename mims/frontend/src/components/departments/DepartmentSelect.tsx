'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

interface Department {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface DepartmentSelectProps {
  hospitalId: string;
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DepartmentSelect({
  hospitalId,
  value,
  onChange,
  label = 'Department',
  placeholder = 'Select department',
  required = false,
  disabled = false,
}: DepartmentSelectProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hospitalId) {
      fetchDepartments();
    }
  }, [hospitalId]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/departments`, { params: { hospitalId } });
      const list: Department[] = data?.data || data || [];
      setDepartments(list.filter((d: Department) => d.status === 'ACTIVE'));
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name} ({dept.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
