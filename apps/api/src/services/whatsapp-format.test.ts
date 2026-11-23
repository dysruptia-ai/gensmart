/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toWhatsAppText } from './whatsapp-format';

describe('toWhatsAppText', () => {
  test('**bold** → *bold*', () => {
    assert.equal(toWhatsAppText('**Producto:** Libro'), '*Producto:* Libro');
    assert.equal(toWhatsAppText('Total: **$56.600** (contra entrega)'), 'Total: *$56.600* (contra entrega)');
    assert.equal(toWhatsAppText('**a** y **b**'), '*a* y *b*');
  });

  test('__italic__ and ~~strike~~', () => {
    assert.equal(toWhatsAppText('Es __muy__ bueno'), 'Es _muy_ bueno');
    assert.equal(toWhatsAppText('Antes ~~$40.000~~ ahora $35.000'), 'Antes ~$40.000~ ahora $35.000');
  });

  test('WhatsApp format, lone asterisks, numbers and emojis are untouched', () => {
    for (const t of ['*ya bien*', '_ya bien_', '~ya~', '2 * 3 = 6', '5 ** 2', '****', 'Precio: $21.500 COP 🙂', '* item suelto', 'a__b', 'mi_correo_x']) {
      assert.equal(toWhatsAppText(t), t, t);
    }
  });

  test('headings → bold line', () => {
    assert.equal(toWhatsAppText('# Resumen'), '*Resumen*');
    assert.equal(toWhatsAppText('### Tu pedido ###'), '*Tu pedido*');
    assert.equal(toWhatsAppText('## **Resumen**'), '*Resumen*'); // not wrapped twice
    assert.equal(toWhatsAppText('Pedido #123'), 'Pedido #123'); // "#" not at the start of the line
    assert.equal(toWhatsAppText('#hashtag'), '#hashtag'); // no space: not a heading
    assert.equal(toWhatsAppText('Hola\n## Datos\nNombre: Ana'), 'Hola\n*Datos*\nNombre: Ana');
  });

  test('links → text (url)', () => {
    assert.equal(toWhatsAppText('Mira [el catálogo](https://ejemplo.co/c?x=1) aquí'), 'Mira el catálogo (https://ejemplo.co/c?x=1) aquí');
    assert.equal(toWhatsAppText('[x](javascript:alert(1))'), '[x](javascript:alert(1))'); // only http(s)
    // URLs are never modified, even with "__" or "**" inside; text around them still is.
    assert.equal(toWhatsAppText('https://ejemplo.co/a__b__c'), 'https://ejemplo.co/a__b__c');
    assert.equal(toWhatsAppText('**Foto:** https://cdn.co/x**y**.jpg'), '*Foto:* https://cdn.co/x**y**.jpg');
    assert.equal(toWhatsAppText('[foto](https://cdn.co/a__b.jpg) **ya**'), 'foto (https://cdn.co/a__b.jpg) *ya*');
  });

  test('pairs never span lines', () => {
    assert.equal(toWhatsAppText('**abre\ncierra**'), '**abre\ncierra**');
  });

  test('plain text is returned identical', () => {
    const t = 'Hola Ana, el rompecabezas cuesta $21.500.\n1. Envío a Cajicá\n- Pago contra entrega';
    assert.equal(toWhatsAppText(t), t);
    assert.equal(toWhatsAppText(''), '');
  });

  test('4 KB of asterisks (and other adversarial inputs) in milliseconds', () => {
    const inputs = ['*'.repeat(4096), '**a'.repeat(1365), '_'.repeat(4096), '__a'.repeat(1365), '['.repeat(4096), '[a](http://'.repeat(370), '#'.repeat(4096), '# ' + '#'.repeat(4094), '~'.repeat(4096)];
    for (const input of inputs) {
      const start = process.hrtime.bigint();
      toWhatsAppText(input);
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      assert.ok(ms < 50, `${ms} ms for ${input.slice(0, 12)}…`);
    }
  });
});
