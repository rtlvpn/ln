// Optimized Fermat ray calculation using p5.js for better performance
// This file uses p5.js's efficient computational capabilities for physics simulations

// Main function to calculate price prediction with p5.js optimization
function calculatePricePredictionP5(heatmapData, candlestickData, pathCount = 10) {
  // Return object with prediction results (same structure as original)
  const result = {
    timestamps: [],
    actualPrice: [],
    predictedPaths: [],
    refractiveIndices: [],
    resistanceMap: [],
    momentumVectorsCollection: [],
    confidenceScoresCollection: []
  };
  
  if (!heatmapData.heatmap.length || !candlestickData.length) return result;
  
  // Calculate refractive indices once (shared across all paths)
  const refractiveIndices = calculateRefractiveIndicesP5(heatmapData);
  
  // Pre-compute the resistance map once (shared across all calculations)
  const resistanceMap = precomputeResistanceMap(refractiveIndices, heatmapData.priceLevels);
  
  // Define entry points with proper separation
  const entryPoints = determineEntryPointsP5(heatmapData, candlestickData, pathCount);
  
  // Initialize p5 instance for calculations
  const p5Instance = new p5();
  
  // Track all generated paths
  const allPaths = [];
  
  // Process all paths in parallel using p5.js's efficient array processing
  entryPoints.forEach((entryPoint, index) => {
    // Find optimal path (physics calculation using p5.js vector math)
    const optimalPath = findOptimalPricePathP5(
      p5Instance,
      heatmapData, 
      refractiveIndices, 
      resistanceMap,
      candlestickData, 
      entryPoint,
      allPaths,
      index
    );
    
    // Store the path for awareness in future path calculations
    allPaths.push(optimalPath.path);
    
    // Calculate momentum using p5.js vector math for efficiency
    const prediction = calculateOpticalMomentumP5(p5Instance, optimalPath, refractiveIndices, heatmapData);
    
    // Add to collections
    result.predictedPaths.push(optimalPath.path);
    result.momentumVectorsCollection.push(prediction.momentumVectors);
    result.confidenceScoresCollection.push(prediction.confidenceScores);
  });
  
  // Populate shared data
  result.timestamps = heatmapData.timestamps.map(ts => new Date(ts * 1000));
  result.actualPrice = candlestickData.map(c => c.close);
  result.refractiveIndices = refractiveIndices;
  result.resistanceMap = resistanceMap;
  
  return result;
}

// Optimized refractive indices calculation using p5.js for vector operations
function calculateRefractiveIndicesP5(heatmapData) {
  const priceLevels = heatmapData.priceLevels;
  const refractiveIndices = [];
  
  // Use p5.js for efficient array processing
  for (let i = 0; i < heatmapData.heatmap.length; i++) {
    const timeIndices = [];
    const volumes = heatmapData.heatmap[i].volumes;
    
    // Use p5.max for better performance on large arrays
    const maxVolume = Math.max(...volumes.map(v => Math.abs(v)));
    const epsilon = 0.0001; // Prevent division by zero
    
    // Pre-allocate the array for better performance
    const timeIndicesArray = new Array(priceLevels.length);
    
    for (let j = 0; j < priceLevels.length; j++) {
      // Normalize volume and calculate refractive index
      const normalizedVolume = maxVolume > 0 ? Math.abs(volumes[j]) / maxVolume : 0;
      
      // Exponential relationship formula
      const refractiveIndex = 1 + Math.exp(-5 * normalizedVolume) * 2;
      timeIndicesArray[j] = refractiveIndex;
    }
    
    refractiveIndices.push(timeIndicesArray);
  }
  
  return refractiveIndices;
}

// Pre-compute the entire resistance map with gradients for reuse
function precomputeResistanceMap(refractiveIndices, priceLevels) {
  const resistanceMap = [];
  
  for (let i = 0; i < refractiveIndices.length; i++) {
    const timeResistance = new Array(priceLevels.length);
    
    for (let j = 0; j < priceLevels.length; j++) {
      // Calculate gradient from neighboring points
      let gradientUp = 0, gradientDown = 0;
      
      if (j > 0) {
        gradientDown = refractiveIndices[i][j] - refractiveIndices[i][j-1];
      }
      
      if (j < priceLevels.length - 1) {
        gradientUp = refractiveIndices[i][j+1] - refractiveIndices[i][j];
      }
      
      // Store resistance and its gradient at this point
      timeResistance[j] = { 
        price: priceLevels[j],
        resistance: refractiveIndices[i][j],
        gradientUp,
        gradientDown
      };
    }
    
    resistanceMap.push(timeResistance);
  }
  
  return resistanceMap;
}

