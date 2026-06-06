/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  Check,
  AlertCircle,
  Download,
  Info,
  Printer,
  ChevronRight,
  SlidersHorizontal,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { REQUIRED_SIEVES, AggregateSource, STANDARDS, SIEVES_DB_MM } from "./types";
import { getTargetLimitsInterpolated, optimizeBlend } from "./optimizer";
import SieveChart from "./components/SieveChart";

// Preset aggregate query items matching standard test properties
const DEFAULT_PRESET_SOURCES: AggregateSource[] = [
  {
    id: "source-1",
    name: "Coarse Gravel (3/4\")",
    passing: [95, 58, 4, 1.2, 0.5, 0.2, 0],
  },
  {
    id: "source-2",
    name: "Medium Gravel / Sand (0-4)",
    passing: [100, 100, 92, 68, 16, 4.5, 1],
  },
  {
    id: "source-3",
    name: "Washed Quarry Sand",
    passing: [100, 100, 100, 96, 82, 44, 11],
  },
  {
    id: "source-4",
    name: "Mineral Filler / Dust",
    passing: [100, 100, 100, 100, 100, 88, 76],
  },
];

// Associated color palette for aggregate curves
const SOURCE_COLORS = ["#f59e0b", "#06b6d4", "#6366f1", "#64748b", "#ec4899", "#10b981"];

