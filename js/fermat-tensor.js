// Optimized Fermat ray calculation using TensorFlow.js for GPU accelerated computation
// This file provides GPU-accelerated versions of the p5.js implementation

// Direct TensorFlow.js access since we added it to the head
let gpuAvailable = false;
let tensorEnabled = false;

// Initialize TensorFlow.js with optimized settings
async function initTensorFlow() {
  try {
    if (typeof tf === 'undefined') {
      console.error('TensorFlow.js not loaded');
      return false;
    }
    
    // Set aggressive optimization flags BEFORE initializing backend
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Use 16-bit textures when possible
    tf.env().set('WEBGL_CPU_FORWARD', false); // Prevent CPU fallback for unsupported ops
    tf.env().set('WEBGL_PACK', true); // Enable texture packing
    tf.env().set('WEBGL_FLUSH_THRESHOLD', 1); // Smaller flush threshold for faster execution
    tf.env().set('WEBGL_MAX_TEXTURE_SIZE', 16384); // Attempt larger textures if GPU supports
    tf.env().set('WEBGL_RENDER_FLOAT32_ENABLED', true); // Enable rendering to float32 textures
    
      await tf.ready();
    await tf.setBackend('webgl');
    
    // Verify backend
      gpuAvailable = tf.getBackend() === 'webgl';
      
    if (gpuAvailable) {
      // Run warmup operation to initialize WebGL context
      const warmupTensor = tf.zeros([1000, 1000]);
      const warmupResult = warmupTensor.square().sum();
      await warmupResult.data(); // Force execution
      warmupTensor.dispose();
      warmupResult.dispose();
      
      console.log('GPU acceleration enabled via WebGL with optimized settings');
      console.log('WebGL capabilities:', tf.backend().getGPGPUContext().webGLVersion);
      console.log('Max texture size:', tf.env().get('WEBGL_MAX_TEXTURE_SIZE'));
      } else {
      console.warn('GPU not available, running on CPU');
    }
    
      tensorEnabled = true;
      return true;
  } catch (error) {
    console.error('Error initializing TensorFlow:', error);
    return false;
  }
}

// Add this function after initTensorFlow
async function testGPUPerformance() {
  if (!tensorEnabled) return { gpuWorks: false, speedup: 0 };
  
  console.log("Testing GPU vs CPU performance...");
  const SIZE = 1000;
  
  // Create large tensors
  const a = tf.randomNormal([SIZE, SIZE]);
  const b = tf.randomNormal([SIZE, SIZE]);
  
  // Test GPU performance
  const backupBackend = tf.getBackend();
  try {
    // Force WebGL
    await tf.setBackend('webgl');
    const gpuStart = performance.now();
    const gpuResult = a.matMul(b);
    await gpuResult.data(); // Force execution
    const gpuTime = performance.now() - gpuStart;
    console.log(`GPU calculation time: ${gpuTime.toFixed(2)}ms`);
    gpuResult.dispose();
    
    // Test CPU performance
    await tf.setBackend('cpu');
    const cpuStart = performance.now();
    const cpuResult = a.matMul(b);
    await cpuResult.data(); // Force execution
    const cpuTime = performance.now() - cpuStart;
    console.log(`CPU calculation time: ${cpuTime.toFixed(2)}ms`);
    cpuResult.dispose();
    
    // Restore original backend
    await tf.setBackend(backupBackend);
    
    // Calculate speedup
    const speedup = cpuTime / gpuTime;
    console.log(`GPU speedup: ${speedup.toFixed(2)}x`);
    
    // Cleanup
    a.dispose();
    b.dispose();
    
    return {
      gpuWorks: true,
      speedup: speedup
    };
  }
  catch (error) {
    console.error("GPU performance test failed:", error);
    // Cleanup
    a.dispose();
    b.dispose();
    await tf.setBackend(backupBackend);
    
    return {
      gpuWorks: false,
      speedup: 0,
      error: error.message
    };
  }
}

