'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useCreatePayment } from '@/app/(main)/payments/hooks/use-payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreatePaymentInput } from '@/modules/payments/types';

export function PaymentForm() {
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'EUR',
    description: '',
    orderId: '',
  });

  const createPayment = useCreatePayment();
  const loading = createPayment.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreatePaymentInput = {
      amount: formData.amount,
      currency: formData.currency,
      description: formData.description,
      ...(formData.orderId ? { metadata: { orderId: formData.orderId } } : {}),
    };

    createPayment.mutate(data, {
      onSuccess: (payment) => {
        // Redirect to Stripe Checkout
        if (payment.stripeCheckoutUrl) {
          window.location.href = payment.stripeCheckoutUrl;
        } else {
          toast.error('No checkout URL received');
        }
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to create payment');
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="text"
          placeholder="10.00"
          pattern="^\d+\.\d{2}$"
          required
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
        />
        <p className="text-sm text-muted-foreground mt-1">Format: 10.00</p>
      </div>

      <div>
        <Label htmlFor="currency">Currency</Label>
        <Select
          value={formData.currency}
          onValueChange={(value) => setFormData({ ...formData, currency: value })}
        >
          <SelectTrigger id="currency">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EUR">EUR (€)</SelectItem>
            <SelectItem value="USD">USD ($)</SelectItem>
            <SelectItem value="GBP">GBP (£)</SelectItem>
            <SelectItem value="CHF">CHF</SelectItem>
            <SelectItem value="PLN">PLN</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Payment for..."
          required
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="orderId">Order ID (Optional)</Label>
        <Input
          id="orderId"
          type="text"
          placeholder="order_123"
          value={formData.orderId}
          onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating payment...' : 'Pay with Stripe'}
      </Button>
    </form>
  );
}
