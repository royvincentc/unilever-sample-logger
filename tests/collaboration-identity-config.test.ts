import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firebaseIdentityConfig } from '../api/_firebaseIdentityConfig';

const credentials = JSON.stringify({ project_id:'unilever-qc',client_email:'service@example.invalid',private_key:'test-key' });
test('existing same-project Google credential supports Firebase identity without duplicate secrets',()=>{
  for(const key of ['GOOGLE_CREDENTIALS','GCP_CREDENTIALS_JSON','FIREBASE_ADMIN_CREDENTIALS']) {
    const config=firebaseIdentityConfig({[key]:credentials});
    assert.equal(config.projectId,'unilever-qc');
    assert.equal(config.credentials.project_id,'unilever-qc');
  }
});
test('identity configuration rejects missing, malformed, mismatched and incomplete credentials',()=>{
  for(const env of [{},{GOOGLE_CREDENTIALS:'invalid'},{GOOGLE_CREDENTIALS:'{}'},
    {GOOGLE_CREDENTIALS:credentials,FIREBASE_PROJECT_ID:'other-project'},
    {GOOGLE_CREDENTIALS:credentials.replace('unilever-qc','other-project')},
    {FIREBASE_ADMIN_CREDENTIALS:'invalid',GOOGLE_CREDENTIALS:credentials}]) assert.throws(()=>firebaseIdentityConfig(env));
});
