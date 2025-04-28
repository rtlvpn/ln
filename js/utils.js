// Helper functions used across the application

// Calculate linear regression slope (trend)
function calculateLinearRegressionSlope(values) {
    const n = values.length;
    
    if (n <= 1) return 0;
    
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
    }
    
    // Calculate slope of the best fit line
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}

// EMA calculation
function exponentialMovingAverage(data, alpha) {
    const results = [];
    if (data.length === 0) return results;
    
    results.push(data[0]);
    for (let i = 1; i < data.length; i++) {
        const ema = data[i] * alpha + results[i-1] * (1 - alpha);
        results.push(ema);
    }
    return results;
}

// Find index of lowest value in range
function findLowestInRange(data, start, end) {
    let lowestIndex = start;
    for (let i = start + 1; i <= end; i++) {
        if (data[i] < data[lowestIndex]) {
            lowestIndex = i;
        }
    }
    return lowestIndex;
}

// Find index of highest value in range
function findHighestInRange(data, start, end) {
    let highestIndex = start;
    for (let i = start + 1; i <= end; i++) {
        if (data[i] > data[highestIndex]) {
            highestIndex = i;
        }
    }
    return highestIndex;
}

// Generate a colorscale with weights adjusted by the density value
function generateWeightedColorscale(density) {
    const colorscale = [];
    
    // Base colors (from dark blue to bright yellow)
    const colors = [
        'rgb(10, 10, 50)',      // Dark blue
        'rgb(20, 40, 150)',     // #010102
        'rgb(30, 100, 200)',    // Lighter blue
        'rgb(40, 150, 220)',    // Cyan-blue
        'rgb(80, 200, 200)',    // Cyan
        'rgb(120, 220, 150)',   // Cyan-green
        'rgb(180, 240, 80)',    // Green-yellow
        'rgb(220, 250, 40)',    // Yellow-green
        'rgb(255, 235, 0)'      // Bright yellow
    ];
    
    // Set the baseline for minimal values
    colorscale.push([0, colors[0]]);
    
    // Apply non-linear distribution of colors based on density
    // Higher density = more color weight to lower values
    const power = (11 - density) / 2; // Convert to 0.5-5 range (inverse)
    
    for (let i = 1; i < colors.length; i++) {
        // Calculate position with weighting based on density
        // This emphasizes lower values when density is high
        let position = Math.pow(i / (colors.length - 1), power);
        colorscale.push([position, colors[i]]);
    }
    
    return colorscale;
}

// Find index of closest price in priceLevels array
function findClosestPriceIndex(priceLevels, targetPrice) {
    let closestIndex = 0;
    let minDifference = Math.abs(priceLevels[0] - targetPrice);
    
    for (let i = 1; i < priceLevels.length; i++) {
        const difference = Math.abs(priceLevels[i] - targetPrice);
        if (difference < minDifference) {
            minDifference = difference;
            closestIndex = i;
        }
    }
    
    return closestIndex;
}

// Calculate price volatility
function calculateVolatility(prices) {
    if (prices.length < 2) return 0.01; // Default if not enough data
    
    // Calculate returns
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    // Calculate standard deviation of returns (volatility)
    const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
    const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) || 0.01; // Avoid zero
} 