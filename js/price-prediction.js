// Physics-inspired prediction model functions

// Master function to calculate price prediction
function calculatePricePrediction(heatmapData, candlestickData) {
    // Return object with prediction results
    const result = {
        timestamps: [],
        actualPrice: [],
        predictedPath: [],
        refractiveIndices: [],
        resistanceMap: [],
        momentumVectors: [],
        confidenceScores: []
    };
    
    if (!heatmapData.heatmap.length || !candlestickData.length) return result;
    
    // 1. Calculate refractive indices based on order density
    // Higher density = higher refractive index = slower light passage (more resistance)
    const refractiveIndices = calculateRefractiveIndices(heatmapData);
    
    // 2. Find price path of least resistance
    const optimalPath = findOptimalPricePath(heatmapData, refractiveIndices, candlestickData);
    
    // 3. Calculate optical momentum and predict future movement
    const prediction = calculateOpticalMomentum(optimalPath, refractiveIndices, heatmapData);
    
    // 4. Populate result with prediction data
    result.timestamps = heatmapData.timestamps.map(ts => new Date(ts * 1000));
    result.actualPrice = candlestickData.map(c => c.close);
    result.predictedPath = optimalPath.path;
    result.refractiveIndices = refractiveIndices;
    result.resistanceMap = optimalPath.resistanceMap;
    result.momentumVectors = prediction.momentumVectors;
    result.confidenceScores = prediction.confidenceScores;
    
    return result;
}

// Calculate refractive indices based on order density
function calculateRefractiveIndices(heatmapData) {
    const priceLevels = heatmapData.priceLevels;
    const refractiveIndices = [];
    
    // For each timestamp, calculate refractive index at each price level
    for (let i = 0; i < heatmapData.heatmap.length; i++) {
        const timeIndices = [];
        const volumes = heatmapData.heatmap[i].volumes;
        
        // Find maximum volume for normalization
        const maxVolume = Math.max(...volumes.map(v => Math.abs(v)));
        const epsilon = 0.0001; // Prevent division by zero
        
        for (let j = 0; j < priceLevels.length; j++) {
            // Normalize volume and calculate refractive index
            const normalizedVolume = maxVolume > 0 ? Math.abs(volumes[j]) / maxVolume : 0;
            
            // Updated formula: Exponential relationship for better contrast
            // Areas with high volume have LOWER refractive index (easier for light to pass)
            // This matches our metaphor: price prefers to go through areas with more liquidity
            const refractiveIndex = 1 + Math.exp(-5 * normalizedVolume) * 2;
            timeIndices.push(refractiveIndex);
        }
        
        refractiveIndices.push(timeIndices);
    }
    
    return refractiveIndices;
}

