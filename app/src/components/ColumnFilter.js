import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Column filter: a small funnel icon next to the column title that opens a floating panel
// (operator + value, or a list of options) with Reset / Apply. The table header stays unchanged.
//
// value / onChange: { op, value, value2, values } or undefined when the column is not filtered.
// type: 'text' | 'number' | 'date' | 'options'; ops: optional subset of the operators of the type.

const OPERATORS = {
  text: ['contains', 'equals', 'startsWith'],
  number: ['equals', 'startsWith'],
  date: ['equals', 'before', 'after', 'between'],
  options: ['in'],
};

const OPERATOR_LABELS = {
  contains: 'filter_contains',
  equals: 'filter_equals',
  startsWith: 'filter_starts_with',
  before: 'filter_before',
  after: 'filter_after',
  between: 'filter_between',
};

const PANEL_WIDTH = 240;

export const isFilterActive = (filter) =>
  !!filter && ((Array.isArray(filter.values) && filter.values.length > 0) || String(filter.value ?? '').trim() !== '');

const canApply = (type, draft) => {
  if (type === 'options') return draft.values.length > 0;
  if (String(draft.value ?? '').trim() === '') return false;
  if (type === 'date' && draft.op === 'between') return String(draft.value2 ?? '').trim() !== '';
  return true;
};

const ColumnFilter = ({ type = 'text', ops, value, onChange, options = [] }) => {
  const { t } = useTranslation('common');
  const operators = ops || OPERATORS[type] || [];
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState({ op: operators[0], value: '', value2: '', values: [] });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const active = isFilterActive(value);

  const toggle = (e) => {
    e.stopPropagation(); // the header click sorts the column
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)),
    });
    setDraft({
      op: value?.op && operators.includes(value.op) ? value.op : operators[0],
      value: value?.value ?? '',
      value2: value?.value2 ?? '',
      values: [...(value?.values ?? [])],
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const isInside = (target) => panelRef.current?.contains(target) || buttonRef.current?.contains(target);
    const onMouseDown = (e) => { if (!isInside(e.target)) setOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    // The panel is positioned on the screen: close it when the page (not the panel itself) scrolls or resizes
    const onScroll = (e) => { if (!panelRef.current?.contains(e.target)) setOpen(false); };
    const onResize = () => setOpen(false);

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const apply = () => {
    if (!canApply(type, draft)) return;
    onChange(type === 'options'
      ? { op: 'in', values: draft.values }
      : { op: draft.op, value: String(draft.value).trim(), value2: draft.op === 'between' ? draft.value2 : '' });
    setOpen(false);
  };

  const reset = () => {
    onChange(undefined);
    setOpen(false);
  };

  const onEnter = (e) => { if (e.key === 'Enter') apply(); };
  const inputClass = "w-full px-2 py-1 text-sm text-slate-700 border border-gray-300 rounded-md focus:outline-none focus:border-primary";

  const panel = open && (
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: position.top, left: position.left, width: PANEL_WIDTH }}
      className="z-50 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-left text-sm font-normal text-slate-700"
      onClick={(e) => e.stopPropagation()}
    >
      {type === 'options' ? (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {options.map(option => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={draft.values.includes(option.value)}
                onChange={(e) => setDraft(prev => ({
                  ...prev,
                  values: e.target.checked
                    ? [...prev.values, option.value]
                    : prev.values.filter(v => v !== option.value),
                }))}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {operators.length > 1 && (
            <select className={inputClass} value={draft.op} onChange={(e) => setDraft(prev => ({ ...prev, op: e.target.value }))}>
              {operators.map(op => <option key={op} value={op}>{t(OPERATOR_LABELS[op])}</option>)}
            </select>
          )}
          <input
            autoFocus
            type={type === 'date' ? 'date' : 'text'}
            inputMode={type === 'number' ? 'numeric' : undefined}
            className={inputClass}
            placeholder={t('filter_value_placeholder')}
            value={draft.value}
            onChange={(e) => {
              const v = type === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value;
              setDraft(prev => ({ ...prev, value: v }));
            }}
            onKeyDown={onEnter}
          />
          {type === 'date' && draft.op === 'between' && (
            <input
              type="date"
              className={inputClass}
              value={draft.value2}
              min={draft.value || undefined}
              onChange={(e) => setDraft(prev => ({ ...prev, value2: e.target.value }))}
              onKeyDown={onEnter}
            />
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button type="button" onClick={reset} className="px-3 py-1 rounded-md border border-gray-300 text-slate-700 hover:bg-gray-50">
          {t('filter_reset')}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!canApply(type, draft)}
          className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {t('filter_apply')}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        title={t('filter_title')}
        aria-label={t('filter_title')}
        aria-expanded={open}
        className={`inline-flex align-middle ml-1 p-0.5 rounded hover:bg-gray-100 ${active ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <Filter className="w-3.5 h-3.5" fill={active ? 'currentColor' : 'none'} />
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
};

export default ColumnFilter;
