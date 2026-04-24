'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, User, Calendar, Package } from 'lucide-react';

interface DetailedIssueItem {
  medicineId: string;
  medicineName: string;
  genericName: string | null;
  form: string;
  strength: string | null;
  batchId: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface DetailedIssue {
  issueId: string;
  issueDate: string;
  nrNumber: string;
  patientName: string;
  age: number | null;
  gender: string;
  visitType: string;
  issuedBy: string;
  totalItems: number;
  totalAmount: number;
  items: DetailedIssueItem[];
}

interface DetailedIssuanceTableProps {
  data: DetailedIssue[];
}

export function DetailedIssuanceTable({ data }: DetailedIssuanceTableProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const toggleIssue = (issueId: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedIssues(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return `PKR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getGenderBadgeColor = (gender: string) => {
    return gender === 'MALE' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800';
  };

  const getVisitTypeBadgeColor = (visitType: string) => {
    const colors: { [key: string]: string } = {
      OPD: 'bg-green-100 text-green-800',
      IPD: 'bg-orange-100 text-orange-800',
      EMERGENCY: 'bg-red-100 text-red-800',
    };
    return colors[visitType] || 'bg-gray-100 text-gray-800';
  };

  const totalIssues = data.length;
  const totalQuantity = data.reduce((sum, issue) => sum + issue.totalItems, 0);
  const totalValue = data.reduce((sum, issue) => sum + issue.totalAmount, 0);
  const uniquePatients = new Set(data.map((issue) => issue.nrNumber)).size;

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-1">Detailed Issuances</h3>
        <p className="text-gray-500">No issuances recorded</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-orange-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Detailed Issuances</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Total Issues:</span>
              <span className="ml-2 font-semibold">{totalIssues}</span>
            </div>
            <div>
              <span className="text-gray-600">Unique Patients:</span>
              <span className="ml-2 font-semibold">{uniquePatients}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Items:</span>
              <span className="ml-2 font-semibold">{totalQuantity}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Value:</span>
              <span className="ml-2 font-semibold">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Issue Date/Time</TableHead>
            <TableHead>MRN</TableHead>
            <TableHead>Patient Details</TableHead>
            <TableHead>Visit Type</TableHead>
            <TableHead>Issued By</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((issue) => (
            <React.Fragment key={issue.issueId}>
              {/* Issue Row */}
              <TableRow
                key={issue.issueId}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleIssue(issue.issueId)}
              >
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {expandedIssues.has(issue.issueId) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium">{formatDate(issue.issueDate)}</p>
                      <p className="text-xs text-gray-500">{formatTime(issue.issueDate)}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{issue.nrNumber}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium">{issue.patientName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {issue.age !== null && (
                          <span className="text-xs text-gray-500">{issue.age} years</span>
                        )}
                        <Badge variant="outline" className={getGenderBadgeColor(issue.gender)}>
                          {issue.gender}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getVisitTypeBadgeColor(issue.visitType)}>
                    {issue.visitType}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{issue.issuedBy}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{issue.totalItems}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(issue.totalAmount)}
                </TableCell>
              </TableRow>

              {/* Issue Items (Expanded) */}
              {expandedIssues.has(issue.issueId) && (
                <TableRow>
                  <TableCell colSpan={8} className="bg-gray-50 p-0">
                    <div className="p-4">
                      <h4 className="text-sm font-semibold mb-3 text-gray-700">
                        Issued Medicines ({issue.totalItems} items)
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Medicine</TableHead>
                            <TableHead>Form</TableHead>
                            <TableHead>Strength</TableHead>
                            <TableHead>Batch No</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total Price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {issue.items.map((item, index) => (
                            <TableRow key={`${item.medicineId}-${item.batchId}-${index}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.medicineName}</p>
                                  {item.genericName && (
                                    <p className="text-xs text-gray-500">{item.genericName}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.form}</Badge>
                              </TableCell>
                              <TableCell>{item.strength || '-'}</TableCell>
                              <TableCell className="font-mono text-sm">{item.batchNo}</TableCell>
                              <TableCell>{formatDate(item.expiryDate)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {item.quantity.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.unitPrice)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(item.totalPrice)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