// Find optimal path for price movement based on physics principles
function findOptimalPricePath(heatmapData, refractiveIndices, candlestickData) {
    const priceLevels = heatmapData.priceLevels;
    const timestamps = heatmapData.timestamps;
    const path = [];
    const resistanceMap = [];
    
    // Make sure we have enough data
    if (timestamps.length < 2 || candlestickData.length < 2) {
        return { path, resistanceMap };
    }
    
    // Initialize with actual price at first timestamp
    const startPrice = candlestickData[0].close;
    let currentPriceIndex = findClosestPriceIndex(priceLevels, startPrice);
    
    path.push({ 
        time: new Date(timestamps[0] * 1000), 
        price: priceLevels[currentPriceIndex],
        resistance: refractiveIndices[0][currentPriceIndex]
    });
    
    // Calculate gradient of refractive indices (important for Snell's law)
    for (let i = 0; i < refractiveIndices.length; i++) {
        const timeResistance = [];
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
            timeResistance.push({ 
                price: priceLevels[j],
                resistance: refractiveIndices[i][j],
                gradientUp: gradientUp,
                gradientDown: gradientDown
            });
        }
        resistanceMap.push(timeResistance);
    }
    
    // Apply Fermat's principle of least time
    // This is analogous to finding path of least resistance through a medium
    
    // Variable search radius based on price volatility
    const priceHistory = candlestickData.map(c => c.close);
    const volatility = calculateVolatility(priceHistory);
    const baseSearchRadius = Math.max(2, Math.floor(priceLevels.length * volatility * 0.2));
    
    // For each timestamp, find the next point on the path
    for (let i = 1; i < timestamps.length; i++) {
        // Find the actual price at this timestamp if available
        const actualPriceIndex = i < candlestickData.length ? 
            findClosestPriceIndex(priceLevels, candlestickData[i].close) : -1;
        
        // Dynamic search radius that adapts to price movement
        const searchRadius = baseSearchRadius + 
            (actualPriceIndex >= 0 ? Math.abs(actualPriceIndex - currentPriceIndex) : 0);
            
        // Define the search space bounded by the search radius
        const lowerBound = Math.max(0, currentPriceIndex - searchRadius);
        const upperBound = Math.min(priceLevels.length - 1, currentPriceIndex + searchRadius);
        
        // Find path of least optical time (resistance)
        let minResistance = Infinity;
        let optimalNextIndex = currentPriceIndex;
        
        for (let j = lowerBound; j <= upperBound; j++) {
            // Skip points with very high resistance (extremely low liquidity)
            if (refractiveIndices[i][j] > 3) {
                continue;
            }
            
            // Calculate actual path resistance using the physics of refraction
            // 1. Base optical resistance at this point
            const opticalResistance = refractiveIndices[i][j];
            
            // 2. Apply Snell's law: light bends toward lower refractive index
            // Calculate the "bend penalty" - sharper turns cost more when going against the gradient
            const priceDelta = j - currentPriceIndex;
            const bendPenalty = Math.abs(priceDelta) * 0.05;
            
            // 3. Factor in actual price attraction (prices tend to move toward actual market price)
            const actualPriceAttraction = actualPriceIndex >= 0 ? 
                0.3 * Math.abs(j - actualPriceIndex) / priceLevels.length : 0;
            
            // 4. Incorporate gradient effects (light prefers paths where resistance decreases)
            const gradientEffect = priceDelta > 0 ? 
                resistanceMap[i][j].gradientUp * 0.1 : 
                resistanceMap[i][j].gradientDown * 0.1;
            
            // Total resistance for this path option
            const totalResistance = 
                opticalResistance + 
                bendPenalty + 
                actualPriceAttraction + 
                gradientEffect;
            
            // Update minimum resistance path
            if (totalResistance < minResistance) {
                minResistance = totalResistance;
                optimalNextIndex = j;
            }
        }
        
        // Update current position to optimal next point
        currentPriceIndex = optimalNextIndex;
        
        // Add to final path
        path.push({
            time: new Date(timestamps[i] * 1000),
            price: priceLevels[currentPriceIndex],
            resistance: refractiveIndices[i][currentPriceIndex]
        });
    }
    
    return { path, resistanceMap };
}

// Calculate momentum vectors for price prediction
function calculateOpticalMomentum(optimalPath, refractiveIndices, heatmapData) {
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
    
    // Calculate momentum vectors along the path with improved physics
    for (let i = 1; i < path.length - 1; i++) {
        // Time delta in milliseconds converted to hours for scaling
        const dt1 = (path[i].time - path[i-1].time) / (1000 * 3600);
        const dt2 = (path[i+1].time - path[i].time) / (1000 * 3600);
        
        // Price deltas
        const dp1 = path[i].price - path[i-1].price;
        const dp2 = path[i+1].price - path[i].price;
        
        // Calculate velocity vectors (speed of light varies with refractive index)
        const v1 = dp1 / ((dt1 || 0.001) * path[i-1].resistance);
        const v2 = dp2 / ((dt2 || 0.001) * path[i].resistance);
        
        // Acceleration = change in velocity over time
        const acceleration = (v2 - v1) / (dt1 + dt2);
        
        // Force = mass * acceleration (mass proportional to resistance)
        const force = acceleration * path[i].resistance;
        
        // Calculate momentum components with improved scaling
        // Use a normalized time component for consistent visualization
        const dx = 1;
        
        // Scale dy for better visibility - this is the important directional component
        const dy = v2 * 20; // Amplify for visibility
        
        // Calculate magnitude and direction
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        const direction = Math.atan2(dy, dx);
        
        momentumVectors.push({
            x: path[i].time,
            y: path[i].price,
            dx,
            dy,
            magnitude,
            direction,
            force // Store force for confidence calculation
        });
        
        // Calculate prediction confidence based on physical principles
        // 1. Consistency of force direction (stable forces = higher confidence)
        const forceConsistency = i > 1 ? 
            Math.abs(Math.cos(momentumVectors[i-1].direction - direction)) : 0.5;
        
        // 2. Light speeds up in areas of low refractive index (low resistance)
        const speedFactor = 1 / path[i].resistance;
        
        // 3. Path predictability based on density gradients
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
} 