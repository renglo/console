import assert from 'node:assert/strict';
import test from 'node:test';

import { authClientName } from './authCloud.ts';

test('VITE_CLOUD selects Entra or Cognito', () => {
  assert.equal(authClientName('azure'), 'entra');
  assert.equal(authClientName(' Azure '), 'entra');
  assert.equal(authClientName('aws'), 'cognito');
  assert.equal(authClientName('AWS'), 'cognito');
  assert.equal(authClientName(undefined), 'cognito');
  assert.equal(authClientName(''), 'cognito');
});