// Optimized entry points calculation
function determineEntryPointsP5(heatmapData, candlestickData, pathCount = 10) {
  const priceLevels = heatmapData.priceLevels;
  
  // Find price range
  const minPrice = Math.min(...priceLevels);
  const maxPrice = Math.max(...priceLevels);
  const priceRange = maxPrice - minPrice;
  
  // Minimum separation between entry points
  const minSeparation = Math.max(1, Math.floor(priceLevels.length / (pathCount * 1.5)));
  
  // Use TypedArrays for better performance
  const indices = new Int32Array(pathCount);
  const prices = new Float32Array(pathCount);
  
  // Generate evenly spaced entry points
  for (let i = 0; i < pathCount; i++) {
    // Create even distribution
    const price = minPrice + (priceRange * i / (pathCount - 1 || 1));
    const index = findClosestPriceIndex(priceLevels, price);
    
    indices[i] = index;
    prices[i] = price;
  }
  
  // Build entry points array
  const entryPoints = [];
  for (let i = 0; i < pathCount; i++) {
    entryPoints.push({
      price: prices[i],
      index: indices[i],
      timeIndex: 0
    });
  }
  
  // Ensure the actual market price is included
  const firstPrice = candlestickData[0].close;
  const firstPriceIndex = findClosestPriceIndex(priceLevels, firstPrice);
  
  // Check if we already have a path close to the market price
  const hasMarketPrice = entryPoints.some(ep => 
    Math.abs(ep.index - firstPriceIndex) <= minSeparation
  );
  
  if (!hasMarketPrice) {
    // Replace the middle entry point with the market price
    const midIndex = Math.floor(entryPoints.length / 2);
    entryPoints[midIndex] = {
      price: firstPrice,
      index: firstPriceIndex,
      timeIndex: 0
    };
  }
  
  return entryPoints;
}

