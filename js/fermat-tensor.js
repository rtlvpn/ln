// Optimized Fermat ray calculation using TensorFlow.js for GPU accelerated computation
// This file provides GPU-accelerated versions of the p5.js implementation

// Direct TensorFlow.js access since we added it to the head
let gpuAvailable = false;
let tensorEnabled = false;

// Initialize TensorFlow.js
async function initTensorFlow() {
  try {
    // Check if TensorFlow is already loaded
    if (typeof tf === 'undefined') {
      console.error('TensorFlow.js not loaded - ensure script is in the HTML head');
      return false;
    }
    
    console.log('TensorFlow.js available, checking GPU...');
    
    // Check if GPU is available
    try {
      await tf.ready();
      gpuAvailable = tf.getBackend() === 'webgl';
      
      if (!gpuAvailable) {
        // Try to set WebGL backend explicitly
        await tf.setBackend('webgl');
        gpuAvailable = tf.getBackend() === 'webgl';
      }
      
      if (gpuAvailable) {
        console.log('GPU acceleration enabled via WebGL');
      } else {
        console.log('GPU not available, falling back to CPU');
      }
      
      // Either way, we can use TensorFlow
      tensorEnabled = true;
      return true;
      
    } catch (error) {
      console.error('Error setting up TensorFlow backend:', error);
      // Still enable TensorFlow with CPU
      tensorEnabled = true;
      return true;
    }
  } catch (error) {
    console.error('Error initializing TensorFlow:', error);
    return false;
  }
}

// Main function with improved memory management
async function calculatePricePredictionTensor(heatmapData, candlestickData, pathCount = 10) {
  // Make sure TensorFlow is initialized
  if (!tensorEnabled) {
    const initialized = await initTensorFlow();
    if (!initialized) {
      console.warn('Could not initialize TensorFlow.js, falling back to P5 implementation');
      return calculatePricePredictionP5(heatmapData, candlestickData, pathCount);
    }
  }
  
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
  
  console.time('tensorCalc');
  
  try {
    // Explicitly track tensors before and after to catch memory leaks
    const numTensorsBefore = tf.memory().numTensors;
    
    // Use a separate tidy scope for each major calculation
    // Calculate refractive indices once (shared across all paths)
    const refractiveIndices = tf.tidy(() => calculateRefractiveIndicesTensor(heatmapData));
    
    // Pre-compute the resistance map once (shared across all calculations)
    const resistanceMap = tf.tidy(() => precomputeResistanceMapTensor(refractiveIndices, heatmapData.priceLevels));
    
    // Define entry points with proper separation
    const entryPoints = tf.tidy(() => determineEntryPointsTensor(heatmapData, candlestickData, pathCount));
    
    // Track all generated paths
    const allPaths = [];
    
    // Process paths sequentially (we could batch this in future optimizations)
    for (let i = 0; i < entryPoints.length; i++) {
      // Use a separate tidy for each path calculation to limit memory use
      const { path, _ } = tf.tidy(() => {
        return findOptimalPricePathTensor(
          heatmapData, 
          refractiveIndices, 
          resistanceMap,
          candlestickData, 
          entryPoints[i],
          allPaths,
          i
        );
      });
      
      // Store the path for awareness in future path calculations
      allPaths.push(path);
      
      // Calculate momentum using tensor math - in a separate tidy scope
      const prediction = tf.tidy(() => calculateOpticalMomentumTensor({path}, refractiveIndices, heatmapData));
      
      // Add to collections
      result.predictedPaths.push(path);
      result.momentumVectorsCollection.push(prediction.momentumVectors);
      result.confidenceScoresCollection.push(prediction.confidenceScores);
    }
    
    // Populate shared data
    result.timestamps = heatmapData.timestamps.map(ts => new Date(ts * 1000));
    result.actualPrice = candlestickData.map(c => c.close);
    result.refractiveIndices = refractiveIndices;
    result.resistanceMap = resistanceMap;
    
    // Check for memory leaks
    const numTensorsAfter = tf.memory().numTensors;
    if (numTensorsAfter > numTensorsBefore) {
      console.warn(`TensorFlow.js memory leak detected: ${numTensorsAfter - numTensorsBefore} tensors not cleaned up`);
      // Force cleanup
      tf.disposeVariables();
    }
    
    console.timeEnd('tensorCalc');
    return result;
    
  } catch (error) {
    console.error('Error in TensorFlow calculation:', error);
    console.timeEnd('tensorCalc');
    console.warn('Falling back to P5 implementation');
    
    // Clean up any dangling tensors
    tf.disposeVariables();
    
    return calculatePricePredictionP5(heatmapData, candlestickData, pathCount);
  }
}

