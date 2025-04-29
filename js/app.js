// Main application file that orchestrates the application functionality

// Global variables for application state
let lastFetchTime = 0;
let cachedCandlestickData = [];
let cachedHeatmapData = { timestamps: [], priceLevels: [], heatmap: [] };
let currentTimeRange = '';

document.addEventListener('DOMContentLoaded', function() {
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
    
    // Set up event listeners
    document.getElementById('refreshBtn').addEventListener('click', () => loadData(true)); // Full refresh on button click
    document.getElementById('timeRange').addEventListener('change', () => loadData(true)); // Full refresh on time range change
    document.getElementById('buckets').addEventListener('change', () => loadData(true)); // Full refresh on buckets change
    document.getElementById('startDate').addEventListener('change', () => loadData(true)); // Full refresh on start date change
    document.getElementById('endDate').addEventListener('change', () => loadData(true)); // Full refresh on end date change
    document.getElementById('startTime').addEventListener('change', () => loadData(true)); // Full refresh on start time change
    document.getElementById('endTime').addEventListener('change', () => loadData(true)); // Full refresh on end time change
    document.getElementById('dateRangeMode').addEventListener('change', () => loadData(true)); // Full refresh on mode change
    
    // Color density slider with live update
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
    
    // OBM display toggle
    document.getElementById('showOBM').addEventListener('change', handleOBMDisplayChange);
    
    // Add event listener for margin percent slider
    document.getElementById('marginPercent').addEventListener('input', function() {
        document.getElementById('marginValue').textContent = this.value;
    });
    
    // Initialize the CVP display state
    toggleCVPDisplay();
    
    // Initial data load
    loadData(true); // true indicates a full load
    
    // Auto refresh every 120 seconds (2 minutes)
    setInterval(() => loadData(false), 120000);
    
    // Set up event listener for the path count slider
    const pathCountSlider = document.getElementById('pathCount');
    const pathCountValue = document.getElementById('pathCountValue');
    
    if (pathCountSlider && pathCountValue) {
        // Update the displayed value when slider changes
        pathCountSlider.addEventListener('input', function() {
            pathCountValue.textContent = this.value;
        });
        
        // Re-render the chart when the slider value is changed and released
        pathCountSlider.addEventListener('change', function() {
            // Check if we have data cached
            if (window.cachedCandlestickData && window.cachedCandlestickData.length && 
                window.cachedHeatmapData && window.cachedHeatmapData.timestamps.length) {
                renderChart(window.cachedCandlestickData, window.cachedHeatmapData);
            }
        });
    }
    
    // Set up event listener for the simulation toggle
    const simulationToggle = document.getElementById('showSimulation');
    if (simulationToggle) {
        simulationToggle.addEventListener('change', function() {
            if (window.cachedCandlestickData && window.cachedHeatmapData) {
                // Only re-render the simulation chart if prediction data is cached
                if (window.cachedPredictionData) {
                    renderSimulationChart(window.cachedHeatmapData, window.cachedPredictionData);
                }
            }
        });
    }
    
    // High performance mode toggle
    const highPerformanceToggle = document.getElementById('highPerformanceMode');
    if (highPerformanceToggle) {
        highPerformanceToggle.addEventListener('change', function() {
            if (window.cachedCandlestickData && window.cachedHeatmapData && window.cachedPredictionData) {
                // Only re-render the simulation chart
                renderSimulationChart(window.cachedHeatmapData, window.cachedPredictionData);
            }
        });
    }
    
    // Add event listener for the main chart predictions toggle
    const mainChartPredictionsToggle = document.getElementById('showPredictionsOnMain');
    if (mainChartPredictionsToggle) {
        mainChartPredictionsToggle.addEventListener('change', function() {
            if (window.cachedCandlestickData && window.cachedHeatmapData) {
                // Re-render the full chart to apply the setting
                renderChart(window.cachedCandlestickData, window.cachedHeatmapData);
            }
        });
    }
});

// Function to load data from API
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
        
        endTime = Math.floor(Date.now() / 1000);
        startTime = endTime - duration;
    } else {
        // Custom date range mode
        const startDate = document.getElementById('startDate').valueAsDate;
        const endDate = document.getElementById('endDate').valueAsDate;
        const startTimeStr = document.getElementById('startTime').value;
        const endTimeStr = document.getElementById('endTime').value;
        
        // Parse time strings
        const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
        const [endHours, endMinutes] = endTimeStr.split(':').map(Number);
        
        // Set the time components
        startDate.setHours(startHours, startMinutes, 0, 0);
        endDate.setHours(endHours, endMinutes, 59, 999);
        
        // Convert to Unix timestamps (seconds)
        startTime = Math.floor(startDate.getTime() / 1000);
        endTime = Math.floor(endDate.getTime() / 1000);
    }
    
    // Show loading indicator or status
    const chartElement = document.getElementById('chart');
    chartElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #00ff9d;">Loading data...</div>';
    
    // Full refresh - fetch all data with margin percent parameter
    Promise.all([
        fetch(`https://heatmapeldritch.gleeze.com:3500/api/candlesticks?startTime=${startTime}&endTime=${endTime}&interval=60`),
        fetch(`https://heatmapeldritch.gleeze.com:3500/api/heatmap?startTime=${startTime}&endTime=${endTime}&buckets=${buckets}&marginPercent=${marginPercent}`)
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([candlestickData, heatmapData]) => {
        // Store the complete data
        cachedCandlestickData = candlestickData;
        cachedHeatmapData = heatmapData;
        lastFetchTime = endTime;
        
        // Share data with window object for access by other functions
        window.cachedCandlestickData = cachedCandlestickData;
        window.cachedHeatmapData = cachedHeatmapData;
        
        // Render visualization
        renderChart(cachedCandlestickData, cachedHeatmapData);
    })
    .catch(error => {
        console.error('Error fetching data:', error);
        chartElement.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Failed to load data. Please try again.</div>';
    });
}

// Update the data caching in your fetchData function
async function fetchData(timeframe) {
    try {
        // Fetch data code...
        
        // Calculate prediction data
        const predictionData = calculatePricePrediction(
            heatmapData, 
            candlestickData,
            parseInt(document.getElementById('pathCount').value) || 4
        );
        
        // Cache all data for reuse
        window.cachedCandlestickData = candlestickData;
        window.cachedHeatmapData = heatmapData;
        window.cachedPredictionData = predictionData;
        
        // Render the charts
        renderChart(candlestickData, heatmapData);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
} 