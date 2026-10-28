import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Construction, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  targetPhase: string;
  features?: string[];
}

export function PlaceholderPage({
  title,
  description,
  targetPhase,
  features = [],
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <Badge variant="purple" size="sm">
              {targetPhase}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-2">
            <Construction className="h-7 w-7" />
          </div>
          <CardTitle className="text-lg">Module Under Scheduled Development</CardTitle>
          <CardDescription>
            This workflow interface will be fully wired with the backend APIs during {targetPhase}.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 max-w-lg mx-auto">
          {features.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Planned Features in {targetPhase}:
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside">
                {features.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
