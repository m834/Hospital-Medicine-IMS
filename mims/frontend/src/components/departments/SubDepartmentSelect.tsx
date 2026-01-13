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

interface SubDepartment {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface SubDepartmentSelectProps {
  departmentId?: string;
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SubDepartmentSelect({
  departmentId,
  value,
  onChange,
  label = 'Sub-Department',
  placeholder = 'Select sub-department',
  required = false,
  disabled = false,
}: SubDepartmentSelectProps) {
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (departmentId) {
      fetchSubDepartments();
    } else {
      setSubDepartments([]);
      if (value) {
        onChange('');
      }
    }
  }, [departmentId]);

  const fetchSubDepartments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('mims_access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/sub-departments?departmentId=${departmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSubDepartments(data.filter((sd: SubDepartment) => sd.status === 'ACTIVE'));
      }
    } catch (error) {
      console.error('Failed to fetch sub-departments:', error);
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
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || loading || !departmentId}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              !departmentId
                ? 'Select department first'
                : loading
                ? 'Loading...'
                : placeholder
            }
          />
        </SelectTrigger>
        <SelectContent>
          {subDepartments.map((subDept) => (
            <SelectItem key={subDept.id} value={subDept.id}>
              {subDept.name} ({subDept.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
