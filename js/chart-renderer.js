// Chart rendering functions

function renderChart(candlestickData, heatmapData) {
    // Get the current path count from the UI
    const pathCount = parseInt(document.getElementById('pathCount').value) || 4;
    
    if (!candlestickData.length || !heatmapData.timestamps.length) {
        document.getElementById('chart').innerHTML = 'No data available for the selected time range';
        return;
    }
    
    // Calculate Order Book Momentum
    const obmData = calculateOBM(heatmapData);
    
    // Calculate physics-based price prediction with path count
    const predictionData = calculatePricePrediction(heatmapData, candlestickData, pathCount);
    
    // Cache the prediction data for the simulation chart
    window.cachedPredictionData = predictionData;
    
    // Prepare price data
    const times = candlestickData.map(item => new Date(item.timestamp));
    const prices = candlestickData.map(item => item.close);
    
    // Prepare heatmap data
    const heatmapZ = [];
    const timestamps = heatmapData.timestamps.map(ts => new Date(ts * 1000));
    const priceLevels = heatmapData.priceLevels;
    
    // Convert the heatmap result to a matrix format that Plotly can use
    // Each row represents a price level, each column represents a timestamp
    for (let i = 0; i < priceLevels.length; i++) {
        const row = [];
        for (let j = 0; j < heatmapData.heatmap.length; j++) {
            // Get the volume for this price level at this timestamp
            const volume = Math.abs(heatmapData.heatmap[j].volumes[i]);
            row.push(volume);
        }
        heatmapZ.push(row);
    }
    
    // Find the price range from priceLevels for consistent scaling
    const minPrice = Math.min(...priceLevels);
    const maxPrice = Math.max(...priceLevels);
    
    // Create the combined plot
    const trace1 = {
        x: times,
        y: prices,
        mode: 'lines',
        name: 'Price',
        line: {
            shape: 'spline',
            color: 'rgba(255, 100, 100, 1)',
            width: 3
        },
        // Use the same y-axis as the heatmap
        yaxis: 'y',
        type: 'scatter'
    };
    
    // Get color density value
    const colorDensity = parseInt(document.getElementById('colorDensity').value);
    
    const trace2 = {
        x: timestamps,
        y: priceLevels,
        z: heatmapZ,
        type: 'heatmap',
        colorscale: generateWeightedColorscale(colorDensity),
        name: 'Order Density',
        colorbar: {
            title: 'Order Volume',
            titleside: 'right',
            titlefont: { color: '#00ff9d' },
            tickfont: { color: '#00ff9d' }
        },
        zsmooth: false,
        showscale: true
    };
    
    const layout = {
        title: {
            text: 'Milk Price and Orderbook Heatmap',
            font: {
                color: '#00ff9d',
                family: 'Courier New, monospace'
            }
        },
        plot_bgcolor: '#0a0a12',
        paper_bgcolor: '#0f0f1f',
        height: 600,
        yaxis: {
            title: {
                text: 'Price (USDT)',
                font: { color: '#00ff9d' }
            },
            side: 'left',
            range: [minPrice, maxPrice],
            autorange: false,
            showgrid: true,
            gridcolor: 'rgba(0, 255, 157, 0.1)',
            tickfont: { color: '#00ff9d' },
            zeroline: false
        },
        xaxis: {
            title: {
                text: 'Time',
                font: { color: '#00ff9d' }
            },
            showgrid: true,
            gridcolor: 'rgba(0, 255, 157, 0.1)',
            tickfont: { color: '#00ff9d' }
        },
        hovermode: 'closest',
        showlegend: true,
        legend: {
            font: { color: '#00ff9d' },
            bgcolor: 'rgba(10, 10, 18, 0.8)',
            bordercolor: '#00ff9d',
            borderwidth: 1
        },
        margin: {
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 4
        },
        autosize: true
    };
    
    Plotly.newPlot('chart', [trace2, trace1], layout, {responsive: true});
    
    // Create the volume profile chart if enabled
    const showCVP = document.getElementById('showCVP').checked;
    if (showCVP) {
        // Calculate aggregate volume for each price level
        const volumeByPrice = new Array(priceLevels.length).fill(0);
        
        for (let i = 0; i < priceLevels.length; i++) {
            for (let j = 0; j < heatmapData.heatmap.length; j++) {
                volumeByPrice[i] += Math.abs(heatmapData.heatmap[j].volumes[i]);
            }
        }
        
        // Create the Volume Profile trace as a vertical bar chart
        const cvpTrace = {
            y: priceLevels,
            x: volumeByPrice,
            type: 'bar',
            orientation: 'h',
            name: 'Volume Profile',
            marker: {
                color: 'rgba(0, 255, 157, 0.7)',
                line: {
                    color: 'rgba(0, 255, 157, 1)',
                    width: 1
                }
            }
        };
        
        const cvpLayout = {
            title: {
                text: 'Volume Profile',
                font: {
                    color: '#00ff9d',
                    family: 'Courier New, monospace'
                }
            },
            plot_bgcolor: '#0a0a12',
            paper_bgcolor: '#0f0f1f',
            height: 600,
            yaxis: {
                title: '',
                side: 'right',
                range: [minPrice, maxPrice],
                autorange: false,
                showgrid: true,
                gridcolor: 'rgba(0, 255, 157, 0.1)',
                tickfont: { color: '#00ff9d' },
                zeroline: false
            },
            xaxis: {
                title: {
                    text: 'Volume',
                    font: { color: '#00ff9d' }
                },
                showgrid: true,
                gridcolor: 'rgba(0, 255, 157, 0.1)',
                tickfont: { color: '#00ff9d' }
            },
            margin: {
                l: 0,
                r: 50,
                b: 50,
                t: 50,
                pad: 4
            },
            autosize: true
        };
        
        Plotly.newPlot('cvpChart', [cvpTrace], cvpLayout, {responsive: true});
    }
    
    // Create the OBM chart if enabled
    const showOBM = document.getElementById('showOBM').checked;
    if (showOBM && obmData.timestamps.length > 0) {
        // Add custom title div element
        document.getElementById('obmChart').innerHTML = '<div class="obm-title">ORDER BOOK MOMENTUM ANALYZER</div>';
        
        // Create detailed hover text for each data point
        const positiveHoverTexts = obmData.obmValues.map((val, i) => {
            if (val < 0) return null;
            let trend = obmData.trendStrength[i] || 0;
            let trendText = trend > 0.01 ? "ACCELERATING" : 
                          (trend < -0.01 ? "DECELERATING" : "STABLE");
            return `OBM: ${val.toFixed(4)}\nTrend: ${trendText}\nBULLISH SIGNAL`;
        });
        
        const negativeHoverTexts = obmData.obmValues.map((val, i) => {
            if (val > 0) return null;
            let trend = obmData.trendStrength[i] || 0;
            let trendText = trend < -0.01 ? "ACCELERATING" : 
                          (trend > 0.01 ? "DECELERATING" : "STABLE");
            return `OBM: ${val.toFixed(4)}\nTrend: ${trendText}\nBEARISH SIGNAL`;
        });
        
        // Create multiple traces for more visual appeal
        const obmTracePositive = {
            x: obmData.timestamps,
            y: obmData.obmValues.map(val => val >= 0 ? val : null),
            text: positiveHoverTexts,
            type: 'scattergl',
            mode: 'lines',
            name: 'Bullish Pressure',
            line: {
                shape: 'spline',
                color: 'rgba(0, 255, 157, 1)',
                width: 3
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(0, 255, 157, 0.2)',
            connectgaps: false,
            hoverinfo: 'text+x',
            hoverlabel: {
                bgcolor: 'rgba(0, 20, 40, 0.9)',
                bordercolor: 'rgba(0, 255, 157, 1)',
                font: {
                    family: 'Courier New, monospace',
                    size: 13,
                    color: '#00ff9d'
                }
            }
        };
        
        const obmTraceNegative = {
            x: obmData.timestamps,
            y: obmData.obmValues.map(val => val <= 0 ? val : null),
            text: negativeHoverTexts,
            type: 'scattergl',
            mode: 'lines',
            name: 'Bearish Pressure',
            line: {
                shape: 'spline',
                color: 'rgba(255, 41, 105, 1)',
                width: 3
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(255, 41, 105, 0.2)',
            connectgaps: false,
            hoverinfo: 'text+x',
            hoverlabel: {
                bgcolor: 'rgba(40, 0, 20, 0.9)',
                bordercolor: 'rgba(255, 41, 105, 1)',
                font: {
                    family: 'Courier New, monospace',
                    size: 13,
                    color: 'rgb(255, 150, 170)'
                }
            }
        };
        
        // Add forecast trace with dotted line
        const forecastTrace = {
            x: obmData.timestamps,
            y: obmData.forecastValues,
            type: 'scattergl',
            mode: 'lines',
            name: 'Forecast',
            line: {
                shape: 'spline',
                color: 'rgba(255, 255, 255, 0.6)',
                width: 2,
                dash: 'dot'
            },
            hoverinfo: 'y+x',
            hoverlabel: {
                bgcolor: 'rgba(30, 30, 60, 0.9)',
                bordercolor: 'rgba(255, 255, 255, 0.8)',
                font: {
                    family: 'Courier New, monospace',
                    size: 13,
                    color: 'rgb(255, 255, 255)'
                }
            }
        };
        
        // Add trend strength visualization
        const trendStrengthTrace = {
            x: obmData.timestamps,
            y: obmData.trendStrength,
            type: 'scattergl',
            mode: 'lines',
            name: 'Trend Strength',
            yaxis: 'y2',
            line: {
                shape: 'spline',
                color: 'rgba(180, 180, 255, 0.8)',
                width: 1.5
            },
            hoverinfo: 'y+x',
            hoverlabel: {
                bgcolor: 'rgba(30, 30, 60, 0.9)',
                bordercolor: 'rgba(180, 180, 255, 0.8)',
                font: {
                    family: 'Courier New, monospace',
                    size: 12,
                    color: 'rgb(200, 200, 255)'
                }
            }
        };
        
        // Add extreme points markers
        const highPoints = [], lowPoints = [];
        for (let i = 1; i < obmData.obmValues.length-1; i++) {
            const prev = obmData.obmValues[i-1];
            const curr = obmData.obmValues[i];
            const next = obmData.obmValues[i+1];
            
            if (curr > prev && curr > next && curr > 0.1) {
                highPoints.push({
                    x: obmData.timestamps[i],
                    y: curr,
                    text: `PEAK: ${curr.toFixed(3)}`
                });
            }
            
            if (curr < prev && curr < next && curr < -0.1) {
                lowPoints.push({
                    x: obmData.timestamps[i],
                    y: curr,
                    text: `TROUGH: ${curr.toFixed(3)}`
                });
            }
        }
        
        const extremeHighsTrace = {
            x: highPoints.map(p => p.x),
            y: highPoints.map(p => p.y),
            text: highPoints.map(p => p.text),
            type: 'scattergl',
            mode: 'markers',
            marker: {
                color: 'rgba(255, 255, 0, 0.8)',
                size: 8,
                symbol: 'diamond',
                line: {
                    color: 'rgba(255, 255, 255, 1)',
                    width: 1
                }
            },
            name: 'Momentum Peaks',
            hoverinfo: 'text+x',
            hoverlabel: {
                bgcolor: 'rgba(40, 40, 0, 0.9)',
                bordercolor: 'rgba(255, 255, 0, 1)',
                font: {
                    family: 'Courier New, monospace',
                    size: 13,
                    color: 'rgb(255, 255, 180)'
                }
            }
        };
        
        const extremeLowsTrace = {
            x: lowPoints.map(p => p.x),
            y: lowPoints.map(p => p.y),
            text: lowPoints.map(p => p.text),
            type: 'scattergl',
            mode: 'markers',
            marker: {
                color: 'rgba(255, 41, 105, 0.8)',
                size: 8,
                symbol: 'x',
                line: {
                    color: 'rgba(255, 255, 255, 1)',
                    width: 1
                }
            },
            name: 'Momentum Troughs',
            hoverinfo: 'text+x',
            hoverlabel: {
                bgcolor: 'rgba(40, 0, 20, 0.9)',
                bordercolor: 'rgba(255, 41, 105, 1)',
                font: {
                    family: 'Courier New, monospace',
                    size: 13,
                    color: 'rgb(255, 150, 170)'
                }
            }
        };
        
        const obmLayout = {
            plot_bgcolor: 'rgba(15, 15, 35, 0.9)',
            paper_bgcolor: 'rgba(10, 10, 25, 0)',
            height: 250,
            yaxis: {
                title: {
                    text: 'MOMENTUM SIGNAL',
                    font: { 
                        color: '#00ff9d',
                        size: 12,
                        family: 'Courier New, monospace'
                    }
                },
                zeroline: true,
                zerolinecolor: 'rgba(0, 255, 157, 0.7)',
                zerolinewidth: 2,
                gridcolor: 'rgba(0, 255, 157, 0.1)',
                gridwidth: 1,
                tickfont: { 
                    color: '#00ff9d',
                    family: 'Courier New, monospace',
                    size: 10
                },
                tickformat: '.3f',
                showticklabels: true,
                showline: true,
                linecolor: 'rgba(0, 255, 157, 0.5)',
                linewidth: 2,
                autorange: true,
                fixedrange: false
            },
            xaxis: {
                showgrid: true,
                gridcolor: 'rgba(0, 255, 157, 0.1)',
                tickfont: { 
                    color: '#00ff9d',
                    family: 'Courier New, monospace',
                    size: 10
                },
                range: [times[0], times[times.length - 1]] // Match time range with main chart
            },
            legend: {
                orientation: 'h',
                xanchor: 'center',
                yanchor: 'bottom',
                x: 0.5,
                y: 1,
                font: {
                    color: '#00ff9d',
                    family: 'Courier New, monospace',
                    size: 10
                },
                bgcolor: 'rgba(10, 10, 25, 0.7)',
                bordercolor: 'rgba(0, 255, 157, 0.5)',
                borderwidth: 1
            },
            margin: {
                l: 50,
                r: 50,
                b: 50,
                t: 60,
                pad: 4
            },
            autosize: true,
            shapes: [
                // Add horizontal regions for bullish/bearish/neutral that scale with the data
                {
                    type: 'rect',
                    xref: 'paper',
                    yref: 'paper',
                    x0: 0,
                    y0: 0.55,
                    x1: 1,
                    y1: 0.8,
                    fillcolor: 'rgba(0, 255, 157, 0.05)',
                    layer: 'below',
                    line: { width: 0 }
                },
                {
                    type: 'rect',
                    xref: 'paper',
                    yref: 'paper',
                    x0: 0,
                    y0: 0.45,
                    x1: 1,
                    y1: 0.55,
                    fillcolor: 'rgba(255, 255, 255, 0.03)',
                    layer: 'below',
                    line: { width: 0 }
                },
                {
                    type: 'rect',
                    xref: 'paper',
                    yref: 'paper',
                    x0: 0,
                    y0: 0.2,
                    x1: 1,
                    y1: 0.45,
                    fillcolor: 'rgba(255, 41, 105, 0.05)',
                    layer: 'below',
                    line: { width: 0 }
                }
            ],
            annotations: [
                {
                    x: 0.02,
                    y: 0.7,
                    xref: 'paper',
                    yref: 'paper',
                    text: 'BULLISH',
                    showarrow: false,
                    font: {
                        color: 'rgba(0, 255, 157, 0.5)',
                        size: 10,
                        family: 'Courier New, monospace'
                    }
                },
                {
                    x: 0.02,
                    y: 0.3,
                    xref: 'paper', 
                    yref: 'paper',
                    text: 'BEARISH',
                    showarrow: false,
                    font: {
                        color: 'rgba(255, 41, 105, 0.5)',
                        size: 10,
                        family: 'Courier New, monospace'
                    }
                }
            ],
            hovermode: 'closest',
            hoverdistance: 50,
            hoverlabel: {
                font: {
                    family: 'Courier New, monospace',
                    size: 13
                },
                borderwidth: 1
            },
            modebar: {
                bgcolor: 'rgba(10, 10, 25, 0.7)',
                color: '#00ff9d'
            },
            yaxis2: {
                title: {
                    text: 'TREND',
                    font: { 
                        color: 'rgba(180, 180, 255, 0.8)',
                        size: 10,
                        family: 'Courier New, monospace'
                    }
                },
                side: 'right',
                overlaying: 'y',
                showgrid: false,
                zeroline: true,
                zerolinecolor: 'rgba(180, 180, 255, 0.3)',
                zerolinewidth: 1,
                tickfont: { 
                    color: 'rgba(180, 180, 255, 0.8)',
                    family: 'Courier New, monospace',
                    size: 8
                },
                tickformat: '.3f',
                showticklabels: true,
                range: [-0.05, 0.05]
            }
        };
        
        // Change the plot order to ensure all points are hoverable
        Plotly.newPlot('obmChart', [
            obmTracePositive, 
            obmTraceNegative,
            forecastTrace,
            trendStrengthTrace,
            extremeHighsTrace, 
            extremeLowsTrace
        ], obmLayout, {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['select2d', 'lasso2d', 'toggleSpikelines'],
            toImageButtonOptions: {
                format: 'png',
                filename: 'orderbook_momentum_analyzer',
                height: 500,
                width: 1200,
                scale: 2
            }
        });
        
        // Add pulsing highlight when OBM crosses zero
        for (let i = 1; i < obmData.obmValues.length; i++) {
            if ((obmData.obmValues[i-1] < 0 && obmData.obmValues[i] > 0) ||
                (obmData.obmValues[i-1] > 0 && obmData.obmValues[i] < 0)) {
                
                Plotly.addTraces('obmChart', {
                    x: [obmData.timestamps[i]],
                    y: [obmData.obmValues[i]],
                    text: [`REVERSAL: ${obmData.obmValues[i].toFixed(3)}`],
                    type: 'scattergl',
                    mode: 'markers',
                    marker: {
                        color: 'rgba(255, 255, 255, 0.9)',
                        size: 10,
                        symbol: 'circle',
                        line: {
                            color: 'rgba(0, 255, 157, 1)',
                            width: 2
                        }
                    },
                    showlegend: false,
                    hoverinfo: 'text+x',
                    hoverlabel: {
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        bordercolor: 'rgba(0, 255, 157, 1)',
                        font: {
                            family: 'Courier New, monospace',
                            size: 13,
                            color: 'rgb(255, 255, 255)'
                        }
                    }
                });
            }
        }
    } else {
        document.getElementById('obmChart').style.display = 'none';
    }

    // After creating the main chart, check if we should show predictions
    if (document.getElementById('showPredictionsOnMain')?.checked && 
        predictionData.predictedPaths && 
        predictionData.predictedPaths.length > 0) {
        
        // Only show a limited subset of paths on the main chart for performance
        const maxPathsOnMain = 3; // Very limited for performance
        const pathsToShow = [];
        
        if (pathCount <= maxPathsOnMain) {
            // Show all paths if we have few
            for (let i = 0; i < pathCount; i++) {
                pathsToShow.push(i);
            }
        } else {
            // Show only the first, middle and last paths
            pathsToShow.push(0);
            pathsToShow.push(Math.floor(pathCount / 2));
            pathsToShow.push(pathCount - 1);
        }
        
        // Define colors for the selected paths
        const pathColors = [
            { line: 'rgba(255, 215, 0, 0.9)', arrow: 'rgba(255, 150, 0, ' },    // Gold/Orange
            { line: 'rgba(50, 200, 255, 0.9)', arrow: 'rgba(0, 150, 255, ' },   // Blue
            { line: 'rgba(255, 100, 255, 0.9)', arrow: 'rgba(255, 50, 255, ' }, // Pink/Purple
        ];
        
        // Original code for adding paths and arrows to main chart
        // - Modified to only show the selected subset of paths
        // ...
    } else {
        // Just add a note about the simulation chart
        const noteTrace = {
            x: [times[Math.floor(times.length/2)]],
            y: [prices[Math.floor(prices.length/2)]],
            type: 'scatter',
            mode: 'text',
            text: [`${pathCount} optical path predictions available in the simulation chart below`],
            textposition: 'top',
            textfont: {
                family: 'Arial, sans-serif',
                size: 12,
                color: 'rgba(0, 255, 0, 0.7)'
            },
            hoverinfo: 'none',
            showlegend: false
        };
        
        Plotly.addTraces('chart', noteTrace);
    }
    
    // Render the simulation chart separately
    renderSimulationChart(heatmapData, predictionData);
}

// Function to render charts when OBM display preference changes
function handleOBMDisplayChange() {
    document.getElementById('obmChart').style.display = document.getElementById('showOBM').checked ? 'block' : 'none';
    // Re-render if we have data
    if (window.cachedCandlestickData && window.cachedCandlestickData.length && 
        window.cachedHeatmapData && window.cachedHeatmapData.timestamps.length) {
        renderChart(window.cachedCandlestickData, window.cachedHeatmapData);
    }
    // Trigger resize to adjust layouts
    window.dispatchEvent(new Event('resize'));
}

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
    
    // Get path count for adaptive rendering
    const pathCount = predictionData.predictedPaths.length;
    
    // Create an array for all the paths
    const traces = [];
    
    // Use a full HSL color spectrum for better differentiation
    predictionData.predictedPaths.forEach((pathData, pathIndex) => {
        // Calculate color using full spectrum for better differentiation
        const hue = (pathIndex / pathCount) * 120; // Green spectrum
        const pathColor = `hsla(${hue}, 100%, 50%, 0.7)`; // Higher opacity for clarity
        
        traces.push({
            x: pathData.map(p => p.time),
            y: pathData.map(p => p.price),
            type: 'scatter',
            mode: 'lines',
            name: `Path ${pathIndex + 1}`,
            line: {
                shape: 'linear', // Linear for light ray effect
                color: pathColor,
                width: 1.5
            },
            hoverinfo: 'y+name', // Show price and path name on hover
            showlegend: true
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
    
    // Configure layout with grid showing
    const layout = {
        title: {
            text: `Fermat Light Ray Price Prediction (${pathCount} Paths)`,
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
            bgcolor: '#00221f',
            bordercolor: '#00544f',
            font: { color: '#00ff88' },
            itemsizing: 'constant'
        },
        margin: { l: 50, r: 50, b: 50, t: 50 },
        hovermode: 'closest'
    };
    
    // Create the chart
    Plotly.newPlot('simulationChart', traces, layout);
} 