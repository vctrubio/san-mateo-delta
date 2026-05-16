import type { Metadata } from 'next';

// Metadata for every /user/* page. `absolute` bypasses the root template
// (which would otherwise append "· Finca San Mateo") so the browser tab
// reads cleanly as "Guest · San Mateo". noindex/nofollow alongside the
// robots.txt disallow — these are per-guest dashboards, not public.
export const metadata: Metadata = {
  title: { absolute: 'Guest · San Mateo' },
  robots: { index: false, follow: false },
};

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
