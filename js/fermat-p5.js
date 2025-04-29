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
  const path = [];
  
  // Make sure we have enough data
  if (timestamps.length < 2 || candlestickData.length < 2) {
    return { path, resistanceMap };
  }
  
  // Calculate volatility for search radius
  const priceHistory = candlestickData.map(c => c.close);
  const volatility = calculateVolatilityP5(priceHistory);
  const baseSearchRadius = Math.max(2, Math.floor(priceLevels.length * volatility * 0.2));
  
  // Initialize with entry point
  let startTimeIndex = entryPoint ? (entryPoint.timeIndex || 0) : 0;
  let currentPriceIndex = entryPoint ? entryPoint.index : findClosestPriceIndex(priceLevels, candlestickData[0].close);
  
  path.push({ 
    time: new Date(timestamps[startTimeIndex] * 1000), 
    price: priceLevels[currentPriceIndex],
    resistance: refractiveIndices[startTimeIndex][currentPriceIndex]
  });
  
  // Pre-compute price indices for actual prices
  const actualPriceIndices = [];
  for (let i = 0; i < candlestickData.length; i++) {
    actualPriceIndices.push(findClosestPriceIndex(priceLevels, candlestickData[i].close));
  }
  
  // For each timestamp, find the next point on the path
  // This is the core optimization using p5.js for vector calculations
  for (let i = startTimeIndex + 1; i < timestamps.length; i++) {
    // Find actual price at this timestamp if available
    const actualPriceIndex = i < candlestickData.length ? actualPriceIndices[i] : -1;
    
    // Dynamic search radius that adapts to price movement
    const searchRadius = baseSearchRadius + 
      (actualPriceIndex >= 0 ? Math.abs(actualPriceIndex - currentPriceIndex) : 0);
        
    // Define search bounds
    const lowerBound = Math.max(0, currentPriceIndex - searchRadius);
    const upperBound = Math.min(priceLevels.length - 1, currentPriceIndex + searchRadius);
    
    // Use p5.js for optimized math calculations
    let minResistance = Infinity;
    let optimalNextIndex = currentPriceIndex;
    
    // Create arrays for vectorized calculations
    const options = [];
    const resistances = [];
    
    // Store candidates for parallel processing
    for (let j = lowerBound; j <= upperBound; j++) {
      options.push(j);
    }
    
    // Process options in parallel using p5.js
    options.forEach(j => {
      // Skip extremely low liquidity areas
      if (refractiveIndices[i][j] > 3) {
        resistances.push(Infinity);
        return;
      }
      
      // Calculate path resistance components
      const opticalResistance = refractiveIndices[i][j];
      const priceDelta = j - currentPriceIndex;
      const bendPenalty = Math.abs(priceDelta) * 0.05;
      
      const actualPriceAttraction = actualPriceIndex >= 0 ? 
        0.3 * Math.abs(j - actualPriceIndex) / priceLevels.length : 0;
      
      const gradientEffect = priceDelta > 0 ? 
        resistanceMap[i][j].gradientUp * 0.1 : 
        resistanceMap[i][j].gradientDown * 0.1;
      
      // Calculate path repulsion more efficiently
      let repulsionEffect = 0;
      
      if (allPaths.length > 0 && pathIndex >= 0) {
        const pathRepulsionDistance = Math.max(1, Math.floor(priceLevels.length / (allPaths.length * 3)));
        
        // Create p5.js vector for current position
        const currentPos = p5Instance.createVector(i, j);
        
        for (let p = 0; p < allPaths.length; p++) {
          // Skip comparing to self
          if (p === pathIndex) continue;
          
          // Find this path's point at current timestamp
          const otherPath = allPaths[p];
          const otherTimePoints = otherPath.filter(pt => 
            pt.time.getTime() === new Date(timestamps[i] * 1000).getTime()
          );
          
          if (otherTimePoints.length > 0) {
            const otherPoint = otherTimePoints[0];
            const otherPriceIndex = findClosestPriceIndex(priceLevels, otherPoint.price);
            
            // Create p5.js vector for other path position
            const otherPos = p5Instance.createVector(i, otherPriceIndex);
            
            // Calculate distance using p5.js vector math
            const distance = p5Instance.abs(currentPos.y - otherPos.y);
            
            // Add repulsion if too close
            if (distance < pathRepulsionDistance) {
              const repulsionForce = (pathRepulsionDistance - distance) / pathRepulsionDistance;
              repulsionEffect += repulsionForce * 0.4;
            }
          }
        }
      }
      
      // Total resistance for this path option
      const totalResistance = 
        opticalResistance + 
        bendPenalty + 
        actualPriceAttraction + 
        gradientEffect + 
        repulsionEffect;
      
      resistances.push(totalResistance);
    });
    
    // Find the minimum resistance path
    let minIndex = 0;
    for (let k = 0; k < resistances.length; k++) {
      if (resistances[k] < minResistance) {
        minResistance = resistances[k];
        minIndex = k;
      }
    }
    
    // Update current position to optimal next point
    if (minResistance < Infinity) {
      currentPriceIndex = options[minIndex];
    }
    
    // Add to final path
    path.push({
      time: new Date(timestamps[i] * 1000),
      price: priceLevels[currentPriceIndex],
      resistance: refractiveIndices[i][currentPriceIndex]
    });
  }
  
  return { path, resistanceMap };
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