// Optimized refractive indices calculation using TensorFlow.js
function calculateRefractiveIndicesTensor(heatmapData) {
  return tf.tidy(() => {
    const priceLevels = heatmapData.priceLevels;
    const refractiveIndices = [];
    
    for (let i = 0; i < heatmapData.heatmap.length; i++) {
      const volumes = heatmapData.heatmap[i].volumes;
      
      // Convert volumes to tensor for faster operations
      const volumesTensor = tf.tensor1d(volumes.map(v => Math.abs(v)));
      
      // Find maximum volume using tensor operations
      const maxVolume = volumesTensor.max().dataSync()[0] || 0.0001; // Prevent division by zero
      
      // Calculate normalized volumes
      const normalizedVolumes = volumesTensor.div(maxVolume);
      
      // Apply the refractive index formula using tensor operations
      const multiplier = tf.scalar(5);
      const negativeValues = normalizedVolumes.mul(multiplier).neg();
      const expValues = negativeValues.exp();
      const scaledValues = expValues.mul(2);
      const refIndices = scaledValues.add(1);
      
      // Convert back to regular array
      const timeIndicesArray = Array.from(refIndices.dataSync());
      refractiveIndices.push(timeIndicesArray);
    }
    
    return refractiveIndices;
  });
}

// Pre-compute the entire resistance map with gradients for reuse
function precomputeResistanceMapTensor(refractiveIndices, priceLevels) {
  return tf.tidy(() => {
    const resistanceMap = [];
    
    for (let i = 0; i < refractiveIndices.length; i++) {
      const indices = tf.tensor1d(refractiveIndices[i]);
      const timeResistance = new Array(priceLevels.length);
      
      // Calculate gradients using tensor operations with proper shape management
      // For gradientsDown: compare each element with the one above (or first with itself if at top)
      let gradientsDown = tf.tensor1d(new Array(indices.shape[0]).fill(0));
      if (indices.shape[0] > 1) {
        // Create pairs of adjacent elements for subtraction, ensuring same shape
        const indicesExceptLast = indices.slice(0, indices.shape[0] - 1);
        const indicesExceptFirst = indices.slice(1);
        // Actual gradient calculation with matching shapes
        const gradientMiddle = indicesExceptFirst.sub(indicesExceptLast);
        // Ensure first element has a gradient value
        gradientsDown = tf.concat([tf.scalar(0).expandDims(), gradientMiddle]);
      }
      
      // For gradientsUp: compare each element with the one below (or last with itself if at bottom)
      let gradientsUp = tf.tensor1d(new Array(indices.shape[0]).fill(0));
      if (indices.shape[0] > 1) {
        // Create pairs of adjacent elements for subtraction, ensuring same shape 
        const indicesExceptLast = indices.slice(0, indices.shape[0] - 1);
        const indicesExceptFirst = indices.slice(1);
        // Actual gradient calculation with matching shapes
        const gradientMiddle = indicesExceptLast.sub(indicesExceptFirst);
        // Ensure last element has a gradient value
        gradientsUp = tf.concat([gradientMiddle, tf.scalar(0).expandDims()]);
      }
      
      // Convert to JS arrays
      const gradientsDownArray = Array.from(gradientsDown.dataSync());
      const gradientsUpArray = Array.from(gradientsUp.dataSync());
      
      for (let j = 0; j < priceLevels.length; j++) {
        // Store resistance and its gradient at this point
        timeResistance[j] = { 
          price: priceLevels[j],
          resistance: refractiveIndices[i][j],
          gradientUp: gradientsUpArray[j],
          gradientDown: gradientsDownArray[j]
        };
      }
      
      resistanceMap.push(timeResistance);
    }
    
    return resistanceMap;
  });
}

