import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StepsView from './StepsView';

const props = { title: 'Lo que hizo el agente · 2 pasos', steps: ['Guardó: nombre', 'Agendó una cita'], onToggle: () => undefined, listId: 'l1' };

test('StepsView: cerrado no muestra la lista; abierto sí', () => {
  const closed = renderToStaticMarkup(<StepsView {...props} open={false} />);
  assert.match(closed, /aria-expanded="false"/);
  assert.doesNotMatch(closed, /<ol/);
  assert.doesNotMatch(closed, /Agendó una cita/);
  const open = renderToStaticMarkup(<StepsView {...props} open />);
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /aria-controls="l1"/);
  assert.match(open, /<ol id="l1"/);
  assert.match(open, /Agendó una cita/);
});
