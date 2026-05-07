'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool } from '@db/client';

type CreateUserResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

function normaliseEmail(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const name = str(formData, 'name');
  const email = normaliseEmail(formData.get('email'));
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!email) return { ok: false, error: 'Valid email is required.' };

  const tif = str(formData, 'tif');
  const nationality = str(formData, 'nationality');
  const dob = str(formData, 'dob'); // yyyy-mm-dd or null

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (name, email, tif, nationality, dob)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             tif = COALESCE(EXCLUDED.tif, users.tif),
             nationality = COALESCE(EXCLUDED.nationality, users.nationality),
             dob = COALESCE(EXCLUDED.dob, users.dob)
       RETURNING id::text`,
      [name, email, tif, nationality, dob],
    );
    const userId = rows[0].id;
    revalidatePath('/user');
    revalidatePath('/admin/users');
    revalidatePath('/admin');
    return { ok: true, userId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function createUserAndRedirect(formData: FormData): Promise<void> {
  const result = await createUser(formData);
  if (!result.ok) throw new Error(result.error);
  redirect(`/user/${result.userId}`);
}