// Optimized entry points calculation
function determineEntryPointsTensor(heatmapData, candlestickData, pathCount = 10) {
  return tf.tidy(() => {
    const priceLevels = heatmapData.priceLevels;
    
    // Find price range
    const minPrice = Math.min(...priceLevels);
    const maxPrice = Math.max(...priceLevels);
    const priceRange = maxPrice - minPrice;
    
    // Minimum separation between entry points
    const minSeparation = Math.max(1, Math.floor(priceLevels.length / (pathCount * 1.5)));
    
    // Create evenly spaced entry points using tensor operations
    const stepSize = priceRange / (pathCount - 1 || 1);
    const pricesTensor = tf.linspace(minPrice, maxPrice, pathCount);
    const pricesArray = Array.from(pricesTensor.dataSync());
    
    // Find closest price indices
    const indices = pricesArray.map(price => findClosestPriceIndex(priceLevels, price));
    
    // Build entry points array
    const entryPoints = indices.map((index, i) => ({
      price: pricesArray[i],
      index,
      timeIndex: 0
    }));
    
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
  });
}

// Highly optimized path finding using TensorFlow.js
function findOptimalPricePathTensor(heatmapData, refractiveIndices, resistanceMap, candlestickData, entryPoint, allPaths, pathIndex) {
  return tf.tidy(() => {
    const priceLevels = heatmapData.priceLevels;
    const timestamps = heatmapData.timestamps;
    const path = [];
    
    // Make sure we have enough data
    if (timestamps.length < 2 || candlestickData.length < 2) {
      return { path, resistanceMap };
    }
    
    // Calculate volatility for search radius
    const priceHistory = candlestickData.map(c => c.close);
    const volatility = calculateVolatilityTensor(priceHistory);
    const baseSearchRadius = Math.max(2, Math.floor(priceLevels.length * volatility * 0.2));
    
    // Initialize with entry point
    let startTimeIndex = entryPoint ? (entryPoint.timeIndex || 0) : 0;
    let currentPriceIndex = entryPoint ? entryPoint.index : findClosestPriceIndex(priceLevels, candlestickData[0].close);
    
    path.push({ 
      time: new Date(timestamps[startTimeIndex] * 1000), 
      price: priceLevels[currentPriceIndex],
      resistance: refractiveIndices[startTimeIndex][currentPriceIndex]
    });
    
    // Find closest indices for all prices (avoiding tensor operations that could cause shape issues)
    const indices = [];
    for (let i = 0; i < candlestickData.length; i++) {
      indices.push(findClosestPriceIndex(priceLevels, candlestickData[i].close));
    }
    
    // For each timestamp, find the next point on the path
    for (let i = startTimeIndex + 1; i < timestamps.length; i++) {
      // Find actual price at this timestamp if available
      const actualPriceIndex = i < candlestickData.length ? indices[i] : -1;
      
      // Dynamic search radius that adapts to price movement
      const searchRadius = baseSearchRadius + 
        (actualPriceIndex >= 0 ? Math.abs(actualPriceIndex - currentPriceIndex) : 0);
          
      // Define search bounds
      const lowerBound = Math.max(0, currentPriceIndex - searchRadius);
      const upperBound = Math.min(priceLevels.length - 1, currentPriceIndex + searchRadius);
      
      // Create arrays for options and their properties
      const options = [];
      const resistances = [];
      
      // Store candidates for batch processing
      for (let j = lowerBound; j <= upperBound; j++) {
        // Skip extremely low liquidity areas
        if (refractiveIndices[i][j] > 3) {
          continue;
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
              
              // Calculate distance
              const distance = Math.abs(j - otherPriceIndex);
              
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
        
        options.push(j);
        resistances.push(totalResistance);
      }
      
      // Find minimum resistance path - avoid tensor operations here to prevent shape issues
      let minResistance = Infinity;
      let minIndex = currentPriceIndex;
      
      for (let k = 0; k < resistances.length; k++) {
        if (resistances[k] < minResistance) {
          minResistance = resistances[k];
          minIndex = options[k];
        }
      }
      
      if (minResistance < Infinity) {
        currentPriceIndex = minIndex;
      }
      
      // Add to final path
      path.push({
        time: new Date(timestamps[i] * 1000),
        price: priceLevels[currentPriceIndex],
        resistance: refractiveIndices[i][currentPriceIndex]
      });
    }
    
    return { path, resistanceMap };
  });
}

// Optimized momentum calculation using TensorFlow.js
function calculateOpticalMomentumTensor(optimalPath, refractiveIndices, heatmapData) {
  return tf.tidy(() => {
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
    
    // Create arrays for path data
    const times = path.map(p => p.time.getTime());
    const prices = path.map(p => p.price);
    const resistances = path.map(p => p.resistance);
    
    // Calculate time deltas and price deltas directly without using tensors
    // Since we need to calculate point-by-point anyway, tensors don't help much here
    for (let i = 1; i < path.length - 1; i++) {
      // Time deltas between adjacent points
      const dt1 = (times[i] - times[i-1]) / (1000 * 3600);
      const dt2 = (times[i+1] - times[i]) / (1000 * 3600);
      
      // Velocities
      const v1 = (prices[i] - prices[i-1]) / ((dt1 || 0.001) * resistances[i-1]);
      const v2 = (prices[i+1] - prices[i]) / ((dt2 || 0.001) * resistances[i]);
      
      // Acceleration = change in velocity / time
      const a = (v2 - v1) / (dt1 + dt2);
      
      // Force calculation
      const force = a * resistances[i];
      
      // Use normalized time component
      const dx = 1;
      const dy = v2 * 20; // Scale for visibility
      
      // Calculate magnitude and direction
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      const direction = Math.atan2(dy, dx);
      
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
        Math.abs(Math.cos(momentumVectors[i-1].direction - direction)) : 0.5;
      
      const speedFactor = 1 / resistances[i];
      const gradientStability = Math.exp(-Math.abs(force) * 2);
      
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
  });
}

// Optimized volatility calculation
function calculateVolatilityTensor(priceHistory) {
  return tf.tidy(() => {
    if (!priceHistory || priceHistory.length < 2) return 0.05;
    
    // Convert to tensor
    const pricesTensor = tf.tensor1d(priceHistory);
    
    // Get tensor shapes to make sure they match
    const shape = pricesTensor.shape[0];
    
    // Calculate percentage changes with proper shape handling
    const pricesShifted = pricesTensor.slice(1);
    const pricesPrev = pricesTensor.slice(0, shape - 1);
    
    // Safe division by avoiding zeros
    const safePrevsForDiv = pricesPrev.add(tf.scalar(1e-10)); // Avoid division by zero
    
    const changes = pricesShifted.sub(pricesPrev).div(safePrevsForDiv).abs();
    
    // Calculate mean
    const mean = changes.mean();
    
    // Calculate variance
    const squaredDiff = changes.sub(mean).pow(2);
    const variance = squaredDiff.mean();
    
    // Calculate standard deviation and clamp
    const stdDev = variance.sqrt().arraySync();
    return Math.max(0.01, Math.min(0.5, stdDev));
  });
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