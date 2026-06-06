/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SieveRequirement {
  label: string;
  sizeMm: number;
}

export const REQUIRED_SIEVES: SieveRequirement[] = [
  { label: "19 mm", sizeMm: 19.0 },
  { label: "12.5 mm", sizeMm: 12.5 },
  { label: "#4 (4.75mm)", sizeMm: 4.75 },
  { label: "#10 (2mm)", sizeMm: 2.00 },
  { label: "#40 (0.425mm)", sizeMm: 0.425 },
  { label: "#80 (0.18mm)", sizeMm: 0.180 },
  { label: "#200 (0.075mm)", sizeMm: 0.075 },
];

export const SIEVES_DB_MM: Record<string, number[]> = {
  subbase: [75, 62.5, 50, 37.5, 25, 9.5, 4.75, 2.00, 0.425, 0.075],
  base:    [50, 37.5, 25, 19, 9.5, 4.75, 2.00, 0.425, 0.075],
  gravel:  [25, 9.5, 4.75, 2.00, 0.425, 0.075]
};

export type LimitTuple = [number | null, number | null];

export const STANDARDS: Record<string, Record<string, LimitTuple[]>> = {
  "Sub-base": {
    "Type_ALEF": [
      [null, null], [null, null], [null, null], [100, 100], [null, null],
      [null, null], [30, 70], [null, null], [null, null], [0, 5]
    ],
    "Type_B": [
      [null, null], [null, null], [100, 100], [null, null], [null, null],
      [30, 65], [25, 55], [15, 40], [8, 20], [2, 8]
    ],
    "Type_G": [
      [null, null], [null, null], [100, 100], [null, null], [75, 95],
      [40, 75], [30, 60], [20, 45], [15, 30], [5, 20]
    ],
    "Type_D": [
      [null, null], [null, null], [null, null], [null, null], [100, 100],
      [50, 85], [35, 65], [25, 50], [15, 30], [5, 15]
    ],
    "Type_H": [
      [null, null], [null, null], [null, null], [null, null], [100, 100],
      [60, 100], [50, 85], [40, 70], [25, 45], [5, 20]
    ],
    "Type_V": [
      [null, null], [null, null], [null, null], [null, null], [100, 100],
      [null, null], [55, 100], [40, 100], [20, 50], [6, 20]
    ],
    "Type_Z": [
      [null, null], [null, null], [null, null], [null, null], [100, 100],
      [null, null], [70, 100], [55, 100], [30, 70], [8, 25]
    ],
    "Type_HA": [
      [100, 100], [95, 100], [null, null], [null, null], [null, null],
      [null, null], [35, 70], [null, null], [null, null], [0, 20]
    ],
  },
  "Base": {
    "Type_I": [
      [100, 100], [null, null], [null, null], [null, null], [null, null],
      [20, 50], [null, null], [null, null], [0, 10]
    ],
    "Type_II": [
      [100, 100], [70, 100], [55, 85], [50, 80], [40, 70],
      [30, 60], [20, 50], [10, 30], [5, 15]
    ],
    "Type_III": [
      [null, null], [100, 100], [null, null], [null, null], [null, null],
      [25, 55], [null, null], [null, null], [0, 10]
    ],
    "Type_IV": [
      [null, null], [100, 100], [70, 100], [60, 90], [45, 75],
      [30, 60], [20, 50], [10, 30], [5, 15]
    ],
    "Type_V": [
      [null, null], [null, null], [100, 100], [null, null], [null, null],
      [35, 65], [null, null], [null, null], [0, 10]
    ],
    "Type_VI": [
      [null, null], [null, null], [100, 100], [70, 100], [50, 80],
      [35, 65], [20, 50], [15, 30], [5, 15]
    ],
    "Type_VII": [
      [null, null], [null, null], [null, null], [100, 100], [null, null],
      [35, 65], [null, null], [null, null], [0, 10]
    ],
    "Type_VIII": [
      [null, null], [null, null], [null, null], [100, 100], [null, null],
      [45, 80], [30, 60], [20, 35], [5, 15]
    ],
  },
  "Gravel_Surface": {
    "Type_ALEF": [
      [100, 100], [50, 85], [35, 65], [25, 50], [15, 30], [8, 15]
    ],
    "Type_B": [
      [100, 100], [60, 100], [50, 85], [40, 70], [25, 45], [8, 20]
    ],
    "Type_G": [
      [100, 100], [null, null], [55, 100], [40, 100], [20, 50], [8, 20]
    ],
    "Type_D": [
      [100, 100], [null, null], [70, 100], [55, 100], [30, 70], [8, 25]
    ],
  }
};

export interface AggregateSource {
  id: string;
  name: string;
  passing: number[]; // Index aligned with REQUIRED_SIEVES
}

export interface OptimizationResult {
  proportions: number[]; // Sum to 1.0
  finalBlend: number[];  // Blended percentages passing
  error: number;         // Objective score
  success: boolean;
  statusMessage?: string;
}
