import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface StepsViewClasses {
  why?: string;
  toggle?: string;
  chev?: string;
  chevOpen?: string;
  list?: string;
}

export interface StepsViewProps {
  title: string;
  steps: string[];
  open: boolean;
  onToggle: () => void;
  listId: string;
  classes?: StepsViewClasses;
}

/**
 * Vista de "Lo que hizo el agente" (web-46b). Cerrado no se renderiza la lista: con `hidden` la regla
 * `display: grid` del CSS ganaba y se veía siempre. Sin CSS Modules para poder probarla montada.
 */
export default function StepsView({ title, steps, open, onToggle, listId, classes = {} }: StepsViewProps) {
  return (
    <div className={classes.why}>
      <button
        type="button"
        className={classes.toggle}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={onToggle}
      >
        <ChevronRight size={13} aria-hidden="true" className={open ? classes.chevOpen : classes.chev} />
        {title}
      </button>
      {open && (
        <ol id={listId} className={classes.list}>
          {steps.map((s, i) => (
            <li key={i}>
              <span aria-hidden="true">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
