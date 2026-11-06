import React, { useEffect, useRef, useState } from 'react';
import { evaluateScientificExpression } from '../utils/bluebookRules';
import {
  Maximize2,
  Minimize2,
  X,
  GripHorizontal,
  TrendingUp,
  Calculator as CalcIcon,
  Delete,
  CornerDownLeft,
} from 'lucide-react';

interface BluebookCalculatorModalProps {
  onClose: () => void;
}

declare global {
  interface Window {
    Desmos?: any;
  }
}

interface SciRow {
  id: string;
  expr: string;
  result: string;
}

export const BluebookCalculatorModal: React.FC<BluebookCalculatorModalProps> = ({
  onClose,
}) => {
  const [calcMode, setCalcMode] = useState<'graphing' | 'scientific'>('graphing');
  const [isExpandedWidth, setIsExpandedWidth] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 72 });
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Graphing Desmos state
  const desmosContainerRef = useRef<HTMLDivElement | null>(null);
  const desmosInstanceRef = useRef<any>(null);
  const [desmosMounted, setDesmosMounted] = useState(false);

  // Scientific Calculator state (matches 00:48 - 00:49 in screen recording)
  const [angleMode, setAngleMode] = useState<'RAD' | 'DEG'>('RAD');
  const [sciTab, setSciTab] = useState<'main' | 'abc' | 'func'>('main');
  const [sciRows, setSciRows] = useState<SciRow[]>([
    { id: 'row-1', expr: '', result: '' },
  ]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);

  // Dragging handler
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const nextX = Math.max(
        4,
        Math.min(window.innerWidth - 280, e.clientX - dragOffsetRef.current.x)
      );
      const nextY = Math.max(
        44,
        Math.min(window.innerHeight - 120, e.clientY - dragOffsetRef.current.y)
      );
      setPosition({ x: nextX, y: nextY });
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Mount Desmos Graphing Calculator when in graphing mode
  useEffect(() => {
    if (
      calcMode === 'graphing' &&
      desmosContainerRef.current &&
      window.Desmos
    ) {
      if (!desmosInstanceRef.current) {
        try {
          desmosInstanceRef.current = window.Desmos.GraphingCalculator(
            desmosContainerRef.current,
            {
              keypad: true,
              expressions: true,
              settingsMenu: true,
              zoomButtons: true,
            }
          );
          setDesmosMounted(true);
        } catch {
          setDesmosMounted(false);
        }
      } else {
        try {
          desmosInstanceRef.current.resize();
        } catch {}
      }
    }
  }, [calcMode, isExpandedWidth]);

  useEffect(() => {
    return () => {
      if (desmosInstanceRef.current) {
        try {
          desmosInstanceRef.current.destroy();
        } catch {}
        desmosInstanceRef.current = null;
      }
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const getLastAnsValue = (upToIndex: number): number => {
    for (let i = upToIndex - 1; i >= 0; i--) {
      const num = Number(sciRows[i]?.result);
      if (Number.isFinite(num)) return num;
    }
    return 0;
  };

  const updateCurrentSciExpr = (nextExpr: string) => {
    setSciRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== activeRowIndex) return row;
        const ans = getLastAnsValue(idx);
        const evaluated = evaluateScientificExpression(nextExpr, angleMode, ans);
        return {
          ...row,
          expr: nextExpr,
          result: evaluated,
        };
      })
    );
  };

  const appendSciToken = (token: string) => {
    const current = sciRows[activeRowIndex]?.expr || '';
    updateCurrentSciExpr(current + token);
  };

  const handleSciBackspace = () => {
    const current = sciRows[activeRowIndex]?.expr || '';
    updateCurrentSciExpr(current.slice(0, -1));
  };

  const handleSciClearAll = () => {
    setSciRows([{ id: `row-${Date.now()}`, expr: '', result: '' }]);
    setActiveRowIndex(0);
  };

  const handleSciEnter = () => {
    const newRow: SciRow = {
      id: `row-${Date.now()}-${sciRows.length}`,
      expr: '',
      result: '',
    };
    setSciRows((prev) => [...prev, newRow]);
    setActiveRowIndex(sciRows.length);
  };

  // Re-evaluate rows when angleMode toggles between RAD and DEG
  useEffect(() => {
    setSciRows((prev) => {
      let runningAns = 0;
      return prev.map((row) => {
        const res = evaluateScientificExpression(row.expr, angleMode, runningAns);
        const parsed = Number(res);
        if (Number.isFinite(parsed) && res !== '') {
          runningAns = parsed;
        }
        return { ...row, result: res };
      });
    });
  }, [angleMode]);

  const widthPx = isExpandedWidth ? 580 : 390;

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `min(${widthPx}px, 95vw)`,
      }}
      role="dialog"
      aria-label="Calculator"
      className="fixed z-50 rounded-xl border-2 border-stone-800 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col select-none"
    >
      {/* Top Dark Draggable Header with Graphing / Scientific Toggle Pill (00:37 & 00:48) */}
      <div
        onMouseDown={startDrag}
        className="bg-[#1E1E1E] text-white px-3 py-2 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
      >
        {/* Mode Toggle Pill */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex items-center rounded-lg bg-stone-800 p-0.5 border border-stone-600"
        >
          <button
            type="button"
            onClick={() => setCalcMode('graphing')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              calcMode === 'graphing'
                ? 'bg-white text-stone-950 shadow-2xs'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Graphing</span>
          </button>
          <button
            type="button"
            onClick={() => setCalcMode('scientific')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              calcMode === 'scientific'
                ? 'bg-white text-stone-950 shadow-2xs'
                : 'text-stone-300 hover:text-white'
            }`}
          >
            <CalcIcon className="w-3.5 h-3.5" />
            <span>Scientific</span>
          </button>
        </div>

        {/* Center Drag Handle */}
        <div className="text-stone-400">
          <GripHorizontal className="w-4 h-4" />
        </div>

        {/* Expand Width & Close Buttons */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1"
        >
          <button
            type="button"
            onClick={() => setIsExpandedWidth((prev) => !prev)}
            aria-label={
              isExpandedWidth ? 'Collapse calculator width' : 'Expand calculator width'
            }
            title={isExpandedWidth ? 'Collapse width' : 'Expand width'}
            className="p-1.5 rounded hover:bg-white/15 text-white transition-colors cursor-pointer"
          >
            {isExpandedWidth ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Calculator"
            className="p-1.5 rounded hover:bg-white/15 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GRAPHING CALCULATOR MODE */}
      <div className={calcMode === 'graphing' ? 'block' : 'hidden'}>
        <div
          ref={desmosContainerRef}
          className="w-full h-[500px] sm:h-[540px] bg-white"
        />
        {!desmosMounted && (
          <div className="p-3 border-t border-stone-200 bg-stone-50 text-xs text-stone-600 flex items-center justify-between">
            <span>Tip: Switch to Scientific above for instant expression rows.</span>
            <button
              type="button"
              onClick={() => setCalcMode('scientific')}
              className="font-semibold text-blue-700 underline cursor-pointer"
            >
              Open Scientific
            </button>
          </div>
        )}
      </div>

      {/* SCIENTIFIC CALCULATOR MODE (Exact Mirror of 00:48 - 00:49) */}
      {calcMode === 'scientific' && (
        <div className="flex flex-col h-[500px] sm:h-[540px] bg-white text-stone-900">
          {/* Top Multi-Row Expression History Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-200 border-b border-stone-300">
            {sciRows.map((row, idx) => {
              const isCurrent = idx === activeRowIndex;
              return (
                <div
                  key={row.id}
                  onClick={() => setActiveRowIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 gap-2 transition-colors ${
                    isCurrent
                      ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-500/40'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="text"
                    value={row.expr}
                    onFocus={() => setActiveRowIndex(idx)}
                    onChange={(e) => updateCurrentSciExpr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSciEnter();
                      }
                    }}
                    placeholder={idx === 0 ? 'Type an expression (e.g. 1 + 2)' : ''}
                    aria-label={`Scientific expression row ${idx + 1}`}
                    className="flex-1 bg-transparent font-mono text-sm text-stone-900 focus:outline-none"
                  />
                  <div className="font-mono text-sm font-semibold text-stone-700 shrink-0">
                    {row.result !== '' ? `= ${row.result}` : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Control Strip: main | abc | func | RAD/DEG | clear all */}
          <div className="px-3 py-2 bg-[#F2F2F2] border-b border-stone-300 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              {(['main', 'abc', 'func'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSciTab(t)}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                    sciTab === t
                      ? 'bg-white text-stone-900 shadow-2xs border border-stone-300'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* RAD / DEG Switch */}
            <div className="inline-flex rounded border border-stone-300 bg-stone-200 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setAngleMode('RAD')}
                className={`px-2 py-0.5 rounded-xs cursor-pointer ${
                  angleMode === 'RAD'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600'
                }`}
              >
                RAD
              </button>
              <button
                type="button"
                onClick={() => setAngleMode('DEG')}
                className={`px-2 py-0.5 rounded-xs cursor-pointer ${
                  angleMode === 'DEG'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600'
                }`}
              >
                DEG
              </button>
            </div>

            <button
              type="button"
              onClick={handleSciClearAll}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              clear all
            </button>
          </div>

          {/* Scientific Keypad Grid */}
          <div className="p-2.5 bg-[#EBEBEB] grid grid-cols-8 gap-1.5 text-sm font-medium">
            {/* Row 1 */}
            <button
              type="button"
              onClick={() => appendSciToken('^2')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-serif italic cursor-pointer"
            >
              a²
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('^')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-serif italic cursor-pointer"
            >
              aᵇ
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('abs(')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-serif italic cursor-pointer"
            >
              |a|
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('7')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              7
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('8')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              8
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('9')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              9
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('÷')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-bold cursor-pointer"
            >
              ÷
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('%')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 cursor-pointer"
            >
              %
            </button>

            {/* Row 2 */}
            <button
              type="button"
              onClick={() => appendSciToken('√(')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 cursor-pointer"
            >
              √
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('nthroot(3,')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 cursor-pointer"
            >
              ∛
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('π')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-serif cursor-pointer"
            >
              π
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('4')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              4
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('5')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              5
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('6')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              6
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('×')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-bold cursor-pointer"
            >
              ×
            </button>
            <button
              type="button"
              onClick={handleSciBackspace}
              aria-label="Backspace scientific calculator"
              className="py-2.5 rounded bg-stone-200 hover:bg-stone-300 border border-stone-300 flex items-center justify-center cursor-pointer"
            >
              <Delete className="w-4 h-4" />
            </button>

            {/* Row 3 */}
            <button
              type="button"
              onClick={() => appendSciToken('sin(')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 text-xs font-semibold cursor-pointer"
            >
              sin
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('cos(')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 text-xs font-semibold cursor-pointer"
            >
              cos
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('tan(')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 text-xs font-semibold cursor-pointer"
            >
              tan
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('1')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('2')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('3')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              3
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('−')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-bold cursor-pointer"
            >
              −
            </button>
            <div />

            {/* Row 4 */}
            <button
              type="button"
              onClick={() => appendSciToken('(')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 cursor-pointer"
            >
              (
            </button>
            <button
              type="button"
              onClick={() => appendSciToken(')')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 cursor-pointer"
            >
              )
            </button>
            <button
              type="button"
              onClick={() => appendSciToken(',')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 cursor-pointer"
            >
              ,
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('0')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('.')}
              className="py-2.5 rounded bg-white hover:bg-stone-50 border border-stone-300 font-bold cursor-pointer"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('ans')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 text-xs font-semibold cursor-pointer"
            >
              ans
            </button>
            <button
              type="button"
              onClick={() => appendSciToken('+')}
              className="py-2.5 rounded bg-stone-50 hover:bg-white border border-stone-300 font-bold cursor-pointer"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleSciEnter}
              aria-label="Enter new calculation row"
              className="py-2.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs cursor-pointer"
            >
              <CornerDownLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
