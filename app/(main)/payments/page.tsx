import { CreditCard } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getCurrentUser } from '@/lib/auth';
import { PaymentForm } from './components/payment-form';
import { PaymentList } from './components/payment-list';

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
              <p className="text-muted-foreground mt-1">Manage your payments powered by Mollie</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Create Payment */}
          <Card>
            <CardHeader>
              <CardTitle>Create Payment</CardTitle>
              <CardDescription>
                Create a new payment with Mollie. You&apos;ll be redirected to the Mollie checkout
                page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentForm />
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View all your previous payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentList />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
