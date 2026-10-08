import test from 'node:test';
import assert from 'node:assert/strict';
import { convertBijoyToUnicode } from 'bijoy2unicode';

test('Bijoy/Sutonny legacy Bangla converts to Bengali Unicode', () => {
  assert.equal(convertBijoyToUnicode('mvZwU `k I bqwU G‡Ki ¸”Q KZ?'), 'সাতটি দশ ও নয়টি একের গুচ্ছ কত?');
  assert.equal(convertBijoyToUnicode('K. 69'), 'ক. ৬৯');
});
