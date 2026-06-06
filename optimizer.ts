/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LimitTuple, SIEVES_DB_MM, STANDARDS, REQUIRED_SIEVES } from "./types";

/**
 * Linearly interpolates a value.
 */
export function linearInterpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x2 - x1 === 0) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

/**
 * Calculates target limits interpolated to our required sieve sizes.
 * Replicates the Python log_interpolate or linear_interpolate logic.
 */
export function getTargetLimitsInterpolated(
  layerType: string, // "subbase", "base", "gravel"
  specName: string,   // e.g. "Type_B"
  requiredSieveSizes: number[] = REQUIRED_SIEVES.map(s => s.sizeMm)
): { minLimits: (number | null)[]; maxLimits: (number | null)[] } {
  
  // Find which category in STANDARDS corresponds to this key path
  let standardCategoryKey = "Sub-base";
  if (layerType === "base") standardCategoryKey = "Base";
  if (layerType === "gravel") standardCategoryKey = "Gravel_Surface";

  const rawSizes = SIEVES_DB_MM[layerType];
  const rawLimits = STANDARDS[standardCategoryKey][specName];

  if (!rawSizes || !rawLimits) {
    return {
      minLimits: Array(requiredSieveSizes.length).fill(null),
      maxLimits: Array(requiredSieveSizes.length).fill(null),
    };
  }

  const finalMin: (number | null)[] = [];
  const finalMax: (number | null)[] = [];

  for (const reqSize of requiredSieveSizes) {
    // 1. Direct match check (with small epsilon)
    let foundDirect = false;
    for (let i = 0; i < rawSizes.length; i++) {
      if (Math.abs(rawSizes[i] - reqSize) < 0.001) {
        finalMin.push(rawLimits[i][0]);
        finalMax.push(rawLimits[i][1]);
        foundDirect = true;
        break;
      }
    }

    if (foundDirect) {
      continue;
    }

    // 2. Interpolation
    // Filter valid lists of points
    const vMinX: number[] = [];
    const vMinY: number[] = [];
    const vMaxX: number[] = [];
    const vMaxY: number[] = [];

    for (let i = 0; i < rawSizes.length; i++) {
      const mn = rawLimits[i][0];
      const mx = rawLimits[i][1];
      if (mn !== null) {
        vMinX.push(rawSizes[i]);
        vMinY.push(mn);
      }
      if (mx !== null) {
        vMaxX.push(rawSizes[i]);
        vMaxY.push(mx);
      }
    }

    const interpolate = (x: number, xList: number[], yList: number[]): number | null => {
      if (xList.length === 0) return null;

      const ups = xList.map((val, idx) => ({ val, idx })).filter(item => item.val > x);
      const lows = xList.map((val, idx) => ({ val, idx })).filter(item => item.val < x);

      // If no values are greater, returns corresponding value to minimum size in database
      if (ups.length === 0) {
        const minVal = Math.min(...xList);
        return yList[xList.indexOf(minVal)];
      }
      
      // If no values are smaller, returns corresponding value to maximum size in database
      if (lows.length === 0) {
        const maxVal = Math.max(...xList);
        return yList[xList.indexOf(maxVal)];
      }

      // Find closest neighbors
      // x2 is the smallest of the ups (closest larger neighbor)
      const x2Item = ups.reduce((prev, curr) => (curr.val < prev.val ? curr : prev), ups[0]);
      // x1 is the largest of the lows (closest smaller neighbor)
      const x1Item = lows.reduce((prev, curr) => (curr.val > prev.val ? curr : prev), lows[0]);

      const x2 = x2Item.val;
      const x1 = x1Item.val;
      const y2 = yList[x2Item.idx];
      const y1 = yList[x1Item.idx];

      return linearInterpolate(x, x1, y1, x2, y2);
    };

    const roundToTwo = (val: number | null): number | null => {
      if (val === null) return null;
      return Math.round(val * 100) / 100;
    };

    finalMin.push(roundToTwo(interpolate(reqSize, vMinX, vMinY)));
    finalMax.push(roundToTwo(interpolate(reqSize, vMaxX, vMaxY)));
  }

  return { minLimits: finalMin, maxLimits: finalMax };
}

/**
 * Objective function used to calculate mix blend mismatch.
 * Matches scipy.optimize minimize objective.
 */
