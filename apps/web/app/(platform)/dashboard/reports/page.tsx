import { Suspense } from 'react';
import ReportsScreen from '@/components/app/Reports/ReportsScreen';

export default function Page() {
  return (
    <Suspense>
      <ReportsScreen />
    </Suspense>
  );
}
