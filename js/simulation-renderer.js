// Dedicated function for rendering the optical path simulation
function renderSimulationChart(heatmapData, predictionData) {
    // Check if we have data and the simulation toggle is on
    if (!document.getElementById('showSimulation').checked) {
        document.getElementById('simulationChart').classList.add('hidden-chart');
        return;
    } else {
        document.getElementById('simulationChart').classList.remove('hidden-chart');
    }
    
    if (!heatmapData || !predictionData || !predictionData.predictedPaths || !predictionData.predictedPaths.length) {
        document.getElementById('simulationChart').innerHTML = 'No prediction data available';
        return;
    }
    
    // Create an array for all the paths
    const traces = [];
    
    // Add all optical paths - these are the light ray paths
    predictionData.predictedPaths.forEach((pathData, pathIndex) => {
        traces.push({
            x: pathData.map(p => p.time),
            y: pathData.map(p => p.price),
            type: 'scatter',
            mode: 'lines',
            name: `Path ${pathIndex + 1}`,
            line: {
                shape: 'linear', // Use linear instead of spline for light ray effect
                color: 'rgba(0, 255, 0, 0.5)', // Green with transparency
                width: 1.5
            },
            hoverinfo: 'none' // Minimize hover info for cleaner look
        });
    });
    
    // Calculate ensemble prediction (average of all paths)
    if (predictionData.predictedPaths.length > 1) {
        // Create time points array from the first path
        const timePoints = predictionData.predictedPaths[0].map(p => p.time);
        
        // Calculate average price at each time point
        const avgPrices = timePoints.map((time, timeIndex) => {
            // Get all prices at this time index across all paths
            const prices = predictionData.predictedPaths
                .filter(path => path.length > timeIndex)
                .map(path => path[timeIndex].price);
                
            // Calculate mean
            return prices.reduce((sum, price) => sum + price, 0) / prices.length;
        });
        
        // Calculate standard deviation at each time point
        const stdDevs = timePoints.map((time, timeIndex) => {
            // Get all prices at this time index across all paths
            const prices = predictionData.predictedPaths
                .filter(path => path.length > timeIndex)
                .map(path => path[timeIndex].price);
                
            const mean = avgPrices[timeIndex];
            
            // Calculate variance
            const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
            
            // Return standard deviation
            return Math.sqrt(variance);
        });
        
        // Add ensemble prediction (mean)
        traces.push({
            x: timePoints,
            y: avgPrices,
            type: 'scatter',
            mode: 'lines',
            name: 'Ensemble Prediction',
            line: {
                shape: 'spline',
                color: 'rgba(255, 215, 0, 1)', // Gold
                width: 3
            }
        });
        
        // Add 68% confidence band (mean ± 1 stddev)
        traces.push({
            x: timePoints.concat(timePoints.slice().reverse()),
            y: avgPrices.map((avg, i) => avg + stdDevs[i])
                .concat(avgPrices.map((avg, i) => avg - stdDevs[i]).reverse()),
            fill: 'toself',
            fillcolor: 'rgba(255, 210, 0, 0.2)',
            line: { color: 'rgba(255, 210, 0, 0.5)', width: 1 },
            name: '68% Confidence',
            showlegend: true,
            type: 'scatter'
        });
        
        // Add 95% confidence band (mean ± 2 stddev)
        traces.push({
            x: timePoints.concat(timePoints.slice().reverse()),
            y: avgPrices.map((avg, i) => avg + 2 * stdDevs[i])
                .concat(avgPrices.map((avg, i) => avg - 2 * stdDevs[i]).reverse()),
            fill: 'toself',
            fillcolor: 'rgba(180, 150, 0, 0.15)',
            line: { color: 'rgba(180, 150, 0, 0.5)', width: 1 },
            name: '95% Confidence',
            showlegend: true,
            type: 'scatter'
        });
    }
    
    // Configure layout
    const layout = {
        title: {
            text: 'Fermat Light Ray Price Prediction',
            font: {
                family: 'Arial, sans-serif',
                size: 24,
                color: '#00ff00'
            }
        },
        paper_bgcolor: '#0a0a14',
        plot_bgcolor: '#0a0a14',
        xaxis: {
            title: 'Time',
            showgrid: true,
            gridcolor: '#111',
            gridwidth: 1,
            tickfont: { color: '#666' },
            titlefont: { color: '#888' }
        },
        yaxis: {
            title: 'Price (USD)',
            showgrid: true,
            gridcolor: '#111',
            gridwidth: 1,
            tickfont: { color: '#666' },
            titlefont: { color: '#888' },
            fixedrange: false
        },
        legend: {
            x: 1,
            xanchor: 'right',
            y: 1,
            bgcolor: '#00221f5b',
            bordercolor: '#00544f',
            font: { color: '#00ff88' }
        },
        margin: { l: 50, r: 50, b: 50, t: 50 },
        hovermode: 'closest'
    };
    
    // Create the chart
    Plotly.newPlot('simulationChart', traces, layout, {
        responsive: true,
        displayModeBar: true,
        plotGlPixelRatio: 2
    });
} 