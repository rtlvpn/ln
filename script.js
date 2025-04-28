document.addEventListener('DOMContentLoaded', function() {
    // Order Book Momentum (OBM) calculation functions
    
    // Calculate density-weighted average price at a specific time
    function calculateWeightedAvgPrice(priceVolumes) {
        let weightedSum = 0;
        let totalVolume = 0;
        
        for (let i = 0; i < priceVolumes.prices.length; i++) {
            const price = priceVolumes.prices[i];
            const volume = Math.abs(priceVolumes.volumes[i]);
            
            weightedSum += price * volume;
            totalVolume += volume;
        }
        
        return totalVolume > 0 ? weightedSum / totalVolume : 0;
    }
    
    // Calculate price standard deviation weighted by density
    function calculateWeightedStdDev(priceVolumes, avgPrice) {
        let weightedSumSq = 0;
        let totalVolume = 0;
        
        for (let i = 0; i < priceVolumes.prices.length; i++) {
            const price = priceVolumes.prices[i];
            const volume = Math.abs(priceVolumes.volumes[i]);
            
            weightedSumSq += Math.pow(price - avgPrice, 2) * volume;
            totalVolume += volume;
        }
        
        return totalVolume > 0 ? Math.sqrt(weightedSumSq / totalVolume) : 1; // Default to 1 to avoid division by zero
    }
    
    // Calculate Order Book Momentum with time series techniques
    function calculateOBM(heatmapData) {
        const result = {
            timestamps: [],
            obmValues: [],
            trendStrength: [],
            forecastValues: [],
            signals: [],
            signalStrengths: []
        };
        
        if (heatmapData.heatmap.length < 10) return result; // Need enough data for time series analysis
        
        // Calculate raw OBM values first (similar to current approach but storing intermediates)
        const rawImbalances = [];
        const imbalanceChanges = [];
        const rawOBMValues = [];
        
        for (let i = 1; i < heatmapData.heatmap.length; i++) {
            const currentPriceVolumes = {
                prices: heatmapData.priceLevels, 
                volumes: heatmapData.heatmap[i].volumes
            };
            
            // Find the middle price index to separate buy/sell sides
            const middleIndex = Math.floor(currentPriceVolumes.prices.length / 2);
            
            // Calculate buy pressure (volume below middle) and sell pressure (volume above middle)
            let buyPressure = 0;
            let sellPressure = 0;
            
            for (let j = 0; j < currentPriceVolumes.prices.length; j++) {
                const volume = Math.abs(currentPriceVolumes.volumes[j]);
                
                // Weight by distance from middle (further away has more impact)
                const distanceFactor = Math.abs(j - middleIndex) / middleIndex;
                const weightedVolume = volume * (1 + distanceFactor);
                
                if (j < middleIndex) {
                    buyPressure += weightedVolume;
                } else {
                    sellPressure += weightedVolume;
                }
            }
            
            // Calculate order book imbalance ratio
            const totalPressure = buyPressure + sellPressure;
            const imbalance = totalPressure > 0 ? (buyPressure - sellPressure) / totalPressure : 0;
            rawImbalances.push(imbalance);
            
            // Calculate rate of change of imbalance (if we have previous data)
            let imbalanceChange = 0;
            if (i > 1) {
                const prevImbalance = rawImbalances[rawImbalances.length - 2];
                
                // Calculate delta time between measurements for more accurate rate
                const currentTimestamp = heatmapData.timestamps[i];
                const prevTimestamp = heatmapData.timestamps[i-1];
                const deltaTime = Math.max(1, (currentTimestamp - prevTimestamp) / 60); // In minutes
                
                // Rate of change of imbalance
                imbalanceChange = (imbalance - prevImbalance) / deltaTime;
            }
            imbalanceChanges.push(imbalanceChange);
            
            // Raw OBM value (will be processed with time series techniques)
            const rawObm = imbalance * 0.3 + imbalanceChange * 0.7;
            rawOBMValues.push(rawObm);
            
            result.timestamps.push(new Date(heatmapData.timestamps[i] * 1000));
        }
        
        // Apply time series techniques to the raw OBM values
        
        // 1. Exponential Moving Average (EMA) to reduce noise
        const emaAlpha = 0.2; // Smoothing factor
        const emaValues = [];
        
        for (let i = 0; i < rawOBMValues.length; i++) {
            if (i === 0) {
                emaValues.push(rawOBMValues[i]);
            } else {
                // EMA = currentValue * alpha + previousEMA * (1 - alpha)
                const ema = rawOBMValues[i] * emaAlpha + emaValues[i-1] * (1 - emaAlpha);
                emaValues.push(ema);
            }
        }
        
        // 2. Calculate trend strength using linear regression
        const trendStrengthValues = [];
        const windowSize = Math.min(10, Math.floor(rawOBMValues.length / 3));
        
        for (let i = 0; i < rawOBMValues.length; i++) {
            if (i < windowSize) {
                // Not enough data for trend calculation
                trendStrengthValues.push(0);
            } else {
                // Use linear regression on the window to calculate trend
                const window = rawOBMValues.slice(i - windowSize, i);
                const trend = calculateLinearRegressionSlope(window);
                trendStrengthValues.push(trend);
            }
        }
        
        // 3. Forecast future values using simple autoregression
        const forecastValues = [];
        const forecastLag = 3; // How many past values to use
        
        for (let i = 0; i < rawOBMValues.length; i++) {
            if (i < forecastLag) {
                // Not enough data for forecasting
                forecastValues.push(null);
            } else {
                // Simple autoregression model with exponentially weighted past values
                let forecast = 0;
                let weightSum = 0;
                
                for (let j = 1; j <= forecastLag; j++) {
                    const weight = Math.exp(-0.5 * j); // Exponential weighting
                    forecast += emaValues[i-j] * weight;
                    weightSum += weight;
                }
                
                // Add trend component to forecast
                forecast = forecast / weightSum + trendStrengthValues[i] * 0.5;
                forecastValues.push(forecast);
            }
        }
        
        // 4. Final OBM values combine EMA, trend strength, and momentum
        for (let i = 0; i < emaValues.length; i++) {
            // Enhanced OBM value with trend momentum
            const enhancedObm = emaValues[i] + trendStrengthValues[i] * 0.3;
            result.obmValues.push(enhancedObm);
            result.trendStrength.push(trendStrengthValues[i]);
            result.forecastValues.push(forecastValues[i]);
        }
        
        // Add explicit trading signals
        result.signals = [];
        result.signalStrengths = [];
        
        // For signal generation - need at least 5 data points
        if (result.obmValues.length >= 5) {
            // Variables to track signal state
            let inLongPosition = false;
            let inShortPosition = false;
            let lastSignalIndex = -10; // Prevent rapid signal switching
            const signalCooldown = 5; // Minimum points between signals
            
            // Calculate smoothed momentum for better signal quality
            const smoothedOBM = exponentialMovingAverage(result.obmValues, 0.15);
            const secondSmoothing = exponentialMovingAverage(smoothedOBM, 0.25);
            
            // Add signal momentum divergence tracking
            const divergences = findDivergences(smoothedOBM, secondSmoothing);
            
            for (let i = 3; i < result.obmValues.length; i++) {
                // Default - no signal
                let signal = "NONE";
                let signalStrength = 0;
                
                // Get current momentum values and trends
                const obm = smoothedOBM[i];
                const obmPrev = smoothedOBM[i-1];
                const obmPrev2 = smoothedOBM[i-2];
                const trend = result.trendStrength[i] || 0;
                
                // Check for strong zero-line crossover (more reliable signals)
                const crossedAboveZero = obmPrev <= 0 && obm > 0 && trend > 0;
                const crossedBelowZero = obmPrev >= 0 && obm < 0 && trend < 0;
                
                // Momentum reversal after exhaustion (strong signals)
                const bullishReversal = obm > 0 && obmPrev < obmPrev2 && obm > obmPrev && trend > 0;
                const bearishReversal = obm < 0 && obmPrev > obmPrev2 && obm < obmPrev && trend < 0;
                
                // Check for divergences (strongest signals)
                const hasBullishDivergence = divergences.bullish.includes(i);
                const hasBearishDivergence = divergences.bearish.includes(i);
                
                // Calculate signal strength factors
                const zeroCrossFactor = 0.6;
                const reversalFactor = 0.8;
                const divergenceFactor = 1.0;
                const trendFactor = Math.min(1.0, Math.abs(trend) * 10);
                const momentumFactor = Math.min(1.0, Math.abs(obm) * 2);
                
                // LONG ENTRY conditions (BUY signal)
                if ((crossedAboveZero || bullishReversal || hasBullishDivergence) && 
                    !inLongPosition && i - lastSignalIndex > signalCooldown) {
                    
                    signal = "BUY";
                    inLongPosition = true;
                    inShortPosition = false;
                    lastSignalIndex = i;
                    
                    // Calculate signal strength (0-100%)
                    if (hasBullishDivergence) {
                        signalStrength = Math.min(100, Math.round((divergenceFactor + trendFactor + momentumFactor) * 33));
                    } else if (bullishReversal) {
                        signalStrength = Math.min(100, Math.round((reversalFactor + trendFactor + momentumFactor) * 25));
                    } else {
                        signalStrength = Math.min(100, Math.round((zeroCrossFactor + trendFactor + momentumFactor) * 20));
                    }
                }
                // LONG EXIT or SHORT ENTRY conditions (SELL signal)
                else if ((crossedBelowZero || bearishReversal || hasBearishDivergence) && 
                         !inShortPosition && i - lastSignalIndex > signalCooldown) {
                    
                    signal = "SELL";
                    inLongPosition = false;
                    inShortPosition = true;
                    lastSignalIndex = i;
                    
                    // Calculate signal strength (0-100%)
                    if (hasBearishDivergence) {
                        signalStrength = Math.min(100, Math.round((divergenceFactor + trendFactor + momentumFactor) * 33));
                    } else if (bearishReversal) {
                        signalStrength = Math.min(100, Math.round((reversalFactor + trendFactor + momentumFactor) * 25));
                    } else {
                        signalStrength = Math.min(100, Math.round((zeroCrossFactor + trendFactor + momentumFactor) * 20));
                    }
                }
                
                result.signals.push(signal);
                result.signalStrengths.push(signalStrength);
            }
        }
        
        return result;
    }
    
    // Helper function to calculate linear regression slope (trend)
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
    
    // Helper function for EMA calculation
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
    
    // Helper function to find momentum divergences
    function findDivergences(momentum, price) {
        const bullishDivergenceIndices = [];
        const bearishDivergenceIndices = [];
        const lookbackWindow = 10;
        
        // Find local minimums and maximums within lookback window
        for (let i = lookbackWindow; i < momentum.length - 1; i++) {
            // Check for price making lower lows while momentum makes higher lows (bullish)
            const isPriceLowerLow = findLowestInRange(price, i - lookbackWindow, i) === i;
            const isMomentumHigherLow = momentum[i] > momentum[findLowestInRange(momentum, i - lookbackWindow, i)];
            
            if (momentum[i] < 0 && isPriceLowerLow && isMomentumHigherLow) {
                bullishDivergenceIndices.push(i);
            }
            
            // Check for price making higher highs while momentum makes lower highs (bearish)
            const isPriceHigherHigh = findHighestInRange(price, i - lookbackWindow, i) === i;
            const isMomentumLowerHigh = momentum[i] < momentum[findHighestInRange(momentum, i - lookbackWindow, i)];
            
            if (momentum[i] > 0 && isPriceHigherHigh && isMomentumLowerHigh) {
                bearishDivergenceIndices.push(i);
            }
        }
        
        return {
            bullish: bullishDivergenceIndices,
            bearish: bearishDivergenceIndices
        };
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
    
    // Keep track of the last timestamp we've fetched
    let lastFetchTime = 0;
    let cachedCandlestickData = [];
    let cachedHeatmapData = { timestamps: [], priceLevels: [], heatmap: [] };
    let currentTimeRange = '';
    
    // Set default date values (today and yesterday)
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    document.getElementById('endDate').valueAsDate = today;
    document.getElementById('startDate').valueAsDate = yesterday;
    
    // Add event listener for date range mode toggle
    document.getElementById('dateRangeMode').addEventListener('change', function() {
        const isCustomMode = this.value === 'custom';
        document.getElementById('fromNowControls').style.display = isCustomMode ? 'none' : 'block';
        document.getElementById('customRangeControls').style.display = isCustomMode ? 'block' : 'none';
    });
    
    // Initial load
    loadData(true); // true indicates a full load
    
    // Set up event listeners
    document.getElementById('refreshBtn').addEventListener('click', () => loadData(true)); // Full refresh on button click
    document.getElementById('timeRange').addEventListener('change', () => loadData(true)); // Full refresh on time range change
    document.getElementById('buckets').addEventListener('change', () => loadData(true)); // Full refresh on buckets change
    document.getElementById('startDate').addEventListener('change', () => loadData(true)); // Full refresh on start date change
    document.getElementById('endDate').addEventListener('change', () => loadData(true)); // Full refresh on end date change
    document.getElementById('startTime').addEventListener('change', () => loadData(true)); // Full refresh on start time change
    document.getElementById('endTime').addEventListener('change', () => loadData(true)); // Full refresh on end time change
    document.getElementById('dateRangeMode').addEventListener('change', () => loadData(true)); // Full refresh on mode change
    document.getElementById('colorDensity').addEventListener('input', function() {
        document.getElementById('densityValue').textContent = this.value;
        // Only adjust the colorscale weighting without changing data
        const existingData = Plotly.data('chart');
        if (existingData && existingData.length >= 2) {
            const colorDensity = parseInt(this.value);
            Plotly.restyle('chart', {
                'colorscale': [generateWeightedColorscale(colorDensity)]
            }, [0]); // Apply to the heatmap trace only (index 0)
        }
    });
    
    // Add event listener for the CVP checkbox
    document.getElementById('showCVP').addEventListener('change', function() {
        toggleCVPDisplay();
        // Re-render the chart with the current data to update layouts
        if (cachedCandlestickData.length && cachedHeatmapData.timestamps.length) {
            renderChart(cachedCandlestickData, cachedHeatmapData);
        }
    });
    
    // Function to toggle CVP display and adjust main chart width
    function toggleCVPDisplay() {
        const showCVP = document.getElementById('showCVP').checked;
        const mainChart = document.getElementById('chart');
        const cvpChart = document.getElementById('cvpChart');
        
        if (showCVP) {
            mainChart.style.width = '75%';
            cvpChart.style.display = 'block';
        } else {
            mainChart.style.width = '100%';
            cvpChart.style.display = 'none';
        }
        
        // Trigger a window resize event to make Plotly adjust
        window.dispatchEvent(new Event('resize'));
    }
    
    // Initialize the display state
    toggleCVPDisplay();
    
    // Auto refresh every minute - use incremental update
    setInterval(() => loadData(false), 12000000);
    
    // Add event listener for margin percent slider
    document.getElementById('marginPercent').addEventListener('input', function() {
        document.getElementById('marginValue').textContent = this.value;
    });
    
    function loadData(fullRefresh = false) {
        const dateRangeMode = document.getElementById('dateRangeMode').value;
        const buckets = document.getElementById('buckets').value;
        const marginPercent = document.getElementById('marginPercent').value;
        
        let startTime, endTime;
        
        if (dateRangeMode === 'fromNow') {
            // Get the current time range selection
            const timeRange = document.getElementById('timeRange').value;
            
            // If time range or buckets changed, we need a full refresh
            if (timeRange !== currentTimeRange || fullRefresh) {
                currentTimeRange = timeRange;
            }
            
            // Always recalculate the time range on every refresh
            // Calculate time range in seconds
            let duration;
            switch (timeRange) {
                case '1h': duration = 3600; break;
                case '3h': duration = 3600 * 3; break;
                case '6h': duration = 3600 * 6; break;
                case '9h': duration = 3600 * 9; break;
                case '12h': duration = 3600 * 12; break;
                case '15h': duration = 3600 * 15; break;
                case '18h': duration = 3600 * 18; break;
                case '24h': duration = 3600 * 24; break;
                case '48h': duration = 3600 * 48; break;
                case '72h': duration = 3600 * 72; break;
                case '96h': duration = 3600 * 96; break;
                case '120h': duration = 3600 * 120; break;
                case '144h': duration = 3600 * 144; break;
                case '168h': duration = 3600 * 168; break;
                default: duration = 3600;
            }
            
            // Calculate actual start and end times
            const currentTime = new Date().getTime();
            startTime = currentTime - duration * 1000;
            endTime = currentTime;
        } else {
            // Use custom date range
            const startDate = document.getElementById('startDate').valueAsDate;
            const endDate = document.getElementById('endDate').valueAsDate;
            const startTimeMs = startDate.getTime();
            const endTimeMs = endDate.getTime();
            
            // Calculate time range in seconds
            const duration = (endTimeMs - startTimeMs) / 1000;
            
            // Calculate actual start and end times
            startTime = startTimeMs / 1000;
            endTime = startTime + duration;
        }
        
        // Fetch data from server
        fetchData(startTime, endTime, buckets, marginPercent);
    }
    
    // ... rest of the existing code ...
}); 