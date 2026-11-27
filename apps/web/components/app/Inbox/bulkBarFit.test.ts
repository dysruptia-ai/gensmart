import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulkBarLevel } from './bulkBarFit';

test('barra del lote: el texto se queda mientras quepa; Borrar y × no cuentan como texto', () => {
  const base = { countWidth: 80, textWidths: [74, 66, 72], fixedIcons: 2, iconWidth: 34, gap: 4 };
  // 80 + 212 + 68 + 5*4 = 380
  assert.equal(bulkBarLevel({ ...base, width: 380 }), 0);
  assert.equal(bulkBarLevel({ ...base, width: 379 }), 1);
  // Sin Asignar (plan Solo) cabe en menos
  assert.equal(bulkBarLevel({ ...base, textWidths: [66, 72], width: 310 }), 0);
});