export function computeObjective(
  proportions: number[], // N sources weights, sum to 1
  sourceData: number[][], // N x M matrix (sources x sieves)
  targets: number[],      // M target midpoints
  minLimits: (number | null)[], // M min limits
  maxLimits: (number | null)[]  // M max limits
): number {
  const numSieves = targets.length;
  const numSources = proportions.length;

  // Calculate Blend for each sieve
  const blend: number[] = Array(numSieves).fill(0);
  for (let s = 0; s < numSieves; s++) {
    for (let src = 0; src < numSources; src++) {
      blend[s] += proportions[src] * sourceData[src][s];
    }
  }

  // 1. Basic Least Squares Error (Distance from Target Midpoint)
  let error = 0;
  for (let s = 0; s < numSieves; s++) {
    error += Math.pow(blend[s] - targets[s], 2);
  }

  // 2. Soft Limit Penalty (Replaces Hard Constraints)
  const penaltyWeight = 1000;
  for (let s = 0; s < numSieves; s++) {
    const minLim = minLimits[s];
    const maxLim = maxLimits[s];

    if (minLim !== null && blend[s] < minLim) {
      error += penaltyWeight * Math.pow(minLim - blend[s], 2);
    }
    if (maxLim !== null && blend[s] > maxLim) {
      error += penaltyWeight * Math.pow(blend[s] - maxLim, 2);
    }
  }

  return error;
}

/**
 * Optimizer solving the aggregate blending problem under a simplex constraint:
 * proportions >= 0, sum(proportions) = 1.
 * Uses a Coordinate Descent Simplex-preserving local search with cooling step size.
 */
export function optimizeBlend(
  sourceData: number[][],        // N sources * M sieves matrix
  targets: number[],             // M target values
  minLimits: (number | null)[],  // M min boundaries
  maxLimits: (number | null)[]   // M max boundaries
): { proportions: number[]; finalBlend: number[]; error: number; success: boolean } {
  const numSources = sourceData.length;
  const numSieves = targets.length;

  if (numSources === 0) {
    return { proportions: [], finalBlend: Array(numSieves).fill(0), error: 0, success: false };
  }

  // Set of candidates to test as initial points to safeguard against local minima
  const initialPoints: number[][] = [];
  
  // 1. Flat equal weights
  initialPoints.push(Array(numSources).fill(1 / numSources));

  // 2. Pure components if more than 1
  if (numSources > 1) {
    for (let i = 0; i < numSources; i++) {
      const pure = Array(numSources).fill(0);
      pure[i] = 1.0;
      initialPoints.push(pure);
    }
  }

  let bestGlobalProps = Array(numSources).fill(1 / numSources);
  let bestGlobalError = Infinity;

  // Run solver from each initial point and pick overall best
  for (const startProps of initialPoints) {
    let props = [...startProps];
    let currentScore = computeObjective(props, sourceData, targets, minLimits, maxLimits);

    let step = 0.25; // 25% initial weight adjustment step
    const minStep = 1e-8;
    const dampingFactor = 0.70;

    let iterationsWithoutImprovement = 0;
    while (step > minStep && iterationsWithoutImprovement < 1000) {
      let improved = false;

      // Try transfer of weight from source `i` to source `j`
      for (let i = 0; i < numSources; i++) {
        for (let j = 0; j < numSources; j++) {
          if (i === j) continue;
          if (props[i] <= 0) continue; // No weight to subtract

          // Calculate actual step we can take
          const actualStep = Math.min(step, props[i]);
          if (actualStep < 1e-10) continue;

          // Attempt shift
          const candidate = [...props];
          candidate[i] -= actualStep;
          candidate[j] += actualStep;

          const scoreCandidate = computeObjective(
            candidate,
            sourceData,
            targets,
            minLimits,
            maxLimits
          );

          if (scoreCandidate < currentScore - 1e-10) {
            props = candidate;
            currentScore = scoreCandidate;
            improved = true;
          }
        }
      }

      if (improved) {
        iterationsWithoutImprovement = 0;
      } else {
        step *= dampingFactor;
        iterationsWithoutImprovement++;
      }
    }

    if (currentScore < bestGlobalError) {
      bestGlobalError = currentScore;
      bestGlobalProps = props;
    }
  }

  // Refine results to remove tiny floating point elements (e.g. 1e-15) and normalize to strictly equal 1.00
  let cleanedProps = bestGlobalProps.map(v => (v < 1e-5 ? 0 : v));
  const sumProps = cleanedProps.reduce((a, b) => a + b, 0);
  if (sumProps > 0) {
    cleanedProps = cleanedProps.map(v => v / sumProps);
  } else {
    // Fallback if all got cleaned out
    cleanedProps = Array(numSources).fill(0);
    cleanedProps[0] = 1.0;
  }

  // Compute final blend passings
  const finalBlend: number[] = Array(numSieves).fill(0);
  for (let s = 0; s < numSieves; s++) {
    for (let src = 0; src < numSources; src++) {
      finalBlend[s] += cleanedProps[src] * sourceData[src][s];
    }
  }

  return {
    proportions: cleanedProps,
    finalBlend,
    error: bestGlobalError,
    success: true,
  };
}
