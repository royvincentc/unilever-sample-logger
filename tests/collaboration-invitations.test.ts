import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('explicit invitation binds once, denies other accounts and preserves revocation',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;`);
    await db.exec(await readFile('supabase/migrations/20261010025516_collaboration_foundation.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/20261010045641_collaboration_member_invitations.sql','utf8'));
    const workspace=crypto.randomUUID();
    await db.query('insert into collab_workspaces values($1,$2)',[workspace,'Test']);
    await db.query("insert into collab_member_invitations(workspace_id,email,role) values($1,'approved@example.invalid','admin')",[workspace]);
    const claim=(uid:string,email:string)=>db.query('select * from collab_claim_invitation($1,$2,$3)',[workspace,uid,email]);
    await db.exec('set role authenticated');
    await assert.rejects(claim('attacker','approved@example.invalid'),/permission denied/);
    await assert.rejects(db.query('select * from collab_member_invitations'),/permission denied/);
    await db.exec('set role service_role');
    assert.equal((await claim('unapproved','other@example.invalid')).rows.length,0);
    const result:any=await claim('approved-uid','Approved@Example.Invalid');
    assert.equal(result.rows[0].role,'admin');
    assert.equal((await claim('replacement-uid','approved@example.invalid')).rows.length,0);
    await db.query("update collab_memberships set active=false where uid='approved-uid'");
    assert.equal((await claim('approved-uid','approved@example.invalid')).rows.length,0);
    await db.query("delete from collab_memberships where uid='approved-uid'");
    assert.equal((await claim('approved-uid','approved@example.invalid')).rows.length,0);
  } finally { await db.close(); }
});
