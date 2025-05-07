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
        document.getElementById('simulationChart').innerHTML = '<div class="no-data-message">No prediction data available</div>';
        return;
    }
    
    // Get path count for adaptive rendering
    const pathCount = predictionData.predictedPaths.length;
    
    // Create an array for all the traces
    const traces = [];
    
    // Use color gradient for better path differentiation
    predictionData.predictedPaths.forEach((pathData, pathIndex) => {
        // Calculate color using HSL for a better visual spectrum
        const hue = (pathIndex / pathCount) * 120; // Use green spectrum (0-120)
        const pathColor = `hsla(${hue}, 100%, 50%, 0.7)`; // Higher opacity for better visibility
        
        traces.push({
            x: pathData.map(p => p.time),
            y: pathData.map(p => p.price),
            type: 'scatter',
            mode: 'lines',
            name: `Path ${pathIndex + 1}`,
            line: {
                shape: 'linear', // Use linear instead of spline for light ray effect
                color: pathColor,
                width: 1.5
            },
            // Enhanced hover information
            hoverinfo: 'text',
            hovertext: pathData.map(p => `
                Path ${pathIndex + 1}<br>
                Time: ${p.time.toLocaleTimeString()}<br>
                Price: $${p.price.toFixed(6)}`
            ),
            hoverlabel: {
                bgcolor: '#0a192f',
                bordercolor: pathColor,
                font: { family: 'Arial, sans-serif', size: 12 }
            }
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
        
        // Add ensemble prediction (mean) with enhanced hover
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
            },
            hoverinfo: 'text',
            hovertext: timePoints.map((time, i) => `
                Ensemble Prediction<br>
                Time: ${time.toLocaleTimeString()}<br>
                Price: $${avgPrices[i].toFixed(6)}<br>
                Std Dev: ${stdDevs[i].toFixed(6)}`
            ),
            hoverlabel: {
                bgcolor: '#0a192f',
                bordercolor: 'rgba(255, 215, 0, 1)',
                font: { family: 'Arial, sans-serif', size: 12 }
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
            type: 'scatter',
            hoverinfo: 'text',
            hovertext: 'Confidence Interval: 68% of outcomes expected in this range',
            hoverlabel: {
                bgcolor: '#0a192f',
                font: { family: 'Arial, sans-serif', size: 12 }
            }
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
            type: 'scatter',
            hoverinfo: 'text',
            hovertext: 'Confidence Interval: 95% of outcomes expected in this range',
            hoverlabel: {
                bgcolor: '#0a192f',
                font: { family: 'Arial, sans-serif', size: 12 }
            }
        });
    }
    
    // Add Momentum Vectors as arrows
    if (predictionData.momentumVectorsCollection && predictionData.momentumVectorsCollection.length > 0) {
        // Create a merged momentum vectors array from all paths for a cleaner visualization
        const allMomentumVectors = [];
        
        // Adaptive step size based on vector count for optimal display
        const vectorsLength = predictionData.momentumVectorsCollection[0].length;
        const step = Math.max(1, Math.floor(vectorsLength / Math.min(15, Math.max(5, Math.floor(window.innerWidth / 100)))));
        
        // Select a representative path (use the ensemble path which is most central)
        const centralPathIndex = Math.floor(predictionData.momentumVectorsCollection.length / 2);
        const momentumVectors = predictionData.momentumVectorsCollection[centralPathIndex];
        
        // Add arrows for momentum vectors at intervals
        for (let i = 0; i < momentumVectors.length; i += step) {
            const vector = momentumVectors[i];
            if (!vector || !vector.x || !vector.y) continue;
            
            // Responsive scaling for arrow length
            const viewportScale = Math.max(0.6, Math.min(1.2, window.innerWidth / 1200));
            const scaleFactor = 0.00005 * Math.min(20, Math.max(1, Math.abs(vector.magnitude))) * viewportScale;
            
            // Calculate arrow end points
            const endX = new Date(vector.x.getTime() + 3600000 * scaleFactor); // 1 hour × scale
            
            // Direction is determined by the force (positive = up, negative = down)
            const direction = vector.force || 0;
            const arrowLength = Math.min(0.001, Math.abs(direction) * 0.0001) * viewportScale;
            const endY = vector.y + (direction > 0 ? arrowLength : -arrowLength);
            
            // Determine color based on force (upward = blue, downward = red) with improved visibility
            const intensity = Math.min(1, Math.abs(direction) * 2);
            const color = direction > 0 ? 
                `rgba(0, 140, 255, ${intensity})` : 
                `rgba(255, 70, 70, ${intensity})`;
            
            // Determine arrow thickness based on magnitude with better visibility
            const arrowWidth = Math.min(5, Math.max(1.5, Math.abs(vector.magnitude) / 2));
            
            // Add momentum vector arrow with improved hover info
            traces.push({
                x: [vector.x, endX],
                y: [vector.y, endY],
                mode: 'lines',
                line: {
                    color: color,
                    width: arrowWidth
                },
                type: 'scatter',
                showlegend: i === 0, // Only show in legend once
                name: 'Momentum Vector',
                hoverinfo: 'text',
                hovertext: `
                    <b>${direction > 0 ? 'Upward' : 'Downward'} Force</b><br>
                    Magnitude: ${vector.magnitude.toFixed(4)}<br>
                    Force: ${direction.toFixed(6)}<br>
                    Time: ${vector.x.toLocaleTimeString()}<br>
                    Price: $${vector.y.toFixed(6)}
                `,
                hoverlabel: {
                    bgcolor: '#0a192f',
                    bordercolor: color,
                    font: { family: 'Arial, sans-serif', size: 12 }
                }
            });
        }
        
        // Add Force Heatmap along the price path
        const forceValues = momentumVectors.map(v => v?.force || 0);
        const timePoints = momentumVectors.map(v => v?.x || new Date());
        const pricePoints = momentumVectors.map(v => v?.y || 0);
        
        // Create a colorscale for forces (blue for upward, red for downward)
        const maxForce = Math.max(...forceValues.map(Math.abs));
        const normalizedForces = forceValues.map(f => f / (maxForce || 1));
        
        // Add force indicator trace with improved hover
        traces.push({
            x: timePoints,
            y: pricePoints,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 8, // Increased for better visibility
                color: normalizedForces,
                colorscale: [
                    [0, 'rgba(255, 50, 50, 0.8)'],     // Red for negative force
                    [0.5, 'rgba(220, 220, 220, 0.4)'], // White/transparent for zero
                    [1, 'rgba(0, 140, 255, 0.8)']      // Blue for positive force
                ],
                colorbar: {
                    title: {
                        text: 'Market Force',
                        font: {
                            color: '#00ff9d',
                            family: 'Arial, sans-serif'
                        }
                    },
                    titleside: 'right',
                    thickness: 15,
                    len: 0.5,
                    y: 0.5,
                    tickfont: {
                        color: '#999'
                    },
                    outlinecolor: '#333'
                },
                showscale: true,
                line: {
                    width: 1,
                    color: '#0a192f'
                }
            },
            name: 'Market Force',
            showlegend: true,
            hoverinfo: 'text',
            hovertext: forceValues.map((f, i) => {
                const direction = f > 0 ? 'Upward' : f < 0 ? 'Downward' : 'Neutral';
                const magnitude = Math.abs(f);
                return `
                    <b>${direction} Market Force</b><br>
                    Strength: ${f.toFixed(6)}<br>
                    Time: ${timePoints[i].toLocaleTimeString()}<br>
                    Price: $${pricePoints[i].toFixed(6)}
                `;
            }),
            hoverlabel: {
                bgcolor: '#0a192f',
                bordercolor: '#00ff9d',
                font: { family: 'Arial, sans-serif', size: 12 }
            }
        });
    }
    
    // Configure layout with responsive design
    const layout = {
        title: {
            text: `Fermat Light Ray Price Prediction (${pathCount} Paths)`,
            font: {
                family: 'Arial, sans-serif',
                size: 24,
                color: '#00ff00'
            },
            pad: {
                t: 10,
                b: 10
            }
        },
        paper_bgcolor: '#0a0a14',
        plot_bgcolor: '#0a0a14',
        xaxis: {
            title: {
                text: 'Time',
                font: {
                    family: 'Arial, sans-serif',
                    size: 14,
                    color: '#aaa'
                }
            },
            showgrid: true,
            gridcolor: '#111',
            gridwidth: 1,
            tickfont: { color: '#666', size: 12 },
            titlefont: { color: '#888' },
            automargin: true,
            rangeslider: {
                visible: false,
                thickness: 0.05
            },
            showspikes: true,
            spikecolor: '#00ff9d',
            spikethickness: 1,
            spikemode: 'across',
            spikesnap: 'cursor'
        },
        yaxis: {
            title: {
                text: 'Price (USD)',
                font: {
                    family: 'Arial, sans-serif',
                    size: 14,
                    color: '#aaa'
                }
            },
            showgrid: true,
            gridcolor: '#111',
            gridwidth: 1,
            tickfont: { color: '#666', size: 12 },
            titlefont: { color: '#888' },
            fixedrange: false,
            automargin: true,
            showspikes: true,
            spikecolor: '#00ff9d',
            spikethickness: 1,
            spikemode: 'across',
            spikesnap: 'cursor'
        },
        legend: {
            x: 1,
            y: 1.02,
            xanchor: 'right',
            yanchor: 'bottom',
            orientation: 'h',
            bgcolor: 'rgba(0, 34, 31, 0.7)',
            bordercolor: '#00544f',
            font: { color: '#00ff88' },
            itemsizing: 'constant',
            itemclick: 'toggleothers',
            itemdoubleclick: 'toggle'
        },
        margin: { 
            l: 60, 
            r: 60, 
            b: 60, 
            t: 60,
            pad: 10 
        },
        hovermode: 'closest',
        hoverdistance: 30,
        hoverlabel: {
            font: {
                family: 'Arial, sans-serif'
            },
            align: 'left'
        },
        // Add annotations
        annotations: [{
            x: 0.02,
            y: 0.98,
            xref: 'paper',
            yref: 'paper',
            text: '↑ Upward Force<br>↓ Downward Force',
            showarrow: false,
            font: {
                color: '#00ddff',
                size: 12
            },
            bgcolor: 'rgba(10, 25, 47, 0.8)',
            bordercolor: '#00544f',
            borderwidth: 1,
            borderpad: 4,
            align: 'left'
        }],
        // Add dark grid lines
        shapes: [{
            type: 'rect',
            xref: 'paper',
            yref: 'paper',
            x0: 0,
            y0: 0,
            x1: 1,
            y1: 1,
            opacity: 0.1,
            line: {
                color: '#00ff9d',
                width: 1
            },
            layer: 'below'
        }],
        // Responsive behavior 
        autosize: true
    };
    
    // Create the chart with better responsiveness
    Plotly.newPlot('simulationChart', traces, layout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'sendDataToCloud'],
        modeBarButtonsToAdd: [{
            name: 'Toggle Spike Lines',
            icon: Plotly.Icons.spikeline,
            click: function(gd) {
                const update = {
                    'xaxis.showspikes': !gd._fullLayout.xaxis.showspikes,
                    'yaxis.showspikes': !gd._fullLayout.yaxis.showspikes
                };
                Plotly.relayout(gd, update);
            }
        }],
        toImageButtonOptions: {
            format: 'png',
            filename: 'fermat_light_ray_prediction',
            height: 800,
            width: 1200,
            scale: 2
        },
        plotGlPixelRatio: window.devicePixelRatio || 2,
        staticPlot: false,
        doubleClick: 'reset',
        scrollZoom: true
    });
    
    // Add window resize handler for better responsiveness
    window.addEventListener('resize', function() {
        Plotly.Plots.resize(document.getElementById('simulationChart'));
    });
    
    // Add custom CSS styles for hover effect
    const style = document.createElement('style');
    style.textContent = `
        #simulationChart {
            transition: all 0.3s ease;
            box-shadow: 0 0 10px rgba(0, 255, 157, 0.2);
        }
        #simulationChart:hover {
            box-shadow: 0 0 20px rgba(0, 255, 157, 0.4);
        }
        .no-data-message {
            color: #ff5757;
            text-align: center;
            padding: 20px;
            font-family: 'Arial', sans-serif;
            font-size: 16px;
        }
        .js-plotly-plot .plotly .hoverlabel {
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        }
    `;
    document.head.appendChild(style);
} 