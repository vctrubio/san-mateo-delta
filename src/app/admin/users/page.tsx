import UsersTable from '@/components/admin/UsersTable';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import { listUsers } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await listUsers();
  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Users</h1>
        <p className="text-sm text-slate-500 mt-1">{users.length} users</p>
      </div>
      <div className="mb-6">
        <UserSignUpForm variant="card" />
      </div>
      <UsersTable users={users} />
    </div>
  );
}
