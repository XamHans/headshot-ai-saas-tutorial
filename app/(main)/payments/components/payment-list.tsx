'use client';

import { usePayments } from '@/app/(main)/payments/hooks/use-payments';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusColors: Record<string, string> = {
  paid: 'bg-green-500',
  pending: 'bg-yellow-500',
  open: 'bg-blue-500',
  failed: 'bg-red-500',
  expired: 'bg-gray-500',
  canceled: 'bg-gray-500',
};

export function PaymentList() {
  const { data: payments, isPending, isError, error } = usePayments();

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-destructive">
        {error instanceof Error ? error.message : 'Failed to fetch payments'}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No payments found. Create your first payment above.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-medium">{payment.description}</TableCell>
              <TableCell>
                {payment.currency} {payment.amount}
              </TableCell>
              <TableCell>
                <Badge
                  className={statusColors[payment.status] || 'bg-gray-500'}
                  variant="secondary"
                >
                  {payment.status}
                </Badge>
              </TableCell>
              <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
