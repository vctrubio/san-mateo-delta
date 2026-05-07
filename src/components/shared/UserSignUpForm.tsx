import { createUserAndRedirect } from '@/actions/users';

export default function UserSignUpForm({
  variant = 'card',
}: {
  variant?: 'card' | 'inline';
}) {
  const wrapperClass =
    variant === 'card'
      ? 'rounded-2xl bg-white border border-slate-100 p-5'
      : 'rounded-xl bg-slate-50 border border-slate-100 p-4';

  return (
    <form action={createUserAndRedirect} className={wrapperClass}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Quick sign-up</h3>
        <span className="text-[10px] font-mono text-slate-300">creates a user · redirects to /user/[id]</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input name="name"        label="Name"           required />
        <Input name="email"       label="Email"          type="email" required />
        <Input name="tif"         label="TIF (optional)" />
        <Input name="nationality" label="Nationality (optional)" />
        <Input name="dob"         label="DOB (optional)" type="date" />
      </div>
      <button
        type="submit"
        className="mt-3 w-full md:w-auto px-5 py-2.5 rounded-lg bg-slate-900 text-white text-[12px] font-mono uppercase tracking-widest hover:bg-ocean transition-colors"
      >
        Create user
      </button>
    </form>
  );
}

function Input({
  name,
  label,
  type = 'text',
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
      />
    </label>
  );
}