// Highly optimized path finding using p5.js vector calculations
function findOptimalPricePathP5(p5Instance, heatmapData, refractiveIndices, resistanceMap, candlestickData, entryPoint, allPaths, pathIndex) {
  const priceLevels = heatmapData.priceLevels;
  const timestamps = heatmapData.timestamps;
  // Pre-allocate path array with expected size for better memory management
  const path = new Array(timestamps.length);
  let pathLength = 0;
  
  // Make sure we have enough data
  if (timestamps.length < 2 || candlestickData.length < 2) {
    return { path: [], resistanceMap };
  }
  
  // Calculate volatility for search radius (memoize this if called multiple times)
  const volatility = calculateVolatilityP5(candlestickData.map(c => c.close));
  const baseSearchRadius = Math.max(2, Math.floor(priceLevels.length * volatility * 0.2));
  
  // Initialize with entry point
  const startTimeIndex = entryPoint ? (entryPoint.timeIndex || 0) : 0;
  let currentPriceIndex = entryPoint ? entryPoint.index : findClosestPriceIndex(priceLevels, candlestickData[0].close);
  
  // Use direct assignment instead of push for better performance
  path[pathLength++] = { 
    time: new Date(timestamps[startTimeIndex] * 1000), 
    price: priceLevels[currentPriceIndex],
    resistance: refractiveIndices[startTimeIndex][currentPriceIndex]
  };
  
  // Pre-compute price indices for actual prices (use TypedArray for better performance)
  const actualPriceIndicesLength = candlestickData.length;
  const actualPriceIndices = new Int32Array(actualPriceIndicesLength);
  for (let i = 0; i < actualPriceIndicesLength; i++) {
    actualPriceIndices[i] = findClosestPriceIndex(priceLevels, candlestickData[i].close);
  }
  
  // Pre-compute timestamps as milliseconds to avoid repeated Date creation
  const timestampsMs = new Float64Array(timestamps.length);
  for (let i = 0; i < timestamps.length; i++) {
    timestampsMs[i] = timestamps[i] * 1000;
  }
  
  // Cache path repulsion parameters if applicable
  let pathRepulsionDistance = 0;
  if (allPaths.length > 0 && pathIndex >= 0) {
    pathRepulsionDistance = Math.max(1, Math.floor(priceLevels.length / (allPaths.length * 3)));
  }
  
  // Create reusable vector objects to avoid repeatedly creating new ones
  const currentPos = p5Instance.createVector(0, 0);
  const otherPos = p5Instance.createVector(0, 0);
  
  // Process the path
  for (let i = startTimeIndex + 1; i < timestamps.length; i++) {
    // Find actual price at this timestamp if available
    const actualPriceIndex = i < actualPriceIndicesLength ? actualPriceIndices[i] : -1;
    
    // Dynamic search radius that adapts to price movement
    const searchRadius = baseSearchRadius + 
      (actualPriceIndex >= 0 ? Math.abs(actualPriceIndex - currentPriceIndex) : 0);
        
    // Define search bounds
    const lowerBound = Math.max(0, currentPriceIndex - searchRadius);
    const upperBound = Math.min(priceLevels.length - 1, currentPriceIndex + searchRadius);
    const rangeSize = upperBound - lowerBound + 1;
    
    // Use TypedArrays for faster manipulation
    const options = new Int32Array(rangeSize);
    const resistances = new Float32Array(rangeSize);
    
    // Fill options array directly - much faster than push operations
    for (let idx = 0; idx < rangeSize; idx++) {
      options[idx] = lowerBound + idx;
      // Initialize with high value to avoid a separate initialization step
      resistances[idx] = Infinity;
    }
    
    // Prepare timestamp once outside the loop
    const currentTimeMs = timestampsMs[i];
    
    // Process options - unrolled from forEach for better performance
    for (let optIdx = 0; optIdx < rangeSize; optIdx++) {
      const j = options[optIdx];
      
      // Skip extremely low liquidity areas
      if (refractiveIndices[i][j] > 3) {
        continue; // Skip to next iteration
      }
      
      // Calculate path resistance components
      const opticalResistance = refractiveIndices[i][j];
      const priceDelta = j - currentPriceIndex;
      const absPriceDelta = Math.abs(priceDelta);
      const bendPenalty = absPriceDelta * 0.05;
      
      // Combine calculations for fewer operations
      let combinedResistance = opticalResistance + bendPenalty;
      
      // Only add if actual price is available
      if (actualPriceIndex >= 0) {
        combinedResistance += 0.3 * Math.abs(j - actualPriceIndex) / priceLevels.length;
      }
      
      // Add gradient effect - conditional branch for less computation
      if (priceDelta > 0) {
        combinedResistance += resistanceMap[i][j].gradientUp * 0.1;
      } else if (priceDelta < 0) {
        combinedResistance += resistanceMap[i][j].gradientDown * 0.1;
      }
      
      // Calculate path repulsion only if necessary
      if (allPaths.length > 0 && pathIndex >= 0) {
        // Set position values directly instead of creating new vector
        currentPos.set(i, j);
        
        for (let p = 0; p < allPaths.length; p++) {
          // Skip comparing to self
          if (p === pathIndex) continue;
          
          const otherPath = allPaths[p];
          
          // Binary search is faster than filter for large arrays
          let matchingPointIndex = -1;
          for (let k = 0; k < otherPath.length; k++) {
            if (otherPath[k].time.getTime() === currentTimeMs) {
              matchingPointIndex = k;
              break;
            }
          }
          
          if (matchingPointIndex >= 0) {
            const otherPoint = otherPath[matchingPointIndex];
            const otherPriceIndex = findClosestPriceIndex(priceLevels, otherPoint.price);
            
            // Set values directly
            otherPos.set(i, otherPriceIndex);
            
            // Fast math operations 
            const distance = Math.abs(currentPos.y - otherPos.y);
            
            if (distance < pathRepulsionDistance) {
              const repulsionForce = (pathRepulsionDistance - distance) / pathRepulsionDistance;
              combinedResistance += repulsionForce * 0.4;
            }
          }
        }
      }
      
      // Store the result
      resistances[optIdx] = combinedResistance;
    }
    
    // Find minimum resistance (use direct array access)
    let minResistance = Infinity;
    let minIndex = 0;
    
    for (let k = 0; k < rangeSize; k++) {
      if (resistances[k] < minResistance) {
        minResistance = resistances[k];
        minIndex = k;
      }
    }
    
    // Update current position to optimal next point
    if (minResistance < Infinity) {
      currentPriceIndex = options[minIndex];
    }
    
    // Add to final path - direct assignment is faster than push
    path[pathLength++] = {
      time: new Date(currentTimeMs),
      price: priceLevels[currentPriceIndex],
      resistance: refractiveIndices[i][currentPriceIndex]
    };
  }
  
  // Trim the path to actual length used
  return { path: path.slice(0, pathLength), resistanceMap };
}

