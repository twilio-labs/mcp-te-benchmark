// Global data store
let allSessions = [];
let filteredSessions = [];
let charts = {};

async function loadData() {
    try {
        const response = await fetch('/metrics/summary.json');
        const data = await response.json();
        
        // Store the data globally
        allSessions = data;
        
        // Update last updated time
        document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
        
        // Populate MCP server filter
        const mcpServers = [...new Set(data.map(s => s.mcpServer || 'Unknown'))];
        const mcpServerFilter = document.getElementById('mcpServerFilter');
        populateFilter(mcpServerFilter, mcpServers);
        
        // Populate MCP client filter
        const mcpClients = [...new Set(data.map(s => s.mcpClient || 'Unknown'))];
        const mcpClientFilter = document.getElementById('mcpClientFilter');
        populateFilter(mcpClientFilter, mcpClients);
        
        // Populate model filter
        const models = [...new Set(data.map(s => s.model || 'Unknown'))];
        const modelFilter = document.getElementById('modelFilter');
        populateFilter(modelFilter, models);
        
        // Apply filters and update UI
        filterData();
        displayMetrics();
        displayModelMetrics();
        displaySessions();
        initCharts();
        updateCharts();
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data from summary.json. Please check if the file exists and is accessible.');
    }
}

function populateFilter(selectElement, options) {
    // Clear existing options except the first one (All)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Add new options
    options.sort().forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        selectElement.appendChild(optionElement);
    });
}

function filterData() {
    const mcpServerFilter = document.getElementById('mcpServerFilter').value;
    const mcpClientFilter = document.getElementById('mcpClientFilter').value;
    const modelFilter = document.getElementById('modelFilter').value;
    const taskFilter = document.getElementById('taskFilter').value;
    const modeFilter = document.getElementById('modeFilter').value;
    
    filteredSessions = allSessions.filter(session => {
        const matchesMcpServer = mcpServerFilter === 'all' || (session.mcpServer || 'Unknown') === mcpServerFilter;
        const matchesMcpClient = mcpClientFilter === 'all' || (session.mcpClient || 'Unknown') === mcpClientFilter;
        const matchesModel = modelFilter === 'all' || session.model === modelFilter || (!session.model && modelFilter === 'unknown');
        const matchesTask = taskFilter === 'all' || session.taskId.toString() === taskFilter;
        const matchesMode = modeFilter === 'all' || session.mode === modeFilter;
        
        return matchesMcpServer && matchesMcpClient && matchesModel && matchesTask && matchesMode;
    });
}

