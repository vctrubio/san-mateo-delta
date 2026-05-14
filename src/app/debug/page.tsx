import DebugColorPanel from '@/components/debug/DebugColorPanel';
import DebugFincaPanel from '@/components/debug/DebugFincaPanel';
import DebugSchemaPanel from '@/components/debug/DebugSchemaPanel';
import DebugDatabasePanel from '@/components/debug/DebugDatabasePanel';
import DebugE2EPanel from '@/components/debug/DebugE2EPanel';
import DebugRefundPanel from '@/components/debug/DebugRefundPanel';
import DebugStripePanel from '@/components/debug/DebugStripePanel';
import DebugInvitationsPanel from '@/components/debug/DebugInvitationsPanel';
import DebugUserStoryPanel from '@/components/debug/DebugUserStoryPanel';

export const dynamic = 'force-dynamic';

export default function DebugPage() {
  return (
    <main>
      <DebugUserStoryPanel />
      <DebugE2EPanel />
      <DebugStripePanel />
      <DebugInvitationsPanel />
      <DebugColorPanel />
      <DebugFincaPanel />
      <DebugSchemaPanel />
      <DebugDatabasePanel />
      <DebugRefundPanel />
    </main>
  );
}