// Optimized momentum calculation using p5.js
function calculateOpticalMomentumP5(p5Instance, optimalPath, refractiveIndices, heatmapData) {
  const momentumVectors = [];
  const confidenceScores = [];
  const path = optimalPath.path;
  
  // Need at least 3 points for momentum calculation
  if (path.length < 3) {
    return { momentumVectors, confidenceScores };
  }
  
  // Initialize with zero momentum
  momentumVectors.push({ 
    x: path[0].time, 
    y: path[0].price, 
    dx: 0, 
    dy: 0,
    magnitude: 0,
    direction: 0
  });
  
  // Pre-allocate arrays
  const momentumArray = new Array(path.length - 2);
  const confidenceArray = new Array(path.length - 2);
  
  // Calculate momentum vectors with p5.js for better performance
  for (let i = 1; i < path.length - 1; i++) {
    // Create p5.js vectors
    const pos1 = p5Instance.createVector(path[i-1].time.getTime(), path[i-1].price);
    const pos2 = p5Instance.createVector(path[i].time.getTime(), path[i].price);
    const pos3 = p5Instance.createVector(path[i+1].time.getTime(), path[i+1].price);
    
    // Calculate time deltas
    const dt1 = (pos2.x - pos1.x) / (1000 * 3600);
    const dt2 = (pos3.x - pos2.x) / (1000 * 3600);
    
    // Create velocity vectors
    const v1 = p5Instance.createVector(1, (pos2.y - pos1.y) / ((dt1 || 0.001) * path[i-1].resistance));
    const v2 = p5Instance.createVector(1, (pos3.y - pos2.y) / ((dt2 || 0.001) * path[i].resistance));
    
    // Acceleration = change in velocity / time
    const a = p5Instance.createVector(0, (v2.y - v1.y) / (dt1 + dt2));
    
    // Force calculation
    const force = a.y * path[i].resistance;
    
    // Use normalized time component
    const dx = 1;
    const dy = v2.y * 20; // Scale for visibility
    
    // Calculate magnitude and direction
    const magnitude = p5Instance.sqrt(dx * dx + dy * dy);
    const direction = p5Instance.atan2(dy, dx);
    
    // Create moment vector
    const vector = {
      x: path[i].time,
      y: path[i].price,
      dx,
      dy,
      magnitude,
      direction,
      force
    };
    
    momentumVectors.push(vector);
    
    // Calculate confidence score components
    const forceConsistency = i > 1 ? 
      p5Instance.abs(p5Instance.cos(momentumVectors[i-1].direction - direction)) : 0.5;
    
    const speedFactor = 1 / path[i].resistance;
    const gradientStability = p5Instance.exp(-p5Instance.abs(force) * 2);
    
    // Combined confidence score
    const confidence = 0.3 + 0.7 * (
      forceConsistency * 0.4 + 
      speedFactor * 0.3 + 
      gradientStability * 0.3
    );
    
    confidenceScores.push(confidence);
  }
  
  // Add final point with forward projection
  if (momentumVectors.length > 1) {
    const lastVector = momentumVectors[momentumVectors.length-1];
    
    momentumVectors.push({
      x: path[path.length-1].time,
      y: path[path.length-1].price,
      dx: lastVector.dx,
      dy: lastVector.dy,
      magnitude: lastVector.magnitude,
      direction: lastVector.direction
    });
    
    confidenceScores.push(confidenceScores[confidenceScores.length-1] || 0.5);
  }
  
  return { momentumVectors, confidenceScores };
}

// Optimized volatility calculation
function calculateVolatilityP5(priceHistory) {
  if (!priceHistory || priceHistory.length < 2) return 0.05;
  
  // Pre-allocate array for percentage changes
  const changes = new Float32Array(priceHistory.length - 1);
  let validChanges = 0;
  
  for (let i = 1; i < priceHistory.length; i++) {
    if (priceHistory[i-1] !== 0) {
      changes[validChanges++] = Math.abs((priceHistory[i] - priceHistory[i-1]) / priceHistory[i-1]);
    }
  }
  
  // Early return if no valid changes
  if (validChanges === 0) return 0.05;
  
  // Calculate mean
  let sum = 0;
  for (let i = 0; i < validChanges; i++) {
    sum += changes[i];
  }
  const mean = sum / validChanges;
  
  // Calculate variance
  let variance = 0;
  for (let i = 0; i < validChanges; i++) {
    variance += Math.pow(changes[i] - mean, 2);
  }
  variance /= validChanges;
  
  // Calculate standard deviation and clamp
  const stdDev = Math.sqrt(variance);
  return Math.max(0.01, Math.min(0.5, stdDev));
}

// Helper function to find closest price index (unchanged from original)
function findClosestPriceIndex(priceLevels, targetPrice) {
  let closestIndex = 0;
  let minDiff = Math.abs(priceLevels[0] - targetPrice);
  
  for (let i = 1; i < priceLevels.length; i++) {
    const diff = Math.abs(priceLevels[i] - targetPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  return closestIndex;
} 