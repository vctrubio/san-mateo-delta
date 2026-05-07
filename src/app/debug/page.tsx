import DebugColorPanel from '@/components/debug/DebugColorPanel';
import DebugFincaPanel from '@/components/debug/DebugFincaPanel';
import DebugSchemaPanel from '@/components/debug/DebugSchemaPanel';
import DebugDatabasePanel from '@/components/debug/DebugDatabasePanel';

export const dynamic = 'force-dynamic';

export default function DebugPage() {
  return (
    <main>
      <DebugColorPanel />
      <DebugFincaPanel />
      <DebugSchemaPanel />
      <DebugDatabasePanel />
    </main>
  );
}
