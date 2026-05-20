import { NextResponse } from 'next/server';
import { sql, eq } from 'drizzle-orm';
import { db, profiles } from '@antagna/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'antagna-attachments';
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Two-step upload protocol:
 *  1) Client POSTs { filename, mimeType, sizeBytes, entityType, entityId }.
 *  2) Server creates a signed URL (1h) and records a pending attachment row,
 *     returns { signedUrl, token, path, attachmentId }.
 *  3) Client PUTs the file to signedUrl directly (no server roundtrip for bytes).
 *  4) Client POSTs back to /api/upload?confirm=1&attachmentId=... to mark done.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [actor] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);

  const url = new URL(request.url);
  const confirm = url.searchParams.get('confirm');

  if (confirm) {
    const attachmentId = url.searchParams.get('attachmentId');
    if (!attachmentId) {
      return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    }
    // No-op for now: the attachment row was created at signing time; we trust
    // the client did the PUT. (A safer flow would HEAD the object first.)
    return NextResponse.json({ ok: true, attachmentId });
  }

  const body = (await request.json()) as {
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    entityType?: string;
    entityId?: string;
    description?: string | null;
  };

  if (
    !body.filename ||
    !body.mimeType ||
    typeof body.sizeBytes !== 'number' ||
    !body.entityType ||
    !body.entityId
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (body.sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', limit: MAX_BYTES },
      { status: 413 },
    );
  }

  // Sanitize filename → uuid-prefixed path inside the entity folder.
  const safeName = body.filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  const path = `${body.entityType}/${body.entityId}/${crypto.randomUUID()}-${safeName}`;

  const admin = getSupabaseAdmin();

  // Ensure the bucket exists (idempotent).
  try {
    await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
    });
  } catch {
    // already exists — ignore
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (signErr || !signed) {
    return NextResponse.json(
      { error: 'sign_failed', detail: signErr?.message },
      { status: 500 },
    );
  }

  // Record the attachment row pre-upload (so we have an id to revisit).
  const insert = await db.execute<{ id: string }>(sql`
    INSERT INTO attachments (
      entity_type, entity_id, filename, mime_type, size_bytes,
      storage_provider, storage_path, uploaded_by_id, description
    ) VALUES (
      ${body.entityType}, ${body.entityId}::uuid, ${body.filename},
      ${body.mimeType}, ${body.sizeBytes}::bigint,
      'supabase', ${path},
      ${actor?.id ? sql`${actor.id}::uuid` : sql`NULL`},
      ${body.description ?? null}
    )
    RETURNING id::text AS id
  `);
  const attachmentId = (insert as unknown as Array<{ id: string }>)[0]?.id;

  return NextResponse.json({
    ok: true,
    attachmentId,
    signedUrl: signed.signedUrl,
    token: signed.token,
    path,
  });
}

/**
 * GET /api/upload?attachmentId=... — returns a 1h signed download URL for
 * read access.
 */
export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const attachmentId = url.searchParams.get('attachmentId');
  if (!attachmentId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const rows = (await db.execute<{ storage_path: string | null }>(sql`
    SELECT storage_path FROM attachments WHERE id = ${attachmentId}::uuid
  `)) as unknown as Array<{ storage_path: string | null }>;
  const path = rows[0]?.storage_path;
  if (!path) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error || !data) {
    return NextResponse.json(
      { error: 'sign_failed', detail: error?.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ url: data.signedUrl });
}

export async function DELETE(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const attachmentId = url.searchParams.get('attachmentId');
  if (!attachmentId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  const rows = (await db.execute<{ storage_path: string | null }>(sql`
    SELECT storage_path FROM attachments WHERE id = ${attachmentId}::uuid
  `)) as unknown as Array<{ storage_path: string | null }>;
  const path = rows[0]?.storage_path;

  const admin = getSupabaseAdmin();
  if (path) {
    await admin.storage.from(BUCKET).remove([path]);
  }

  await db.execute(sql`
    DELETE FROM attachments WHERE id = ${attachmentId}::uuid
  `);

  return NextResponse.json({ ok: true });
}