function displayMetrics() {
    const controlSessions = filteredSessions.filter(s => s.mode === 'control');
    const mcpSessions = filteredSessions.filter(s => s.mode === 'mcp');
    
    if (controlSessions.length === 0 || mcpSessions.length === 0) {
        document.getElementById('summary').innerHTML = '<p>No data available for the selected filters.</p>';
        return;
    }
    
    const metrics = {
        'Average Duration': {
            control: average(controlSessions.map(s => s.duration)) / 1000, // Convert to seconds
            mcp: average(mcpSessions.map(s => s.duration)) / 1000,
            unit: 'seconds'
        },
        'Average API Calls': {
            control: average(controlSessions.map(s => s.apiCalls)),
            mcp: average(mcpSessions.map(s => s.apiCalls)),
            unit: 'calls'
        },
        'Average Interactions': {
            control: average(controlSessions.map(s => s.interactions)),
            mcp: average(mcpSessions.map(s => s.interactions)),
            unit: 'messages'
        },
        'Average Tokens': {
            control: average(controlSessions.map(s => s.totalTokens || 0)),
            mcp: average(mcpSessions.map(s => s.totalTokens || 0)),
            unit: 'tokens'
        },
        'Average Cost': {
            control: average(controlSessions.map(s => s.cost || 0)),
            mcp: average(mcpSessions.map(s => s.cost || 0)),
            unit: '$'
        },
        'Success Rate': {
            control: percentage(controlSessions.filter(s => s.success).length, controlSessions.length),
            mcp: percentage(mcpSessions.filter(s => s.success).length, mcpSessions.length),
            unit: '%'
        }
    };
    
    // Update improvement stats
    const improvements = {
        time: percentageChange(metrics['Average Duration'].mcp, metrics['Average Duration'].control),
        calls: percentageChange(metrics['Average API Calls'].mcp, metrics['Average API Calls'].control),
        interactions: percentageChange(metrics['Average Interactions'].mcp, metrics['Average Interactions'].control),
        tokens: percentageChange(metrics['Average Tokens'].mcp, metrics['Average Tokens'].control),
        cost: percentageChange(metrics['Average Cost'].mcp, metrics['Average Cost'].control),
        success: percentageChange(metrics['Success Rate'].mcp, metrics['Success Rate'].control)
    };
    
    document.getElementById('improvementTime').textContent = `${-parseFloat(improvements.time)}%`;
    document.getElementById('improvementCalls').textContent = `${-parseFloat(improvements.calls)}%`;
    document.getElementById('improvementInteractions').textContent = `${-parseFloat(improvements.interactions)}%`;
    document.getElementById('improvementTokens').textContent = `${-parseFloat(improvements.tokens)}%`;
    document.getElementById('improvementCost').textContent = `${-parseFloat(improvements.cost)}%`;
    document.getElementById('improvementSuccess').textContent = `${improvements.success}%`;

    const summaryEl = document.getElementById('summary');
    summaryEl.innerHTML = Object.entries(metrics)
        .map(([title, values]) => {
            const change = percentageChange(values.mcp, values.control);
            const changeClass = (title === 'Success Rate' ? 
                parseFloat(change) > 0 : parseFloat(change) < 0) 
                ? 'change-positive' : 'change-negative';
            
            return `
                <div class="metric-card">
                    <div class="metric-title">${title}</div>
                    <div class="metric-unit">Measured in ${values.unit}</div>
                    <div class="metric-value">
                        <span class="mode">Control:</span>
                        <span>${values.control.toFixed(1)}${title.includes('Rate') ? '%' : ''}</span>
                    </div>
                    <div class="metric-value">
                        <span class="mode">MCP:</span>
                        <span>${values.mcp.toFixed(1)}${title.includes('Rate') ? '%' : ''}</span>
                    </div>
                    <div class="metric-value">
                        <span class="mode">Change:</span>
                        <span class="${changeClass}">${change}%</span>
                    </div>
                </div>
            `;
        }).join('');
}

