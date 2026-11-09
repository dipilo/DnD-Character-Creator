// The sanitizer runs on every imported description at render time, so anything it flattens is
// flattened after the pipeline has already got it right.
// Run with `npm run test:imported-text`.
import assert from 'node:assert/strict';
import test from 'node:test';

const { sanitizeImportedText } = await import('@/lib/importedText');

test('a line break is structure and survives', () => {
  assert.equal(sanitizeImportedText('First paragraph.\nSecond paragraph.'), 'First paragraph.\nSecond paragraph.');
});

test("a table's rows stay rows", () => {
  const table = 'Level | Max. CR | Limitations | Example\n2nd | 1/4 | No flying or swimming speed | Wolf\n4th | 1/2 | No flying speed | Crocodile';
  assert.equal(sanitizeImportedText(table), table);
});

test('horizontal runs still collapse, and a stranded space before punctuation still goes', () => {
  assert.equal(sanitizeImportedText('a   b\tc'), 'a b c');
  assert.equal(sanitizeImportedText('its true form . Its statistics'), 'its true form. Its statistics');
});

test('spacing around a line break is tidied without losing the break', () => {
  assert.equal(sanitizeImportedText('one   \n   two'), 'one\ntwo');
  assert.equal(sanitizeImportedText('one\n\n\n\ntwo'), 'one\n\ntwo');
});

test('leading and trailing whitespace still goes, newlines included', () => {
  assert.equal(sanitizeImportedText('\n  text  \n'), 'text');
});

test('page chrome is still cut, and the cut does not depend on newlines', () => {
  assert.equal(sanitizeImportedText('Real text.\nMy Characters and all the nav after it'), 'Real text.');
});

test('a quote keeps its text closed up', () => {
  assert.equal(sanitizeImportedText('he said “  hello  ” to me'), 'he said “hello” to me');
});

test('nothing is invented for an empty value', () => {
  assert.equal(sanitizeImportedText(undefined), undefined);
  assert.equal(sanitizeImportedText(''), '');
});
