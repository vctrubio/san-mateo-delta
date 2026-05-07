import DebugColorPanel from '@/components/debug/DebugColorPanel';
import DebugFincaPanel from '@/components/debug/DebugFincaPanel';
import DebugSchemaPanel from '@/components/debug/DebugSchemaPanel';
import DebugDatabasePanel from '@/components/debug/DebugDatabasePanel';
import DebugE2EPanel from '@/components/debug/DebugE2EPanel';

export const dynamic = 'force-dynamic';

export default function DebugPage() {
  return (
    <main>
      <DebugE2EPanel />
      <DebugColorPanel />
      <DebugFincaPanel />
      <DebugSchemaPanel />
      <DebugDatabasePanel />
    </main>
  );
}
