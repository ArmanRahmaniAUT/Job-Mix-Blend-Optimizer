/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { REQUIRED_SIEVES, SieveRequirement } from "../types";

interface SieveChartProps {
  minLimits: (number | null)[];
  maxLimits: (number | null)[];
  targets: number[];
  finalBlend: number[];
  sources: { name: string; passing: number[]; color: string }[];
  proportions: number[]; // 0-1 range
  showSources?: boolean;
}

export default function SieveChart({
  minLimits,
  maxLimits,
  targets,
  finalBlend,
  sources,
  proportions,
  showSources = true,
}: SieveChartProps) {
  const [scaleType, setScaleType] = useState<"log" | "linear">("log");

  // Chart Dimensions
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 75;
  const width = 800;
  const height = 450;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Sieve sizes and limits
  const sieves: SieveRequirement[] = REQUIRED_SIEVES;
  const sizes = sieves.map(s => s.sizeMm);
  const minSize = 0.075;
  const maxSize = 19.0;

  // Helper to scale Y (Percent Passing: 0 to 100)
  // 100% is at the top (paddingTop), 0% is at the bottom (paddingTop + chartHeight)
  const scaleY = (percentage: number) => {
    const clamped = Math.max(0, Math.min(100, percentage));
    return paddingTop + chartHeight - (clamped / 100) * chartHeight;
  };

  // Helper to scale X
  const scaleX = (size: number) => {
    if (scaleType === "linear") {
      const fraction = (size - minSize) / (maxSize - minSize);
      return paddingLeft + fraction * chartWidth;
    } else {
      // Logarithmic Scale
      const logMin = Math.log10(minSize);
      const logMax = Math.log10(maxSize);
      const logVal = Math.log10(size);
      const fraction = (logVal - logMin) / (logMax - logMin);
      return paddingLeft + fraction * chartWidth;
    }
  };

  // Generate SVG path for a continuous line
  const generatePathData = (data: number[]) => {
    return data
      .map((val, idx) => {
        const x = scaleX(sizes[idx]);
        const y = scaleY(val);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  // Generate SVG path for limits (fill envelope)
  const generateEnvelopePathData = () => {
    const points: string[] = [];

    // Forward path for Min limits (bottom of envelope)
    for (let i = 0; i < sieves.length; i++) {
      const val = minLimits[i] !== null ? (minLimits[i] as number) : 0;
      points.push(`${scaleX(sizes[i])},${scaleY(val)}`);
    }

    // Backward path for Max limits (top of envelope)
    for (let i = sieves.length - 1; i >= 0; i--) {
      const val = maxLimits[i] !== null ? (maxLimits[i] as number) : 100;
      points.push(`${scaleX(sizes[i])},${scaleY(val)}`);
    }

    if (points.length === 0) return "";
    return `M ${points.join(" L ")} Z`;
  };

  // Generate ticks for Y axis
  const yTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-slate-100 gap-4">
        <div>
          <h3 className="font-display font-semibold text-slate-800 text-lg">
            Sieve Gradation Curve Chart
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Visualization of aggregate particle size distribution vs specification envelope.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            id="toggle-log-scale-btn"
            type="button"
            onClick={() => setScaleType("log")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              scaleType === "log"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Log Scale (Sieve standard)
          </button>
          <button
            id="toggle-linear-scale-btn"
            type="button"
            onClick={() => setScaleType("linear")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              scaleType === "linear"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Linear Scale
          </button>
        </div>
      </div>

      <div className="relative w-full overflow-visible p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
            {/* Background Grid Lines (Horizontal) */}
            {yTicks.map(tick => (
              <g key={`grid-y-${tick}`}>
                <line
                  x1={paddingLeft}
                  y1={scaleY(tick)}
                  x2={width - paddingRight}
                  y2={scaleY(tick)}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                />
                <text
                  x={paddingLeft - 12}
                  y={scaleY(tick) + 4}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-slate-400 font-medium"
                >
                  {tick}%
                </text>
              </g>
            ))}

            {/* Sieve Grid Lines (Verticals with labels) */}
            {sieves.map((sieve, idx) => {
              const xCoord = scaleX(sieve.sizeMm);
              return (
                <g key={`grid-x-${sieve.sizeMm}`}>
                  <line
                    x1={xCoord}
                    y1={paddingTop}
                    x2={xCoord}
                    y2={paddingTop + chartHeight}
                    stroke="#f1f5f9"
                    strokeWidth={1.5}
                  />
                  {/* Sieve Size bottom label */}
                  <g transform={`translate(${xCoord}, ${paddingTop + chartHeight + 15})`}>
                    <text
                      transform="rotate(-40)"
                      textAnchor="end"
                      className="font-sans text-[10px] fill-slate-500 font-medium"
                    >
                      {sieve.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Target Spec Limit Envelope (Shaded Green Area if limits defined) */}
            {minLimits.some(l => l !== null) && maxLimits.some(l => l !== null) && (
              <path
                d={generateEnvelopePathData()}
                fill="#f0fdf4"
                stroke="#bbf7d0"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                opacity={0.85}
              />
            )}

            {/* Target Midpoints Curve */}
            <path
              d={generatePathData(targets)}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={2}
              strokeDasharray="5 5"
            />

            {/* Individual Source Curves (Optional) */}
            {showSources &&
              sources.map((src, srcIdx) => {
                const prop = proportions[srcIdx] || 0;
                if (prop <= 0.01) return null; // Don't crowd the chart if component is barely used
                return (
                  <g key={`source-curve-${src.name}`}>
                    <path
                      d={generatePathData(src.passing)}
                      fill="none"
                      stroke={src.color}
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      opacity={0.5}
                    />
                    {src.passing.map((val, idx) => (
                      <circle
                        key={`source-dot-${src.name}-${idx}`}
                        cx={scaleX(sizes[idx])}
                        cy={scaleY(val)}
                        r={3}
                        fill={src.color}
                        opacity={0.5}
                      />
                    ))}
                  </g>
                );
              })}

            {/* Final Blend Curve */}
            <path
              d={generatePathData(finalBlend)}
              fill="none"
              stroke="#2563eb" // Royal Blue
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Final Blend Dots */}
            {finalBlend.map((val, idx) => (
              <circle
                key={`blend-dot-${idx}`}
                cx={scaleX(sizes[idx])}
                cy={scaleY(val)}
                r={6}
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth={2.5}
                className="shadow-sm filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
              />
            ))}

            {/* Legend Group */}
            <g transform={`translate(${paddingLeft + 15}, ${paddingTop + 15})`}>
              {/* Outer border for legend card */}
              <rect
                width={195}
                height={minLimits.some(l => l !== null) ? (showSources ? 100 : 65) : (showSources ? 80 : 45)}
                rx={6}
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth={1}
                className="shadow-xs"
                opacity={0.95}
              />

              <g transform="translate(12, 18)">
                {/* Final Blend Indicator */}
                <line x1={0} y1={0} x2={20} y2={0} stroke="#2563eb" strokeWidth={4} />
                <circle cx={10} cy={0} r={4.5} fill="#2563eb" stroke="#ffffff" strokeWidth={1} />
                <text x={30} y={4} className="font-sans text-xs font-semibold fill-slate-800">
                  Optimized Blend
                </text>
              </g>

              <g transform="translate(12, 38)">
                {/* Target Midpoint */}
                <line x1={0} y1={0} x2={20} y2={0} stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 4" />
                <text x={30} y={4} className="font-sans text-xs fill-slate-600">
                  Target (Midpoint)
                </text>
              </g>

              {minLimits.some(l => l !== null) && (
                <g transform="translate(12, 58)">
                  {/* Spec envelope */}
                  <rect x={0} y={-6} width={20} height={12} fill="#f0fdf4" stroke="#bbf7d0" strokeDasharray="3 3" />
                  <text x={30} y={4} className="font-sans text-xs fill-emerald-700 font-medium">
                    Specification Envelope
                  </text>
                </g>
              )}

              {showSources && (
                <g transform={`translate(12, ${minLimits.some(l => l !== null) ? 78 : 58})`}>
                  {/* Sources curves indicator */}
                  <line x1={0} y1={0} x2={20} y2={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 2" />
                  <text x={30} y={4} className="font-sans text-xs fill-slate-500">
                    Aggregate Components
                  </text>
                </g>
              )}
            </g>

            {/* Y-axis Label */}
            <text
              transform="rotate(-90)"
              x={-(paddingTop + chartHeight / 2)}
              y={20}
              textAnchor="middle"
              className="font-sans text-xs fill-slate-500 font-medium tracking-wide"
            >
              PERCENT PASSING (%)
            </text>

            {/* X-axis Label */}
            <text
              x={paddingLeft + chartWidth / 2}
              y={height - 15}
              textAnchor="middle"
              className="font-sans text-xs fill-slate-500 font-medium tracking-wide"
            >
              SIEVE SIZE (mm)
            </text>

            {/* Standard Chart Borders */}
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={paddingTop + chartHeight}
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight}
              x2={width - paddingRight}
              y2={paddingTop + chartHeight}
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
          </svg>
        </div>
      </div>
  );
}