// Main function with improved memory management
async function calculatePricePredictionTensor(heatmapData, candlestickData, pathCount = 10) {
  // Return early if TensorFlow is not initialized
  if (!tensorEnabled) {
    const initialized = await initTensorFlow();
    if (!initialized) {
      console.warn('TensorFlow.js not available, using P5 implementation');
      return calculatePricePredictionP5(heatmapData, candlestickData, pathCount);
    }
  }
  
  // Log current GPU status
  console.log(`Using backend: ${tf.getBackend()}, GPU available: ${gpuAvailable}`);
  console.log('Memory before calculation:', tf.memory());
  
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
    // Use engine scope to better track and dispose tensors
    tf.engine().startScope();
    
    // Use tensor operations for math-heavy calculations
    console.time('refractiveIndices');
    const refractiveIndicesTensor = batchCalculateRefractiveIndicesTensor(heatmapData);
    // Convert to regular array for path calculations
    const refractiveIndices = await refractiveIndicesTensor.arraySync();
    console.timeEnd('refractiveIndices');
    
    // Calculate resistance map (optimized)
    console.time('resistanceMap');
    const resistanceMap = optimizedResistanceMapComputation(refractiveIndicesTensor, heatmapData.priceLevels);
    console.timeEnd('resistanceMap');
    
    // Generate entry points
    console.time('entryPoints');
    const entryPoints = await batchGenerateEntryPoints(heatmapData, candlestickData, pathCount);
    console.timeEnd('entryPoints');
    
    // Process paths - physics simulation needs to run per-path for accuracy
    console.time('pathCalculation');
    const allPaths = [];
    const allMomentumVectors = [];
    const allConfidenceScores = [];
    
    for (let i = 0; i < entryPoints.length; i++) {
      // Use tidy for memory management
      const pathResult = tf.tidy(() => {
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
      
      // Add to collection
      allPaths.push(pathResult.path);
      
      // Calculate momentum vectors using tensor operations where beneficial
      const prediction = tf.tidy(() => 
        calculateOpticalMomentumTensor({path: pathResult.path}, refractiveIndices, heatmapData)
      );
      
      allMomentumVectors.push(prediction.momentumVectors);
      allConfidenceScores.push(prediction.confidenceScores);
    }
    console.timeEnd('pathCalculation');
    
    // Store results
    result.predictedPaths = allPaths;
    result.momentumVectorsCollection = allMomentumVectors;
    result.confidenceScoresCollection = allConfidenceScores;
    
    // Populate shared data
    result.timestamps = heatmapData.timestamps.map(ts => new Date(ts * 1000));
    result.actualPrice = candlestickData.map(c => c.close);
    result.refractiveIndices = refractiveIndices;
    result.resistanceMap = resistanceMap;
    
    // End engine scope for cleanup
    tf.engine().endScope();
    
    console.log('Memory after calculation:', tf.memory());
    console.timeEnd('tensorCalc');
    
    return result;
  } catch (error) {
    console.error('Error in TensorFlow calculation:', error);
    console.timeEnd('tensorCalc');
    console.warn('Falling back to P5 implementation');
    
    // Ensure cleanup
    tf.engine().endScope();
    
    return calculatePricePredictionP5(heatmapData, candlestickData, pathCount);
  }
}

// Improved batch processing for refractive indices
function batchCalculateRefractiveIndicesTensor(heatmapData) {
  return tf.tidy(() => {
    if (!heatmapData.heatmap.length) return [];
    
    // Extract all volumes into a single large tensor
    const batchSize = heatmapData.heatmap.length;
    const volumeLength = heatmapData.heatmap[0].volumes.length;
    
    // Create a single large batch tensor instead of many small ones
    const allVolumes = [];
    for (let i = 0; i < heatmapData.heatmap.length; i++) {
      allVolumes.push(...heatmapData.heatmap[i].volumes.map(v => Math.abs(v)));
    }
    
    // Process in one large batch operation
    const volumesTensor = tf.tensor2d(allVolumes, [batchSize, volumeLength]);
    
    // Calculate max volume for each batch in parallel
    const maxVolumes = volumesTensor.max(1, true); // Keep dims for broadcasting
    
    // Normalize all volumes in one operation (uses broadcasting)
    const normalizedVolumes = volumesTensor.div(maxVolumes.add(tf.scalar(0.0001)));
    
    // Calculate refractive indices in one operation
    const multiplier = tf.scalar(5);
    const refIndices = normalizedVolumes.mul(multiplier).neg().exp().mul(2).add(1);
    
    // Keep as tensor for further processing, only convert at the end if needed
    return refIndices;
  });
}

// Optimized main calculation function with minimal CPU-GPU transfers
async function calculatePricePredictionTensor(heatmapData, candlestickData, pathCount = 10) {
  // Return early if TensorFlow is not initialized
  if (!tensorEnabled) {
    const initialized = await initTensorFlow();
    if (!initialized) {
      console.warn('TensorFlow.js not available, using P5 implementation');
      return calculatePricePredictionP5(heatmapData, candlestickData, pathCount);
    }
  }
  
  // Log current GPU status
  console.log(`Using backend: ${tf.getBackend()}, GPU available: ${gpuAvailable}`);
  console.log('Memory before calculation:', tf.memory());
  
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
    // Use engine scope to better track and dispose tensors
    tf.engine().startScope();
    
    // Calculate refractive indices as batched tensor operation
    console.time('refractiveIndices');
    const refractiveIndicesTensor = batchCalculateRefractiveIndicesTensor(heatmapData);
    
    // Only convert to array when needed for path calculation
    const refractiveIndices = await refractiveIndicesTensor.arraySync();
    console.timeEnd('refractiveIndices');
    
    // Calculate resistance map (optimized)
    console.time('resistanceMap');
    const resistanceMap = optimizedResistanceMapComputation(refractiveIndicesTensor, heatmapData.priceLevels);
    console.timeEnd('resistanceMap');
    
    // Generate entry points in parallel
    console.time('entryPoints');
    const entryPoints = await batchGenerateEntryPoints(heatmapData, candlestickData, pathCount);
    console.timeEnd('entryPoints');
    
    // Process all paths in parallel batches when possible
    console.time('pathCalculation');
    const pathResults = await batchProcessPaths(
      heatmapData, 
      refractiveIndices,
      resistanceMap,
      candlestickData,
      entryPoints,
      pathCount
    );
    console.timeEnd('pathCalculation');
    
    // Use results
    result.predictedPaths = pathResults.paths;
    result.momentumVectorsCollection = pathResults.momentumVectors;
    result.confidenceScoresCollection = pathResults.confidenceScores;
    
    // Populate shared data
    result.timestamps = heatmapData.timestamps.map(ts => new Date(ts * 1000));
    result.actualPrice = candlestickData.map(c => c.close);
    result.refractiveIndices = refractiveIndices;
    result.resistanceMap = resistanceMap;
    
    // End the engine scope for auto-cleanup
    tf.engine().endScope();
    
    console.log('Memory after calculation:', tf.memory());
    console.timeEnd('tensorCalc');
    
    return result;
  } catch (error) {
    console.error('Error in TensorFlow calculation:', error);
    tf.engine().endScope(); // Ensure cleanup
    console.warn('Falling back to P5 implementation');
    return calculatePricePredictionP5(heatmapData, candlestickData, pathCount);
  }
}