function displayModelMetrics() {
    // Group sessions by model
    const models = {};
    filteredSessions.forEach(session => {
        const model = session.model || 'unknown';
        if (!models[model]) {
            models[model] = {
                control: [],
                mcp: []
            };
        }
        
        if (session.mode === 'control') {
            models[model].control.push(session);
        } else if (session.mode === 'mcp') {
            models[model].mcp.push(session);
        }
    });
    
    // Create metrics per model
    const modelMetricsEl = document.getElementById('modelMetrics');
    modelMetricsEl.innerHTML = '';
    
    for (const [model, data] of Object.entries(models)) {
        // Skip if there's no data for either control or MCP
        if (data.control.length === 0 || data.mcp.length === 0) continue;

        // Calculate task run counts
        const taskCounts = {
            control: {},
            mcp: {}
        };
        
        // Count control runs per task
        data.control.forEach(session => {
            taskCounts.control[session.taskId] = (taskCounts.control[session.taskId] || 0) + 1;
        });
        
        // Count MCP runs per task
        data.mcp.forEach(session => {
            taskCounts.mcp[session.taskId] = (taskCounts.mcp[session.taskId] || 0) + 1;
        });
        
        const metrics = {
            'Duration': {
                control: average(data.control.map(s => s.duration)) / 1000,
                mcp: average(data.mcp.map(s => s.duration)) / 1000,
                unit: 'seconds'
            },
            'API Calls': {
                control: average(data.control.map(s => s.apiCalls)),
                mcp: average(data.mcp.map(s => s.apiCalls)),
                unit: 'calls'
            },
            'Interactions': {
                control: average(data.control.map(s => s.interactions)),
                mcp: average(data.mcp.map(s => s.interactions)),
                unit: 'messages'
            },
            'Tokens': {
                control: average(data.control.map(s => s.totalTokens || 0)),
                mcp: average(data.mcp.map(s => s.totalTokens || 0)),
                unit: 'tokens'
            },
            'Cost': {
                control: average(data.control.map(s => s.cost || 0)),
                mcp: average(data.mcp.map(s => s.cost || 0)),
                unit: '$'
            },
            'Success Rate': {
                control: percentage(data.control.filter(s => s.success).length, data.control.length),
                mcp: percentage(data.mcp.filter(s => s.success).length, data.mcp.length),
                unit: '%'
            }
        };
        
        const section = document.createElement('div');
        section.className = 'model-section card';
        
        section.innerHTML = `
            <div class="model-title">Model: ${model}</div>
            <div class="run-counts-section">
                <div class="run-counts-title">Task Run Distribution</div>
                <div class="run-counts-grid">
                    ${[1, 2, 3].map(taskId => `
                        <div class="run-count-card">
                            <div class="run-count-title">Task ${taskId}</div>
                            <div class="run-count-values">
                                <div>Control: ${taskCounts.control[taskId] || 0}</div>
                                <div>MCP: ${taskCounts.mcp[taskId] || 0}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="model-metrics-grid">
                ${Object.entries(metrics).map(([title, values]) => {
                    const change = percentageChange(values.mcp, values.control);
                    const changeClass = (title === 'Success Rate' ? 
                        parseFloat(change) > 0 : parseFloat(change) < 0) 
                        ? 'change-positive' : 'change-negative';
                    
                    return `
                        <div class="compact-metric-card">
                            <div class="compact-metric-title">${title}</div>
                            <div class="compact-metric-content">
                                <div class="compact-metric-label">Control:</div>
                                <div class="compact-metric-value">${values.control.toFixed(1)}${title.includes('Rate') ? '%' : ''}</div>
                                <div class="compact-metric-label">MCP:</div>
                                <div class="compact-metric-value">${values.mcp.toFixed(1)}${title.includes('Rate') ? '%' : ''}</div>
                                <div class="compact-metric-label">Change:</div>
                                <div class="compact-metric-value ${changeClass}">${change}%</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        modelMetricsEl.appendChild(section);
    }
    
    // Show message if no model metrics to display
    if (modelMetricsEl.children.length === 0) {
        const messageEl = document.createElement('div');
        messageEl.className = 'card';
        messageEl.innerHTML = '<p>No model-specific data available for the selected filters.</p>';
        modelMetricsEl.appendChild(messageEl);
    }
}

function displaySessions() {
    const tbody = document.getElementById('sessionsBody');
    
    if (filteredSessions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center;">No data available for the selected filters.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filteredSessions
        .sort((a, b) => {
            // Sort by server first, then by client, then by task, then by mode
            const serverA = a.mcpServer || 'Unknown';
            const serverB = b.mcpServer || 'Unknown';
            
            if (serverA !== serverB) {
                return serverA.localeCompare(serverB);
            }
            
            const clientA = a.mcpClient || 'Unknown';
            const clientB = b.mcpClient || 'Unknown';
            
            if (clientA !== clientB) {
                return clientA.localeCompare(clientB);
            }
            
            if (a.taskId === b.taskId) {
                return a.mode.localeCompare(b.mode);
            }
            return a.taskId - b.taskId;
        })
        .map(s => `
            <tr>
                <td><strong>${s.mcpServer || 'Unknown'}</strong></td>
                <td><strong>${s.mcpClient || 'Unknown'}</strong></td>
                <td>Task ${s.taskId}</td>
                <td><span class="badge badge-${s.mode}">${s.mode}</span></td>
                <td><strong>${s.model || 'Unknown'}</strong></td>
                <td>${(s.duration/1000).toFixed(1)}</td>
                <td>${s.apiCalls}</td>
                <td>${s.interactions}</td>
                <td>${s.totalTokens || 0}</td>
                <td>${(s.cost || 0).toFixed(4)}</td>
                <td class="${s.success ? 'success' : 'failure'}">${s.success ? '✓' : '✗'}</td>
                <td>${s.notes || '-'}</td>
            </tr>
        `).join('');
}

function initCharts() {
    const textColor = '#001B2D';
    const gridColor = 'rgba(0, 0, 0, 0.1)';
    
    // Create comparison chart (bar chart)
    const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
    if (charts.comparison) charts.comparison.destroy();
    
    charts.comparison = new Chart(comparisonCtx, {
        type: 'bar',
        data: {
            labels: ['Task 1', 'Task 2', 'Task 3'],
            datasets: [
                {
                    label: 'Control',
                    data: [0, 0, 0],
                    backgroundColor: `rgba(18, 28, 45, 0.9)`,
                    borderColor: `rgba(18, 28, 45, 1)`,
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'MCP',
                    data: [0, 0, 0],
                    backgroundColor: `rgba(242, 47, 70, 0.9)`,
                    borderColor: `rgba(242, 47, 70, 1)`,
                    borderWidth: 2,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        borderColor: gridColor,
                        tickColor: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            weight: '600'
                        }
                    }
                },
                y: {
                    grid: {
                        color: gridColor,
                        borderColor: gridColor,
                        tickColor: gridColor
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            weight: '600'
                        }
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                        font: {
                            weight: '600'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: true,
                    text: 'Duration Comparison (seconds)',
                    color: textColor,
                    font: {
                        size: 16,
                        weight: '600'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                }
            }
        }
    });
}

function updateCharts() {
    if (!charts.comparison) return;
    
    const controlSessions = filteredSessions.filter(s => s.mode === 'control');
    const mcpSessions = filteredSessions.filter(s => s.mode === 'mcp');
    
    if (controlSessions.length === 0 || mcpSessions.length === 0) {
        // Reset chart data if no data available
        updateComparisonChart('duration');
        return;
    }
    
    // Update comparison chart with the currently selected metric
    const activeTab = document.querySelector('.tabs .tab[data-chart].active');
    const activeMetric = activeTab ? activeTab.getAttribute('data-chart') : 'duration';
    updateComparisonChart(activeMetric);
}

function updateComparisonChart(metric) {
    if (!charts.comparison) return;
    
    // Group sessions by task
    const taskData = {
        '1': { control: [], mcp: [] },
        '2': { control: [], mcp: [] },
        '3': { control: [], mcp: [] }
    };
    
    filteredSessions.forEach(session => {
        const taskId = session.taskId.toString();
        if (taskData[taskId] && session.mode) {
            taskData[taskId][session.mode].push(session);
        }
    });
    
    // Calculate metrics for each task
    const data = {
        control: [0, 0, 0],
        mcp: [0, 0, 0]
    };
    
    let titleText = '';
    
    switch (metric) {
        case 'duration':
            titleText = 'Duration Comparison (seconds)';
            for (let i = 1; i <= 3; i++) {
                const taskId = i.toString();
                // Only include sessions with non-null duration
                const controlDurations = taskData[taskId].control.map(s => s.duration).filter(d => d !== null);
                const mcpDurations = taskData[taskId].mcp.map(s => s.duration).filter(d => d !== null);
                data.control[i-1] = average(controlDurations) / 1000;
                data.mcp[i-1] = average(mcpDurations) / 1000;
            }
            break;
        case 'apiCalls':
            titleText = 'API Calls Comparison (count)';
            for (let i = 1; i <= 3; i++) {
                const taskId = i.toString();
                // Only include sessions with non-null apiCalls
                const controlCalls = taskData[taskId].control.map(s => s.apiCalls).filter(c => c !== null);
                const mcpCalls = taskData[taskId].mcp.map(s => s.apiCalls).filter(c => c !== null);
                data.control[i-1] = average(controlCalls);
                data.mcp[i-1] = average(mcpCalls);
            }
            break;
        case 'interactions':
            titleText = 'User Interactions Comparison (messages)';
            for (let i = 1; i <= 3; i++) {
                const taskId = i.toString();
                // Only include sessions with non-null interactions
                const controlInteractions = taskData[taskId].control.map(s => s.interactions).filter(i => i !== null);
                const mcpInteractions = taskData[taskId].mcp.map(s => s.interactions).filter(i => i !== null);
                data.control[i-1] = average(controlInteractions);
                data.mcp[i-1] = average(mcpInteractions);
            }
            break;
        case 'tokens':
            titleText = 'Token Usage Comparison (count)';
            for (let i = 1; i <= 3; i++) {
                const taskId = i.toString();
                // Only include sessions with non-null tokens
                const controlTokens = taskData[taskId].control.map(s => s.totalTokens || 0).filter(t => t !== null);
                const mcpTokens = taskData[taskId].mcp.map(s => s.totalTokens || 0).filter(t => t !== null);
                data.control[i-1] = average(controlTokens);
                data.mcp[i-1] = average(mcpTokens);
            }
            break;
        case 'cost':
            titleText = 'Cost Comparison ($)';
            for (let i = 1; i <= 3; i++) {
                const taskId = i.toString();
                // Only include sessions with non-null cost
                const controlCost = taskData[taskId].control.map(s => s.cost || 0).filter(c => c !== null);
                const mcpCost = taskData[taskId].mcp.map(s => s.cost || 0).filter(c => c !== null);
                data.control[i-1] = average(controlCost);
                data.mcp[i-1] = average(mcpCost);
            }
            break;
        case 'success':
            titleText = 'Success Rate Comparison (%)';
            for (let i = 1; i <= 3; i++) {
                const taskId = i.toString();
                // Include all sessions for success rate calculation
                data.control[i-1] = percentage(taskData[taskId].control.filter(s => s.success).length, taskData[taskId].control.length);
                data.mcp[i-1] = percentage(taskData[taskId].mcp.filter(s => s.success).length, taskData[taskId].mcp.length);
            }
            break;
    }
    
    // Update chart data
    charts.comparison.data.datasets[0].data = data.control;
    charts.comparison.data.datasets[1].data = data.mcp;
    charts.comparison.options.plugins.title.text = titleText;
    charts.comparison.update();
}

function downloadCsv() {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add headers
    csvContent += "MCP Server,MCP Client,Task ID,Mode,Model,Duration (s),API Calls (count),User Interactions (count),Tokens (count),Cost ($),Success,Notes\n";
    
    // Add data rows
    filteredSessions.forEach(s => {
        const row = [
            s.mcpServer || 'Twilio',
            s.mcpClient || 'Cursor',
            s.taskId,
            s.mode,
            s.model || 'unknown',
            (s.duration/1000).toFixed(1),
            s.apiCalls,
            s.interactions,
            s.totalTokens || 0,
            (s.cost || 0).toFixed(4),
            s.success ? 'Yes' : 'No',
            (s.notes || '').replace(/,/g, ';') // Replace commas to avoid CSV issues
        ].join(',');
        csvContent += row + "\n";
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mcp_performance_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function average(values) {
    // Filter out null values before calculating average
    const validValues = values.filter(val => val !== null);
    return validValues.length ? validValues.reduce((sum, val) => sum + (val || 0), 0) / validValues.length : 0;
}

function percentage(part, total) {
    return total ? (part / total) * 100 : 0;
}

function percentageChange(newValue, oldValue) {
    return oldValue ? (((newValue - oldValue) / oldValue) * 100).toFixed(1) : 'N/A';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load data when page loads
    loadData();

    // Add event listeners for task tabs
    document.getElementById('taskTabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            // Remove active class from all tabs
            document.querySelectorAll('#taskTabs .tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Add active class to clicked tab
            e.target.classList.add('active');
            
            // Hide all task content
            document.querySelectorAll('.task-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // Show selected task content
            const taskId = e.target.getAttribute('data-task');
            document.getElementById(`task-${taskId}`).style.display = 'block';
        }
    });

    // Add event listeners for chart tabs
    document.querySelector('.tabs:not(#taskTabs)').addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            // Remove active class from all tabs
            e.target.parentElement.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Add active class to clicked tab
            e.target.classList.add('active');
            
            // Update chart with selected metric
            const metric = e.target.getAttribute('data-chart');
            updateComparisonChart(metric);
        }
    });

    // Add event listeners for filters
    document.getElementById('mcpServerFilter').addEventListener('change', () => {
        filterData();
        displayMetrics();
        displayModelMetrics();
        displaySessions();
        updateCharts();
    });

    document.getElementById('mcpClientFilter').addEventListener('change', () => {
        filterData();
        displayMetrics();
        displayModelMetrics();
        displaySessions();
        updateCharts();
    });

    document.getElementById('modelFilter').addEventListener('change', () => {
        filterData();
        displayMetrics();
        displayModelMetrics();
        displaySessions();
        updateCharts();
    });

    document.getElementById('taskFilter').addEventListener('change', () => {
        filterData();
        displayMetrics();
        displayModelMetrics();
        displaySessions();
        updateCharts();
    });

    document.getElementById('modeFilter').addEventListener('change', () => {
        filterData();
        displayMetrics();
        displayModelMetrics();
        displaySessions();
        updateCharts();
    });

    // Add refresh button functionality
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadData();
    });

    // Add download button functionality
    document.getElementById('downloadBtn').addEventListener('click', () => {
        downloadCsv();
    });
});