export default function App() {
  // ---------------------------------
  // 1. STATE VARIABLES
  // ---------------------------------
  const [mode, setMode] = useState<"standard" | "custom">("standard");
  const [layer, setLayer] = useState<"subbase" | "base" | "gravel">("base"); // maps to "subbase", "base", "gravel"
  const [specType, setSpecType] = useState<string>("Type_IV"); // Default for base

  // Custom targets input states (used in "custom" mode)
  const [customTargets, setCustomTargets] = useState<number[]>([100, 85, 60, 45, 25, 15, 8]);
  const [customTolerance, setCustomTolerance] = useState<number>(5.0);
  
  // Aggregate sources state
  const [sources, setSources] = useState<AggregateSource[]>([
    { id: "s-1", name: "Source A (Coarse)", passing: [98, 65, 8, 2, 1, 0, 0] },
    { id: "s-2", name: "Source B (Fine)", passing: [100, 100, 95, 80, 40, 15, 6] },
  ]);

  // Selected proportions (0 to 1 range, sums to 1.0)
  const [proportions, setProportions] = useState<number[]>([0.5, 0.5]);

  // Optimization Result
  const [solved, setSolved] = useState<boolean>(false);
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [isPrintPreview, setIsPrintPreview] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "success" | "info" | "warning"; text: string } | null>({
    type: "info",
    text: "Welcome! Click 'Optimize Aggregate Mix' to find the mathematically ideal aggregate weight mix.",
  });

  // Highlighted sieve index for tooltips or focus assistance
  const [focusedSieveIdx, setFocusedSieveIdx] = useState<number | null>(null);

  // ---------------------------------
  // 2. DYNAMICALLY COMPUTED SPEC LIMITS
  // ---------------------------------
  const targetLimits = useMemo(() => {
    if (mode === "custom") {
      const minLimits = customTargets.map(t => Math.max(0, parseFloat((t - customTolerance).toFixed(2))));
      const maxLimits = customTargets.map(t => Math.min(100, parseFloat((t + customTolerance).toFixed(2))));
      return {
        minLimits,
        maxLimits,
        targets: customTargets,
      };
    }

    const { minLimits, maxLimits } = getTargetLimitsInterpolated(layer, specType);
    
    // Calculates targets as the average of min and max limits, or the non-null limit if one is present
    const rawCalculatedTargets = minLimits.map((mn, idx) => {
      const mx = maxLimits[idx];
      if (mn !== null && mx !== null) return (mn + mx) / 2;
      if (mn !== null) return mn;
      if (mx !== null) return mx;
      return null;
    });

    // Interpolate null targets to avoid drop-to-zero spikes on the chart
    const sieveSizes = REQUIRED_SIEVES.map(s => s.sizeMm);
    const filledTargets = rawCalculatedTargets.map((t, i) => {
      if (t !== null) return parseFloat(t.toFixed(2));

      let prevIdx = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (rawCalculatedTargets[j] !== null) {
          prevIdx = j;
          break;
        }
      }
      let nextIdx = -1;
      for (let j = i + 1; j < rawCalculatedTargets.length; j++) {
        if (rawCalculatedTargets[j] !== null) {
          nextIdx = j;
          break;
        }
      }

      if (prevIdx !== -1 && nextIdx !== -1) {
        const x1 = sieveSizes[prevIdx];
        const x2 = sieveSizes[nextIdx];
        const y1 = rawCalculatedTargets[prevIdx] as number;
        const y2 = rawCalculatedTargets[nextIdx] as number;
        if (x2 - x1 === 0) return parseFloat(y1.toFixed(2));
        const interp = y1 + ((sieveSizes[i] - x1) * (y2 - y1)) / (x2 - x1);
        return parseFloat(interp.toFixed(2));
      } else if (prevIdx !== -1) {
        return parseFloat((rawCalculatedTargets[prevIdx] as number).toFixed(2));
      } else if (nextIdx !== -1) {
        return parseFloat((rawCalculatedTargets[nextIdx] as number).toFixed(2));
      } else {
        return 100.0;
      }
    });

    return { minLimits, maxLimits, targets: filledTargets };
  }, [mode, layer, specType, customTargets, customTolerance]);

  // Determine available specification types based on selected Layer category
  const availableSpecTypes = useMemo(() => {
    if (layer === "subbase") {
      return Object.keys(STANDARDS["Sub-base"]);
    } else if (layer === "base") {
      return Object.keys(STANDARDS["Base"]);
    } else {
      return Object.keys(STANDARDS["Gravel_Surface"]);
    }
  }, [layer]);

  // Retain a logical spec type when changing layers
  useEffect(() => {
    if (availableSpecTypes.length > 0 && !availableSpecTypes.includes(specType)) {
      setSpecType(availableSpecTypes[0]);
    }
  }, [layer, availableSpecTypes, specType]);

  // Synchronize proportions length with sources size changes
  useEffect(() => {
    if (proportions.length !== sources.length) {
      const equalWeight = 1 / sources.length;
      setProportions(Array(sources.length).fill(equalWeight));
      setSolved(false);
    }
  }, [sources.length]);

  // ---------------------------------
  // 3. COMPUTED BLEND Graduate Values
  // ---------------------------------
  const blendedGradation = useMemo(() => {
    const numSieves = REQUIRED_SIEVES.length;
    const finalBlend = Array(numSieves).fill(0);
    
    for (let s = 0; s < numSieves; s++) {
      for (let src = 0; src < sources.length; src++) {
        finalBlend[s] += proportions[src] * sources[src].passing[s];
      }
    }
    return finalBlend;
  }, [sources, proportions]);

  // ---------------------------------
  // 4. ACTION HANDLERS
  // ---------------------------------
  const triggerOptimize = () => {
    const numSieves = REQUIRED_SIEVES.length;
    const numSources = sources.length;

    // Build the 2D source matrix: numSources * numSieves
    const sourceMatrix = sources.map(src => src.passing);

    const result = optimizeBlend(
      sourceMatrix,
      targetLimits.targets,
      targetLimits.minLimits,
      targetLimits.maxLimits
    );

    if (result.success) {
      setProportions(result.proportions);
      setSolved(true);
      setIsManualMode(false); // Reset to computed optimum
      showNotification("success", "Optimization finished! Found the best aggregate proportions.");
    } else {
      showNotification("warning", "Optimization solver failed to compile a solution.");
    }
  };

  const showNotification = (type: "success" | "info" | "warning", text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(prev => (prev?.text === text ? null : prev));
    }, 6000);
  };

  const handleCustomTargetChange = (idx: number, val: string) => {
    const num = parseFloat(val) || 0;
    const clamped = Math.max(0, Math.min(100, num));
    const nextArr = [...customTargets];
    nextArr[idx] = clamped;
    setCustomTargets(nextArr);
    setSolved(false);
  };

  const handleSourcePassingChange = (sourceIdx: number, sieveIdx: number, val: string) => {
    const num = parseFloat(val);
    const clamped = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
    
    const updatedSources = [...sources];
    updatedSources[sourceIdx] = {
      ...updatedSources[sourceIdx],
      passing: [
        ...updatedSources[sourceIdx].passing.slice(0, sieveIdx),
        clamped,
        ...updatedSources[sourceIdx].passing.slice(sieveIdx + 1),
      ],
    };
    setSources(updatedSources);
    setSolved(false);
  };

  const handleSourceNameChange = (sourceIdx: number, newName: string) => {
    const updatedSources = [...sources];
    updatedSources[sourceIdx] = {
      ...updatedSources[sourceIdx],
      name: newName,
    };
    setSources(updatedSources);
  };

  const deleteSource = (sourceIdx: number) => {
    if (sources.length <= 1) {
      showNotification("warning", "You must keep at least one aggregate source.");
      return;
    }
    const filtered = sources.filter((_, idx) => idx !== sourceIdx);
    setSources(filtered);
    setSolved(false);
  };

  const addSource = () => {
    if (sources.length >= 6) {
      showNotification("warning", "Maximum of 6 aggregate sources reached.");
      return;
    }
    const newId = `source-${Date.now()}`;
    const newSource: AggregateSource = {
      id: newId,
      name: `Source ${sources.length + 1}`,
      passing: Array(REQUIRED_SIEVES.length).fill(100),
    };
    setSources([...sources, newSource]);
    setSolved(false);
  };

  const loadPresetQuarryData = () => {
    setSources([...DEFAULT_PRESET_SOURCES]);
    setSolved(false);
    showNotification("success", "Loaded professional quarry aggregates template successfully.");
  };

  // Safe manual slider adjustments that always maintain 100% sum
  const handleSliderAdjustment = (idx: number, newValuePct: number) => {
    const targetFraction = newValuePct / 100;
    
    if (sources.length === 1) {
      setProportions([1]);
      return;
    }

    const updated = [...proportions];
    updated[idx] = targetFraction;

    const sumOthersOld = proportions.reduce((acc, val, i) => (i === idx ? acc : acc + val), 0);
    const remainingNew = 1 - targetFraction;

    if (sumOthersOld > 0.0001) {
      for (let k = 0; k < updated.length; k++) {
        if (k === idx) continue;
        updated[k] = (proportions[k] / sumOthersOld) * remainingNew;
      }
    } else {
      // If others were zero, divide the remaining weight equally
      const othersCount = updated.length - 1;
      for (let k = 0; k < updated.length; k++) {
        if (k === idx) continue;
        updated[k] = remainingNew / othersCount;
      }
    }

    // Clamp values to absolute zero - 1 range, and normalize to secure exact sum to 1
    const finalSum = updated.reduce((a, b) => a + b, 0);
    const normalized = finalSum > 0 ? updated.map(v => v / finalSum) : updated;
    
    setProportions(normalized);
    setIsManualMode(true);
  };

  // Determine sieve conformance status for UI badges
  const checkSieveStatus = (idx: number, val: number) => {
    const minLim = targetLimits.minLimits[idx];
    const maxLim = targetLimits.maxLimits[idx];
    const tolerance = 1.0; // 1% deviation tolerance for marginal classification

    if (minLim !== null && val < (minLim - tolerance)) {
      return { status: "FAIL_MIN", text: `Under spec (${(minLim - val).toFixed(1)}%)`, variant: "error" };
    }
    if (maxLim !== null && val > (maxLim + tolerance)) {
      return { status: "FAIL_MAX", text: `Over spec (+${(val - maxLim).toFixed(1)}%)`, variant: "error" };
    }
    if ((minLim !== null && val < minLim) || (maxLim !== null && val > maxLim)) {
      return { status: "MARGINAL", text: "Marginal", variant: "warning" };
    }
    return { status: "OK", text: "Conforming", variant: "success" };
  };

  // Overall compliance sum to label the mix code
  const mixComplianceCount = useMemo(() => {
    let fails = 0;
    let marginals = 0;
    
    blendedGradation.forEach((val, idx) => {
      const check = checkSieveStatus(idx, val);
      if (check.variant === "error") fails++;
      if (check.variant === "warning") marginals++;
    });

    return { fails, marginals };
  }, [blendedGradation, targetLimits]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased flex flex-col">
      
      {/* ---------------------------------
          HEADER
          --------------------------------- */}
      <header className="max-w-7xl w-full mx-auto px-4 pt-6 md:pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight text-slate-900">
            Aggregate Job Mix Gradation Analysis
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            id="print-preview-btn"
            type="button"
            onClick={() => setIsPrintPreview(!isPrintPreview)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              isPrintPreview
                ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            {isPrintPreview ? "Edit Parameters" : "Print Gradation Report"}
          </button>
        </div>
      </header>

      {/* Warning regarding printing inside client frames */}
      {isPrintPreview && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-amber-800 text-xs flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Print Report Tip:</strong> Press <kbd className="bg-amber-100 px-1 py-0.5 rounded border border-amber-300 font-mono">Ctrl + P</kbd> to save as PDF. If elements are cut off, change your printing scale accordingly.
            </span>
          </div>
          <button
            type="button"
            className="text-amber-900 font-bold hover:underline"
            onClick={() => window.print()}
          >
            Trigger Save/Print Dialog
          </button>
        </div>
      )}

      {/* ---------------------------------
          NOTIFICATIONS PANEL
          --------------------------------- */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className={`px-6 py-3 border-b-2 text-xs flex items-center justify-between font-sans print:hidden transition-all duration-300 ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                : notification.type === "warning"
                ? "bg-rose-50 border-rose-400 text-rose-800"
                : "bg-violet-50 border-violet-400 text-violet-800"
            }`}
          >
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
              <Info className="w-4 h-4 text-current shrink-0" />
              <p className="font-medium mr-auto">{notification.text}</p>
              <button
                type="button"
                className="opacity-70 hover:opacity-100 font-bold px-2 py-0.5 hover:bg-black/5 rounded transition-all cursor-pointer"
                onClick={() => setNotification(null)}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------
          MAIN APPLICATION BLOCK
          --------------------------------- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* LEFT COLUMN: SETUP INPUTS (Hides or simplifies during print preview) */}
        <section className={`lg:col-span-5 flex flex-col gap-6 md:gap-8 ${isPrintPreview ? "hidden" : ""}`}>
          
          {/* TAB 1: MODE & GRADING SPECIFICATION */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-slate-200 rounded-md text-slate-700">
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <font className="font-display font-semibold text-slate-800 text-sm">
                  1. Target Grading Specifications
                </font>
              </div>
              <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  id="mode-standard-btn"
                  onClick={() => setMode("standard")}
                  className={`px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer ${
                    mode === "standard" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Standard Rules
                </button>
                <button
                  type="button"
                  id="mode-custom-btn"
                  onClick={() => setMode("custom")}
                  className={`px-2.5 py-1 font-medium rounded-md transition-all cursor-pointer ${
                    mode === "custom" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Custom Targets
                </button>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {mode === "standard" ? (
                <>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Road Layer Class
                      </label>
                      <select
                        id="layer-class-select"
                        value={layer}
                        onChange={e => setLayer(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
                      >
                        <option value="subbase">Sub-base course</option>
                        <option value="base">Aggregate Base course</option>
                        <option value="gravel">Gravel Wearing Surface</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Grading Type Mix
                      </label>
                      <select
                        id="spec-type-select"
                        value={specType}
                        onChange={e => setSpecType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
                      >
                        {availableSpecTypes.map(type => (
                          <option key={type} value={type}>
                            {type.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Active Specs Summary (Interpolated mm)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs divide-y divide-slate-100">
                      {REQUIRED_SIEVES.map((sieve, idx) => {
                        const mn = targetLimits.minLimits[idx];
                        const mx = targetLimits.maxLimits[idx];
                        const label = sieve.label;
                        const specString =
                          mn === null && mx === null
                            ? "No limit"
                            : mn !== null && mx !== null
                            ? `${mn}% - ${mx}%`
                            : mn !== null
                            ? `Min ${mn}%`
                            : `Max ${mx}%`;

                        return (
                          <div
                            key={`bound-summary-${label}`}
                            className="flex justify-between items-center pt-1.5"
                          >
                            <span className="text-slate-500 font-medium">{label}:</span>
                            <span className="font-mono font-semibold text-slate-800 text-[11px]">
                              {specString}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3.5">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-2 text-indigo-800">
                    <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold font-display">Custom Specification Mode</p>
                      <p className="text-xs opacity-90 mt-0.5">
                        Set aggregate targets and adjust the tolerance offset (±% bandwidth) below to generate the specification envelope.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Spec Tolerance Offset (±%)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.5"
                        value={customTolerance}
                        onChange={e => {
                          setCustomTolerance(parseFloat(e.target.value));
                          setSolved(false);
                        }}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-ew-resize focus:outline-none"
                      />
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md shrink-0">
                        ±{customTolerance.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {REQUIRED_SIEVES.map((sieve, idx) => (
                      <div key={`custom-input-${sieve.label}`} className="bg-slate-50 border border-slate-200/60 rounded-lg p-2 flex flex-col justify-between">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">{sieve.label}</span>
                        <div className="mt-1 flex items-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={customTargets[idx]}
                            onChange={e => handleCustomTargetChange(idx, e.target.value)}
                            className="bg-white border border-slate-200 text-xs rounded-md w-full py-1 px-1.5 text-slate-800 font-semibold font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 font-semibold ml-1">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TAB 2: AGGREGATE SOURCES INPUT */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs flex-1 flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-slate-200 rounded-md text-slate-700">
                  <Plus className="w-4 h-4" />
                </span>
                <font className="font-display font-semibold text-slate-800 text-sm">
                  2. Aggregate Sources Gradations
                </font>
              </div>
              <button
                id="add-source-btn"
                type="button"
                onClick={addSource}
                disabled={sources.length >= 6}
                className="px-2.5 py-1 text-xs font-semibold text-blue-750 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Source ({sources.length}/6)
              </button>
            </div>

            {/* Matrix Form of sources */}
            <div className="p-5 space-y-5 overflow-y-auto max-h-[480px]">
              {sources.map((src, srcIdx) => (
                <div
                  key={src.id}
                  className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col gap-3.5"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: SOURCE_COLORS[srcIdx % SOURCE_COLORS.length] }}
                      />
                      <input
                        type="text"
                        value={src.name}
                        onChange={e => handleSourceNameChange(srcIdx, e.target.value)}
                        placeholder="e.g. Coarse Sand"
                        className="font-sans font-bold text-slate-800 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none py-0.5 w-full transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSource(srcIdx)}
                      className="p-1 px-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      title="Remove Source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {REQUIRED_SIEVES.map((sieve, idx) => (
                      <div
                        key={`val-input-${src.id}-${idx}`}
                        className="flex flex-col text-center"
                        onMouseEnter={() => setFocusedSieveIdx(idx)}
                        onMouseLeave={() => setFocusedSieveIdx(null)}
                      >
                        <span
                          className={`text-[9px] font-bold select-none transition-colors truncate ${
                            focusedSieveIdx === idx ? "text-blue-600 font-bold" : "text-slate-400"
                          }`}
                        >
                          {sieve.label.split(" ")[0]}
                        </span>
                        <input
                          type="number"
                          id={`source-passing-input-${srcIdx}-${idx}`}
                          min="0"
                          max="100"
                          step="1"
                          value={src.passing[idx]}
                          onChange={e => handleSourcePassingChange(srcIdx, idx, e.target.value)}
                          className={`bg-white border rounded-lg text-[11px] font-mono font-bold text-center py-1 w-full mt-1 outline-none transition-all ${
                            focusedSieveIdx === idx
                              ? "border-blue-500 shadow-2xs ring-2 ring-blue-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MAIN CALCULATION CONTROL */}
          <div className="bg-slate-900 rounded-2xl p-5 shadow-lg relative overflow-hidden text-white">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 bg-white/5 w-40 h-40 rounded-full blur-xl pointer-events-none" />
            <h3 className="font-display font-semibold text-base flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Proportional Mix Optimization
            </h3>
            <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
              Run the optimization algorithm to find the mathematically ideal aggregate weight proportions that fit the specification template.
            </p>
            <button
              id="optimize-mix-btn"
              type="button"
              onClick={triggerOptimize}
              className="mt-5 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm py-3 px-4 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <Sparkles className="w-4 h-4" />
              Optimize Aggregate Mix
            </button>
          </div>

        </section>

        {/* RIGHT COLUMN: CHARTS, WORKBENCH & SPEC SHEETS */}
        <section className={`flex flex-col gap-6 md:gap-8 ${isPrintPreview ? "lg:col-span-12" : "lg:col-span-7"}`}>

          {/* PRINT-ONLY HEADER PREVIEW SHEET */}
          {isPrintPreview && (
            <div className="hidden print:block border-b border-slate-300 pb-5 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display font-bold text-2xl text-slate-900 uppercase">
                    Job Mix Gradation Report
                  </h1>
                  <p className="text-slate-500 text-xs mt-1 font-medium">
                    Calculated on {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-700">Aggregate Blending Optimizer</p>
                  <p className="text-[10px] text-slate-400">Job Mix Optimization System</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Mix Design Type</span>
                  <span className="text-xs font-bold text-slate-800">
                    {mode === "standard" ? `${layer.toUpperCase()} - ${specType.replace("_", " ")}` : "Custom Project Spec"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Aggregate Sources</span>
                  <span className="text-xs font-bold text-slate-800">{sources.map(s => s.name).join(", ")}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Conformance Index</span>
                  <span className="text-xs font-bold text-slate-800">
                    {mixComplianceCount.fails === 0 ? "100% Conforming (OK)" : `${mixComplianceCount.fails} Sieve(s) Failed`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 1. CHART CONTAINER */}
          <SieveChart
            minLimits={targetLimits.minLimits}
            maxLimits={targetLimits.maxLimits}
            targets={targetLimits.targets}
            finalBlend={blendedGradation}
            sources={sources.map((src, idx) => ({
              name: src.name,
              passing: src.passing,
              color: SOURCE_COLORS[idx % SOURCE_COLORS.length],
            }))}
            proportions={proportions}
            showSources={!isPrintPreview} // Hide raw source lines during clear print to highlight the final mix
          />

          {/* 2. PROPORTIONS DISPLAY & RE-SLIDER WORKBENCH */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs print:break-inside-avoid">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  Aggregate Proportions Workbench
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Proportions sum to strictly 100%. Enable manual sliders to fine-tune.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Optimizer State:
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isManualMode
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {isManualMode ? "Manual Override" : "Mathematically Optimal"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {sources.map((src, idx) => {
                  const propPct = proportions[idx] * 100;
                  const color = SOURCE_COLORS[idx % SOURCE_COLORS.length];
                  return (
                    <div
                      key={`prop-stat-${src.id}`}
                      className="rounded-xl border border-slate-200 p-3 bg-slate-50 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wide truncate">
                            {src.name}
                          </span>
                        </div>
                        <div className="text-lg font-mono font-bold text-slate-800">
                          {propPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Slider list */}
              <div className="space-y-3.5 pt-2 border-t border-slate-50">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    Drag proportions to fine-tune:
                  </span>
                  {isManualMode && (
                    <button
                      id="reset-optimal-btn"
                      type="button"
                      onClick={triggerOptimize}
                      className="text-blue-600 hover:text-blue-800 text-[11px] font-bold tracking-wide flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Restore Mathematical Fit
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {sources.map((src, idx) => {
                    const propPct = proportions[idx] * 100 || 0;
                    const color = SOURCE_COLORS[idx % SOURCE_COLORS.length];
                    return (
                      <div key={`slider-wrapper-${src.id}`} className="grid grid-cols-12 items-center gap-3">
                        <span className="col-span-3 text-xs font-semibold text-slate-600 truncate">
                          {src.name}
                        </span>
                        <div className="col-span-7 flex items-center pr-2">
                          <input
                            type="range"
                            id={`slider-input-${idx}`}
                            min="0"
                            max="100"
                            value={propPct}
                            onChange={e => handleSliderAdjustment(idx, parseFloat(e.target.value))}
                            className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-ew-resize focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {propPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 3. SIEVE REPORT COMPLIANCE MATRIX TABLE */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs overflow-hidden flex-1 flex flex-col print:break-inside-avoid">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <div>
                <dt className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Sieve Sizing Compliance Sheet
                </dt>
                <dd className="text-slate-500 text-xs mt-0.5">
                  Aggregate cumulative passing comparison with specification requirements.
                </dd>
              </div>

              {/* Mix Grade Score */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Status Score:
                </span>
                {mixComplianceCount.fails === 0 ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold py-1 px-3 rounded-full flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Approved Mix (OK)
                  </span>
                ) : (
                  <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold py-1 px-3 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Out of Range ({mixComplianceCount.fails} fails)
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="py-2.5 px-3">Sieve Sizing</th>
                    <th className="py-2.5 px-3">Sieve Size (mm)</th>
                    <th className="py-2.5 px-3 text-center">Spec Range</th>
                    <th className="py-2.5 px-3 text-center bg-slate-100/50">Spec Target</th>
                    <th className="py-2.5 px-3 text-center">Blended Mix</th>
                    <th className="py-2.5 px-3 text-center">Deviation</th>
                    <th className="py-2.5 px-3 text-right">Status Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {REQUIRED_SIEVES.map((sieve, idx) => {
                    const mn = targetLimits.minLimits[idx];
                    const mx = targetLimits.maxLimits[idx];
                    const label = sieve.label;
                    const res = blendedGradation[idx];
                    const target = targetLimits.targets[idx];
                    
                    const delta = res - target;
                    const compliance = checkSieveStatus(idx, res);

                    const specRangeStr =
                      mn === null && mx === null
                        ? "No Limit"
                        : mn !== null && mx !== null
                        ? `${mn} - ${mx}`
                        : mn !== null
                        ? `Min ${mn}`
                        : `Max ${mx}`;

                    return (
                      <tr
                        key={`matrix-${label}`}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          focusedSieveIdx === idx ? "bg-blue-50/15" : ""
                        }`}
                        onMouseEnter={() => setFocusedSieveIdx(idx)}
                        onMouseLeave={() => setFocusedSieveIdx(null)}
                      >
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {label}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500 font-semibold">
                          {parseFloat(sieve.sizeMm.toFixed(3))}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-center text-slate-600">
                          {specRangeStr}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-center bg-slate-100/30 text-slate-500">
                          {target.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-center text-slate-900 text-sm">
                          {res.toFixed(2)}%
                        </td>
                        <td className={`py-3 px-3 font-mono font-bold text-center ${
                          delta > 0 ? "text-blue-600" : delta < 0 ? "text-cyan-600" : "text-slate-400"
                        }`}>
                          {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`inline-block py-0.5 px-2.5 rounded-full text-[10px] font-bold border ${
                              compliance.variant === "success"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : compliance.variant === "warning"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                            }`}
                          >
                            {compliance.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>

      {/* ---------------------------------
          FOOTER DETAIL
          --------------------------------- */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-medium text-slate-400 font-display">
            Built by Arman Rahmani
          </p>
          <div className="flex gap-4">
            <span className="text-slate-400">Specification Code: ASTM / AASHTO Compliant</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">Iran Plan & Budget Org Standard Specs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