// Batch process multiple paths in parallel where possible
async function batchProcessPaths(heatmapData, refractiveIndices, resistanceMap, candlestickData, entryPoints, pathCount) {
  // Process paths in batches of 5 to balance parallelism without overwhelming GPU memory
  const BATCH_SIZE = Math.min(5, pathCount);
    const allPaths = [];
  const allMomentumVectors = [];
  const allConfidenceScores = [];
  
  for (let batchStart = 0; batchStart < pathCount; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, pathCount);
    
    // Process each path in batch sequentially but with tensor optimizations
    for (let i = batchStart; i < batchEnd; i++) {
      // Use tidy for each individual path calculation
      const pathResult = tf.tidy(() => {
        return processPath(
          heatmapData, 
          refractiveIndices, 
          resistanceMap,
          candlestickData, 
          entryPoints[i],
          allPaths,
          i
        );
      });
      
      // Store results outside of tidy
      allPaths.push(pathResult.path);
      allMomentumVectors.push(pathResult.momentumVectors);
      allConfidenceScores.push(pathResult.confidenceScores);
    }
  }
  
  return {
    paths: allPaths,
    momentumVectors: allMomentumVectors,
    confidenceScores: allConfidenceScores
  };
}

// Processing for a single path with optimized tensor operations
function processPath(heatmapData, refractiveIndices, resistanceMap, candlestickData, entryPoint, existingPaths, pathIndex) {
  // Implement the path calculation with optimized tensor operations
  const pathResult = findOptimalPricePathTensor(
    heatmapData,
    refractiveIndices,
    resistanceMap,
    candlestickData,
    entryPoint,
    existingPaths,
    pathIndex
  );
  
  // Get the path from the result
  const path = pathResult.path;
  
  // Calculate optical momentum in GPU
  const prediction = calculateOpticalMomentumTensor({path}, refractiveIndices, heatmapData);
  
  return {
    path: path,
    momentumVectors: prediction.momentumVectors,
    confidenceScores: prediction.confidenceScores
  };
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

// Optimized resistance map computation with efficient tensor operations
function optimizedResistanceMapComputation(refractiveIndicesTensor, priceLevels) {
  return tf.tidy(() => {
    // Get shapes for reference
    const batchSize = refractiveIndicesTensor.shape[0];
    const priceCount = refractiveIndicesTensor.shape[1];
    
    // Initialize resistance map storage
    const resistanceMap = [];
    
    // Process each time frame (we need to loop through time)
    for (let i = 0; i < batchSize; i++) {
      // Extract current time slice
      const indices = refractiveIndicesTensor.slice([i, 0], [1, priceCount]).reshape([priceCount]);
      const timeResistance = new Array(priceCount);
      
      // Calculate gradients using tensor operations
      // For gradient down (compare with item below)
      let gradientsDown = tf.zeros([priceCount]);
      if (priceCount > 1) {
        // Create offsets for gradient calculation
        const upperValues = indices.slice(0, priceCount - 1);
        const lowerValues = indices.slice(1);
        
        // Calculate actual gradients
        const gradients = lowerValues.sub(upperValues);
        
        // Pad to match original shape (add 0 at the end)
        gradientsDown = tf.concat([gradients, tf.zeros([1])]);
      }
      
      // For gradient up (compare with item above)
      let gradientsUp = tf.zeros([priceCount]);
      if (priceCount > 1) {
        // Create offsets for gradient calculation
        const upperValues = indices.slice(0, priceCount - 1);
        const lowerValues = indices.slice(1);
        
        // Calculate actual gradients
        const gradients = upperValues.sub(lowerValues);
        
        // Pad to match original shape (add 0 at the beginning)
        gradientsUp = tf.concat([tf.zeros([1]), gradients]);
      }
      
      // Convert to standard arrays for compatibility with existing code
      const refractiveIndicesArray = Array.from(indices.dataSync());
      const gradientsDownArray = Array.from(gradientsDown.dataSync());
      const gradientsUpArray = Array.from(gradientsUp.dataSync());
      
      // Create resistance map for this time slice
      for (let j = 0; j < priceCount; j++) {
        // Store resistance and its gradient at this point
        timeResistance[j] = { 
          price: priceLevels[j],
          resistance: refractiveIndicesArray[j],
          gradientUp: gradientsUpArray[j],
          gradientDown: gradientsDownArray[j]
        };
      }
      
      resistanceMap.push(timeResistance);
    }
    
    return resistanceMap;
  });
}

// Batch generate entry points for multiple paths
async function batchGenerateEntryPoints(heatmapData, candlestickData, pathCount) {
  return tf.tidy(() => {
    // Define the price levels
    const pricesArray = heatmapData.priceLevels;
    
    // Find center price index (close to current price)
    const lastPrice = candlestickData[candlestickData.length - 1].close;
    let centerPriceIndex = 0;
    let minDistance = Number.MAX_VALUE;
    
    for (let i = 0; i < pricesArray.length; i++) {
      const distance = Math.abs(pricesArray[i] - lastPrice);
      if (distance < minDistance) {
        minDistance = distance;
        centerPriceIndex = i;
      }
    }
    
    // Calculate spread for entry points distribution
    const spread = Math.floor(pricesArray.length / 5);
    
    // Generate entry points with proper distribution
    const entryPoints = [];
    const step = (spread * 2) / (pathCount - 1 || 1);
    
    for (let i = 0; i < pathCount; i++) {
      // Calculate offset from center, ensuring even distribution
      let offset;
      if (pathCount === 1) {
        offset = 0;
      } else {
        offset = -spread + i * step;
      }
      
      // Ensure index is within bounds
      const priceIndex = Math.max(0, Math.min(pricesArray.length - 1, 
                                 Math.floor(centerPriceIndex + offset)));
      
      // Create entry point
      entryPoints.push({
        timeIndex: 0,
        priceIndex: priceIndex,
        time: new Date(heatmapData.timestamps[0] * 1000),
        price: pricesArray[priceIndex],
        resistance: 1.0 // Default resistance at entry
      });
    }
    
    return entryPoints;
  });
}

// Improved findOptimalPricePathTensor that more closely mimics p5.js physics
function findOptimalPricePathTensor(
  heatmapData, 
  refractiveIndices, 
  resistanceMap,
  candlestickData, 
  entryPoint,
  existingPaths,
  pathIndex
) {
  // Return early if not enough data
  const timeSteps = heatmapData.timestamps.length;
  const priceLevels = heatmapData.priceLevels;
  
  if (timeSteps < 2 || candlestickData.length < 2) {
    return { path: [entryPoint], volatility: 0.05 };
  }
  
  // Calculate volatility matching the P5.js detailed implementation
  const priceHistory = candlestickData.map(c => c.close);
  const volatility = calculateVolatilityTensor(priceHistory);
  
  // Initialize path with entry point
  const path = [entryPoint];
  
  // Pre-compute price indices for actual prices - moved from P5.js
  const actualPriceIndices = [];
  for (let i = 0; i < candlestickData.length; i++) {
    actualPriceIndices.push(findClosestPriceIndex(priceLevels, candlestickData[i].close));
  }
  
  let currentPriceIndex = entryPoint.priceIndex;
  
  // Process timesteps using GPU-optimized operations
  for (let timeIndex = 1; timeIndex < timeSteps; timeIndex++) {
    // Define dynamic search radius based on volatility - matching P5.js
    const baseSearchRadius = Math.max(2, Math.floor(priceLevels.length * volatility * 0.2));
    
    // Find actual price at this timestamp if available
    const actualPriceIndex = timeIndex < candlestickData.length ? actualPriceIndices[timeIndex] : -1;
    
    // Dynamic search radius that adapts to price movement
    const searchRadius = baseSearchRadius + 
      (actualPriceIndex >= 0 ? Math.abs(actualPriceIndex - currentPriceIndex) : 0);
    
    // Define search bounds
    const lowerBound = Math.max(0, currentPriceIndex - searchRadius);
    const upperBound = Math.min(priceLevels.length - 1, currentPriceIndex + searchRadius);
    
    // GPU-optimized search for minimum resistance path
    const { nextPriceIndex } = findMinimumResistanceTensor(
      timeIndex,
      currentPriceIndex,
      lowerBound,
      upperBound,
      refractiveIndices,
      resistanceMap,
      actualPriceIndex,
      priceLevels.length,
      existingPaths,
      pathIndex,
      timeIndex,
      heatmapData,
      priceLevels
    );
    
    // Update current position
    currentPriceIndex = nextPriceIndex;
    
    // Create the next point
    const nextPoint = {
      timeIndex: timeIndex,
      priceIndex: currentPriceIndex,
      time: new Date(heatmapData.timestamps[timeIndex] * 1000),
      price: priceLevels[currentPriceIndex],
      resistance: resistanceMap[timeIndex][currentPriceIndex].resistance
    };
    
    // Add to path
    path.push(nextPoint);
  }
  
  return {
    path: path,
    volatility: volatility
  };
}

// Fixed GPU-optimized path resistance calculation
function findMinimumResistanceTensor(
  timeIndex,
  currentPriceIndex,
  lowerBound,
  upperBound,
  refractiveIndices,
  resistanceMap,
  actualPriceIndex,
  totalPriceLevels,
  existingPaths,
  pathIndex,
  currentTimeIndex,
  heatmapData,
  priceLevels
) {
  return tf.tidy(() => {
    // Create array of price indices to evaluate
    const priceIndices = [];
    for (let j = lowerBound; j <= upperBound; j++) {
      priceIndices.push(j);
    }
    
    // Skip execution if no valid indices
    if (priceIndices.length === 0) {
      return { nextPriceIndex: currentPriceIndex };
    }
    
    // Create tensors for fast calculations
    const indicesTensor = tf.tensor1d(priceIndices);
    
    // 1. Calculate optical resistance component
    const resistanceValues = priceIndices.map(j => refractiveIndices[timeIndex][j]);
    const opticalResistance = tf.tensor1d(resistanceValues);
    
    // 2. Calculate price deltas for bend penalty
    const deltaValues = priceIndices.map(j => j - currentPriceIndex);
    const priceDelta = tf.tensor1d(deltaValues);
    const bendPenalty = priceDelta.abs().mul(0.05);
    
    // 3. Calculate actual price attraction
    let actualPriceAttraction;
    if (actualPriceIndex >= 0) {
      actualPriceAttraction = indicesTensor.sub(actualPriceIndex).abs().div(totalPriceLevels).mul(0.3);
    } else {
      actualPriceAttraction = tf.zeros(priceIndices.length);
    }
    
    // 4. Calculate gradient effects
    const gradientEffect = tf.tidy(() => {
      const gradientValues = priceIndices.map(j => {
        // Get gradient based on movement direction
        if (j > currentPriceIndex) {
          return resistanceMap[timeIndex][j].gradientUp * 0.1;
        } else if (j < currentPriceIndex) {
          return resistanceMap[timeIndex][j].gradientDown * 0.1;
        }
        return 0;
      });
      return tf.tensor1d(gradientValues);
    });
    
    // 5. Calculate path repulsion effect - must be done on CPU as it's complex
    const repulsionValues = priceIndices.map(j => {
      let repulsionEffect = 0;
      
      if (existingPaths && existingPaths.length > 0 && pathIndex >= 0) {
        const pathRepulsionDistance = Math.max(1, Math.floor(totalPriceLevels / (existingPaths.length * 3)));
        
        for (let p = 0; p < existingPaths.length; p++) {
          // Skip comparing to self
          if (p === pathIndex) continue;
          
          // Find this path's point at current timestamp
          const otherPath = existingPaths[p];
          const otherTimePoints = otherPath.filter(pt => 
            pt.time && 
            pt.time.getTime() === new Date(heatmapData.timestamps[currentTimeIndex] * 1000).getTime()
          );
          
          if (otherTimePoints.length > 0) {
            const otherPoint = otherTimePoints[0];
            const otherPriceIndex = findClosestPriceIndex(priceLevels, otherPoint.price);
            const distance = Math.abs(j - otherPriceIndex);
            
            // Add repulsion if too close
            if (distance < pathRepulsionDistance) {
              const repulsionForce = (pathRepulsionDistance - distance) / pathRepulsionDistance;
              repulsionEffect += repulsionForce * 0.4;
            }
          }
        }
      }
      
      return repulsionEffect;
    });
    const repulsionEffect = tf.tensor1d(repulsionValues);
    
    // Calculate total resistance - all components on GPU
    const totalResistance = tf.tidy(() => {
      return opticalResistance
        .add(bendPenalty)
        .add(actualPriceAttraction)
        .add(gradientEffect)
        .add(repulsionEffect);
    });
    
    // Find index of minimum resistance - FIXED VERSION
    // TensorFlow.js doesn't have nonZero() available in this context, so we use argMin instead
    const minIndex = totalResistance.argMin().dataSync()[0];
    const resultIndex = priceIndices[minIndex];
    
    return { nextPriceIndex: resultIndex || currentPriceIndex };
  });
}

// Enhanced volatility calculation that maintains tensor performance
function calculateVolatilityTensor(priceHistory) {
  return tf.tidy(() => {
    if (!priceHistory || priceHistory.length < 2) return 0.05;
    
    // Convert to tensor
    const pricesTensor = tf.tensor1d(priceHistory);
    
    // Calculate percentage changes
    const prevPrices = pricesTensor.slice(0, priceHistory.length - 1);
    const currentPrices = pricesTensor.slice(1);
    
    // Handle division by zero with small epsilon
    const epsilon = tf.scalar(1e-8);
    const safePrevPrices = prevPrices.add(epsilon);
    
    // Calculate absolute percentage changes
    const changes = currentPrices.sub(prevPrices).div(safePrevPrices).abs();
    
    // Calculate mean
    const mean = changes.mean();
    
    // Calculate variance
    const variance = changes.sub(mean).square().mean();
    
    // Calculate standard deviation
    const stdDev = variance.sqrt();
    
    // Clamp to reasonable range
    const minVal = tf.scalar(0.01);
    const maxVal = tf.scalar(0.5);
    const clampedStdDev = stdDev.maximum(minVal).minimum(maxVal);
    
    // Extract as JavaScript number
    return clampedStdDev.dataSync()[0];
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

// Calculate initial trend direction from recent candlestick data
function calculateInitialTrend(candlestickData) {
  if (!candlestickData || candlestickData.length < 5) return 0;
  
  // Use the last few candles to determine trend
  const recentCandles = candlestickData.slice(-5);
  let upCount = 0;
  let downCount = 0;
  
  for (let i = 1; i < recentCandles.length; i++) {
    if (recentCandles[i].close > recentCandles[i-1].close) {
      upCount++;
    } else if (recentCandles[i].close < recentCandles[i-1].close) {
      downCount++;
    }
  }
  
  // Return normalized trend (-1 to +1)
  return (upCount - downCount) / (upCount + downCount || 1);
}

// Apply Snell's law to calculate refraction between different resistance media
function applySnellsLaw(
  currentPriceIndex,
  currentTimeIndex,
  nextTimeIndex,
  directionX,
  directionY,
  resistanceMap,
  volatility
) {
  // Current medium's refractive index
  const n1 = resistanceMap[currentTimeIndex][currentPriceIndex].resistance;
  
  // Calculate the incident angle (from the normal)
  const incidentAngle = Math.atan2(directionY, directionX);
  
  // Price range to explore for next step (based on volatility)
  const range = Math.max(3, Math.floor(resistanceMap[0].length * volatility / 2));
  
  // Bounds for exploration
  const minIndex = Math.max(0, currentPriceIndex - range);
  const maxIndex = Math.min(resistanceMap[0].length - 1, currentPriceIndex + range);
  
  // Find the path with minimum optical path length (Fermat's principle)
  let minPathLength = Number.MAX_VALUE;
  let bestIndex = currentPriceIndex; // Default to same price level
  let bestDirectionY = directionY;
  
  // Check each possible price level
  for (let i = minIndex; i <= maxIndex; i++) {
    // Get refractive index at this candidate point
    const n2 = resistanceMap[nextTimeIndex][i].resistance;
    
    // Calculate the price change and resulting direction
    const priceChange = i - currentPriceIndex;
    
    // Apply Snell's law: n1 * sin(θ1) = n2 * sin(θ2)
    // Calculate new direction after refraction
    const sin1 = Math.sin(incidentAngle);
    let sin2 = (n1 / n2) * sin1;
    
    // Handle total internal reflection case
    if (Math.abs(sin2) > 1) {
      sin2 = Math.sign(sin2);
    }
    
    const newAngle = Math.asin(sin2);
    const newDirectionX = 1.0; // Always moving forward in time
    const newDirectionY = Math.tan(newAngle);
    
    // Calculate path length (optical length = geometric length * refractive index)
    const geometricLength = Math.sqrt(1 + priceChange * priceChange);
    const opticalLength = geometricLength * ((n1 + n2) / 2);
    
    // Add gradient influence - prefer moving with the gradient
    let gradientInfluence = 0;
    if (priceChange > 0) {
      // Moving up, use the upward gradient
      gradientInfluence = -resistanceMap[currentTimeIndex][currentPriceIndex].gradientUp * 0.2;
    } else if (priceChange < 0) {
      // Moving down, use the downward gradient
      gradientInfluence = -resistanceMap[currentTimeIndex][currentPriceIndex].gradientDown * 0.2;
    }
    
    // Combine path length with gradient influence
    const effectivePathLength = opticalLength + gradientInfluence;
    
    // Check if this is the best path so far
    if (effectivePathLength < minPathLength) {
      minPathLength = effectivePathLength;
      bestIndex = i;
      bestDirectionY = newDirectionY;
    }
  }
  
  return { 
    nextPriceIndex: bestIndex,
    newDirectionY: bestDirectionY
  };
}

// Apply separation force to avoid paths overlapping
function applyPathSeparation(
  priceIndex,
  timeIndex,
  existingPaths,
  currentPathIndex
) {
  if (!existingPaths || existingPaths.length === 0 || currentPathIndex === 0) {
    return priceIndex; // Nothing to separate from
  }
  
  let separationForce = 0;
  let totalWeight = 0;
  
  // Check distance to all existing paths at this time index
  for (let p = 0; p < existingPaths.length && p < currentPathIndex; p++) {
    const otherPath = existingPaths[p];
    
    // Ensure other path has a point at this time index
    if (otherPath.length <= timeIndex) continue;
    
    // Calculate separation based on distance
    const otherPriceIndex = otherPath[timeIndex].priceIndex;
    const distance = priceIndex - otherPriceIndex;
    
    // Separation force decreases with distance
    if (Math.abs(distance) < 3) {
      // Weight inversely proportional to distance
      const weight = 1 / (Math.abs(distance) + 0.1);
      
      // Direction is away from the other path
      const force = Math.sign(distance) * (3 - Math.abs(distance)) * 0.5;
      
      separationForce += force * weight;
      totalWeight += weight;
    }
  }
  
  // Apply weighted separation force
  if (totalWeight > 0) {
    separationForce /= totalWeight;
    return Math.round(priceIndex + separationForce);
  }
  
  return priceIndex;
}

// Calculate optical momentum for the path
function calculateOpticalMomentumTensor({path}, refractiveIndices, heatmapData) {
  return tf.tidy(() => {
    const momentumVectors = [];
    const confidenceScores = [];
    
    // Validate path data
    if (!path || !Array.isArray(path) || path.length < 3) {
      console.warn('Path has insufficient points for momentum calculation');
      return { momentumVectors, confidenceScores };
    }
    
    // Validate first path point
    if (!path[0] || !path[0].time || !path[0].price) {
      console.warn('Invalid first point in path');
      return { momentumVectors, confidenceScores };
    }
    
    // Initialize with zero momentum for first point
    momentumVectors.push({ 
      x: path[0].time, 
      y: path[0].price, 
      dx: 0, 
      dy: 0,
      magnitude: 0,
      direction: 0
    });
    
    // Calculate for middle points
    for (let i = 1; i < path.length - 1; i++) {
      // Ensure each point exists and has required properties
      if (!path[i] || !path[i].time || !path[i].price || 
          !path[i-1] || !path[i-1].time || !path[i-1].price || 
          !path[i+1] || !path[i+1].time || !path[i+1].price) {
        console.warn(`Invalid point at index ${i} in path`);
        continue; // Skip this point
      }
      
      // Time deltas between adjacent points (in hours)
      const dt1 = (path[i].time.getTime() - path[i-1].time.getTime()) / (1000 * 3600);
      const dt2 = (path[i+1].time.getTime() - path[i].time.getTime()) / (1000 * 3600);
      
      // Price deltas
      const dp1 = path[i].price - path[i-1].price;
      const dp2 = path[i+1].price - path[i].price;
      
      // Get resistance values safely
      const resistance1 = path[i-1].resistance || 1.0;
      const resistance2 = path[i].resistance || 1.0;
      
      // Velocities (price change per hour, adjusted by medium resistance)
      const v1 = dp1 / ((dt1 || 0.001) * resistance1);
      const v2 = dp2 / ((dt2 || 0.001) * resistance2);
      
      // Acceleration = change in velocity / time
      const a = (v2 - v1) / (dt1 + dt2);
      
      // Force calculation
      const force = a * (path[i].resistance || 1.0);
      
      // Set vector components for visualization
      const dx = 1; // Normalized time component
      const dy = v2 * 20; // Scale for visibility
      
      // Calculate magnitude and direction
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      const direction = Math.atan2(dy, dx);
      
      // Create momentum vector
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
      const forceConsistency = i > 1 && momentumVectors[i-1] ? 
        Math.abs(Math.cos(momentumVectors[i-1].direction - direction)) : 0.5;
      
      const speedFactor = 1 / (path[i].resistance || 1.0);
      const gradientStability = Math.exp(-Math.abs(force) * 2);
      
      // Combined confidence score
      const confidence = 0.3 + 0.7 * (
        forceConsistency * 0.4 + 
        speedFactor * 0.3 + 
        gradientStability * 0.3
      );
      
      confidenceScores.push(confidence);
    }
    
    // Add final point with same momentum as previous point (if path has sufficient points)
    if (path.length > 1 && momentumVectors.length > 0) {
      const lastVector = momentumVectors[momentumVectors.length - 1];
      const lastPathPoint = path[path.length - 1];
      
      if (lastVector && lastPathPoint && lastPathPoint.time && lastPathPoint.price) {
      momentumVectors.push({
          x: lastPathPoint.time,
          y: lastPathPoint.price,
        dx: lastVector.dx,
        dy: lastVector.dy,
        magnitude: lastVector.magnitude,
          direction: lastVector.direction,
          force: lastVector.force
      });
      
        confidenceScores.push(confidenceScores[confidenceScores.length - 1] || 0.5);
      }
    }
    
    return { momentumVectors, confidenceScores };
  });
}

// Simple volatility calculation as a fallback
function calculateVolatilitySimple(priceHistory) {
    if (!priceHistory || priceHistory.length < 2) return 0.05;
    
  let sum = 0;
  let changes = [];
  
  for (let i = 1; i < priceHistory.length; i++) {
    // Calculate percentage change
    const change = Math.abs((priceHistory[i] - priceHistory[i-1]) / priceHistory[i-1]);
    changes.push(change);
    sum += change;
  }
  
  // Average absolute percentage change
  const mean = sum / changes.length;
    
    // Calculate variance
  let variance = 0;
  for (let i = 0; i < changes.length; i++) {
    variance += Math.pow(changes[i] - mean, 2);
  }
  variance /= changes.length;
  
  // Standard deviation with limits
  const stdDev = Math.sqrt(variance);
    return Math.max(0.01, Math.min(0.5, stdDev));
} 