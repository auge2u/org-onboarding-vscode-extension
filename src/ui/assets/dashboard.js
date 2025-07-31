/**
 * MegaLinter Dashboard Client-Side Logic
 * Handles chart rendering, UI interactions, and VSCode communication
 */

// Global variables
let vscode;
let dashboardData = null;
let charts = {};
let currentView = 'overview';
let refreshInterval = null;
let settings = {
    theme: 'dark',
    refreshInterval: 300000,
    notifications: {
        qualityAlerts: true,
        cicdAlerts: true,
        performanceAlerts: false
    }
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Initializing MegaLinter Dashboard...');
    
    try {
        // Get VSCode API
        vscode = acquireVsCodeApi();
        
        // Initialize UI
        initializeUI();
        
        // Set up event listeners
        setupEventListeners();
        
        // Apply saved settings
        loadSettings();
        
        // Request initial data
        requestData();
        
        console.log('✅ Dashboard initialized successfully');
    } catch (error) {
        console.error('❌ Dashboard initialization failed:', error);
        showError('Failed to initialize dashboard: ' + error.message);
    }
});

// Initialize UI components
function initializeUI() {
    // Set up navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
    
    // Set up header controls
    setupHeaderControls();
    
    // Set up modals
    setupModals();
    
    // Initialize charts containers
    initializeChartContainers();
    
    // Set initial status
    updateStatus('connecting', 'Connecting to extension...');
}

// Set up event listeners
function setupEventListeners() {
    // Window message listener for VSCode communication
    window.addEventListener('message', handleMessage);
    
    // View selector changes
    document.getElementById('time-range-selector')?.addEventListener('change', (e) => {
        updateTimeRange(e.target.value);
    });
    
    document.getElementById('trend-metric-selector')?.addEventListener('change', (e) => {
        updateTrendMetric(e.target.value);
    });
    
    document.getElementById('heatmap-view-selector')?.addEventListener('change', (e) => {
        updateHeatMapView(e.target.value);
    });
    
    document.getElementById('severity-filter')?.addEventListener('change', (e) => {
        updateSeverityFilter(e.target.value);
    });
    
    document.getElementById('priority-filter')?.addEventListener('change', (e) => {
        updatePriorityFilter(e.target.value);
    });
    
    // Theme selector
    document.getElementById('theme-selector')?.addEventListener('change', (e) => {
        changeTheme(e.target.value);
    });
    
    // Refresh interval
    document.getElementById('refresh-interval')?.addEventListener('change', (e) => {
        updateRefreshInterval(parseInt(e.target.value));
    });
}

// Set up header controls
function setupHeaderControls() {
    document.getElementById('refresh-btn')?.addEventListener('click', refreshData);
    document.getElementById('export-btn')?.addEventListener('click', () => openModal('export-modal'));
    document.getElementById('settings-btn')?.addEventListener('click', () => openModal('settings-modal'));
}

// Set up modals
function setupModals() {
    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });
}

// Initialize chart containers
function initializeChartContainers() {
    // Set up all chart canvas elements
    const chartIds = [
        'quality-trend-chart',
        'severity-distribution-chart',
        'overview-radar-chart',
        'issue-types-trend-chart',
        'performance-trend-chart',
        'weekly-progress-chart',
        'linter-performance-chart',
        'file-heatmap-chart'
    ];
    
    chartIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            // Ensure canvas is ready for Chart.js
            const ctx = canvas.getContext('2d');
            if (ctx) {
                console.log(`✅ Chart canvas ${id} initialized`);
            }
        }
    });
}

// Handle messages from VSCode extension
function handleMessage(event) {
    const message = event.data;
    
    switch (message.command) {
        case 'updateData':
            console.log('📊 Received dashboard data update');
            updateDashboard(message.data);
            break;
            
        case 'showError':
            showError(message.error);
            break;
            
        case 'exportComplete':
            showNotification('Export completed successfully', 'success');
            break;
            
        case 'remediationComplete':
            showNotification('Remediation completed', 'success');
            refreshData();
            break;
            
        case 'statusUpdate':
            updateStatus(message.status, message.message);
            break;
            
        default:
            console.warn('Unknown message command:', message.command);
    }
}

// Request data from extension
function requestData() {
    console.log('📡 Requesting dashboard data...');
    updateStatus('loading', 'Loading dashboard data...');
    sendMessage({ command: 'refresh' });
}

// Refresh data
function refreshData() {
    console.log('🔄 Refreshing dashboard data...');
    showSpinner(true);
    requestData();
}

// Send message to VSCode extension
function sendMessage(message) {
    if (vscode) {
        vscode.postMessage(message);
    } else {
        console.error('VSCode API not available');
    }
}

// Update dashboard with new data
function updateDashboard(data) {
    try {
        console.log('🔄 Updating dashboard with new data...');
        dashboardData = data;
        
        // Update status
        updateStatus('connected', 'Dashboard connected');
        showSpinner(false);
        
        // Update current view
        updateCurrentView();
        
        // Show success view
        showView(currentView);
        
        console.log('✅ Dashboard updated successfully');
    } catch (error) {
        console.error('❌ Failed to update dashboard:', error);
        showError('Failed to update dashboard: ' + error.message);
    }
}

// Update current view based on active tab
function updateCurrentView() {
    switch (currentView) {
        case 'overview':
            updateOverviewView();
            break;
        case 'trends':
            updateTrendsView();
            break;
        case 'heatmap':
            updateHeatMapView();
            break;
        case 'remediation':
            updateRemediationView();
            break;
        case 'performance':
            updatePerformanceView();
            break;
    }
}

// Update overview view
function updateOverviewView() {
    if (!dashboardData?.overview) return;
    
    const overview = dashboardData.overview;
    
    // Update key metrics
    updateElement('quality-score', `${overview.qualityScore}%`);
    updateElement('total-issues', overview.totalIssues || 0);
    updateElement('fixable-issues', `${overview.fixableCount || 0} fixable`);
    updateElement('error-count', overview.errorCount || 0);
    updateElement('warning-count', overview.warningCount || 0);
    updateElement('cicd-status', formatCicdStatus(overview.cicdStatus));
    updateElement('last-scan', formatDate(overview.lastUpdated));
    
    // Update trend indicator
    const trendIcon = getTrendIcon(overview.trend);
    const trendText = overview.trend ? overview.trend.charAt(0).toUpperCase() + overview.trend.slice(1) : 'Stable';
    updateElement('quality-trend', `${trendIcon} ${trendText}`);
    
    // Apply quality score color
    const qualityScoreElement = document.getElementById('quality-score');
    if (qualityScoreElement) {
        qualityScoreElement.className = 'metric-value ' + getQualityScoreClass(overview.qualityScore);
    }
    
    // Update charts
    updateOverviewCharts();
}

// Update overview charts
function updateOverviewCharts() {
    if (!dashboardData) return;
    
    try {
        // Quality trend chart
        updateQualityTrendChart();
        
        // Severity distribution chart
        updateSeverityDistributionChart();
        
        // Overview radar chart
        updateOverviewRadarChart();
        
    } catch (error) {
        console.error('Failed to update overview charts:', error);
    }
}

// Update quality trend chart
function updateQualityTrendChart() {
    const ctx = document.getElementById('quality-trend-chart');
    if (!ctx || !dashboardData?.trendAnalysis) return;
    
    const trendData = dashboardData.trendAnalysis;
    const labels = trendData.dailyMetrics.map(m => formatChartDate(m.date));
    const data = trendData.qualityTrend;
    
    if (charts['quality-trend-chart']) {
        charts['quality-trend-chart'].destroy();
    }
    
    charts['quality-trend-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quality Score',
                data: data,
                borderColor: getThemeColor('primary'),
                backgroundColor: addAlpha(getThemeColor('primary'), 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 8
            }]
        },
        options: getLineChartOptions('Code Quality Trend', 'Quality Score (%)')
    });
}

// Update severity distribution chart
function updateSeverityDistributionChart() {
    const ctx = document.getElementById('severity-distribution-chart');
    if (!ctx || !dashboardData?.heatMapData?.severityDistribution) return;
    
    const severity = dashboardData.heatMapData.severityDistribution;
    const data = [severity.critical, severity.high, severity.medium, severity.low, severity.info];
    const labels = ['Critical', 'High', 'Medium', 'Low', 'Info'];
    const colors = [
        getThemeColor('critical'),
        getThemeColor('error'),
        getThemeColor('warning'),
        getThemeColor('info'),
        getThemeColor('secondary')
    ];
    
    if (charts['severity-distribution-chart']) {
        charts['severity-distribution-chart'].destroy();
    }
    
    charts['severity-distribution-chart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Issues by Severity',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => adjustColor(color, -20)),
                borderWidth: 2
            }]
        },
        options: getDoughnutChartOptions('Issues by Severity')
    });
}

// Update overview radar chart
function updateOverviewRadarChart() {
    const ctx = document.getElementById('overview-radar-chart');
    if (!ctx || !dashboardData?.overview) return;
    
    const overview = dashboardData.overview;
    const labels = ['Quality Score', 'Error Resolution', 'Warning Management', 'Fixable Issues', 'CI/CD Health'];
    
    const currentData = [
        overview.qualityScore,
        Math.max(0, 100 - (overview.errorCount / Math.max(overview.totalIssues, 1)) * 100),
        Math.max(0, 100 - (overview.warningCount / Math.max(overview.totalIssues, 1)) * 100),
        (overview.fixableCount / Math.max(overview.totalIssues, 1)) * 100,
        overview.cicdStatus === 'success' ? 100 : overview.cicdStatus === 'pending' ? 50 : 0
    ];
    
    if (charts['overview-radar-chart']) {
        charts['overview-radar-chart'].destroy();
    }
    
    charts['overview-radar-chart'] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Current',
                data: currentData,
                backgroundColor: addAlpha(getThemeColor('primary'), 0.2),
                borderColor: getThemeColor('primary'),
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 8
            }]
        },
        options: getRadarChartOptions('Code Quality Overview')
    });
}

// Update trends view
function updateTrendsView() {
    if (!dashboardData?.trendAnalysis) return;
    
    try {
        updateIssueTypesTrendChart();
        updatePerformanceTrendChart();
        updateWeeklyProgressChart();
        updateLinterPerformanceChart();
    } catch (error) {
        console.error('Failed to update trends charts:', error);
    }
}

// Update issue types trend chart
function updateIssueTypesTrendChart() {
    const ctx = document.getElementById('issue-types-trend-chart');
    if (!ctx || !dashboardData?.trendAnalysis) return;
    
    const trendData = dashboardData.trendAnalysis;
    const labels = trendData.dailyMetrics.map(m => formatChartDate(m.date));
    
    if (charts['issue-types-trend-chart']) {
        charts['issue-types-trend-chart'].destroy();
    }
    
    charts['issue-types-trend-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Errors',
                    data: trendData.issueTypeTrends.errors,
                    borderColor: getThemeColor('error'),
                    backgroundColor: addAlpha(getThemeColor('error'), 0.1),
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Warnings',
                    data: trendData.issueTypeTrends.warnings,
                    borderColor: getThemeColor('warning'),
                    backgroundColor: addAlpha(getThemeColor('warning'), 0.1),
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Info',
                    data: trendData.issueTypeTrends.info,
                    borderColor: getThemeColor('info'),
                    backgroundColor: addAlpha(getThemeColor('info'), 0.1),
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: getLineChartOptions('Issue Types Over Time', 'Number of Issues')
    });
}

// Update performance trend chart
function updatePerformanceTrendChart() {
    const ctx = document.getElementById('performance-trend-chart');
    if (!ctx || !dashboardData?.trendAnalysis) return;
    
    const trendData = dashboardData.trendAnalysis;
    const labels = trendData.dailyMetrics.map(m => formatChartDate(m.date));
    
    if (charts['performance-trend-chart']) {
        charts['performance-trend-chart'].destroy();
    }
    
    charts['performance-trend-chart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Execution Time (ms)',
                data: trendData.performanceTrends.executionTime,
                borderColor: getThemeColor('secondary'),
                backgroundColor: addAlpha(getThemeColor('secondary'), 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: getLineChartOptions('Performance Trend', 'Execution Time (ms)')
    });
}

// Update weekly progress chart
function updateWeeklyProgressChart() {
    const ctx = document.getElementById('weekly-progress-chart');
    if (!ctx || !dashboardData?.trendAnalysis?.weeklyTrends) return;
    
    const weeklyTrends = dashboardData.trendAnalysis.weeklyTrends;
    const labels = weeklyTrends.map(w => formatChartDate(w.week));
    const qualityData = weeklyTrends.map(w => w.averageQuality);
    const improvementData = weeklyTrends.map(w => w.improvmentRate);
    
    if (charts['weekly-progress-chart']) {
        charts['weekly-progress-chart'].destroy();
    }
    
    charts['weekly-progress-chart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Average Quality',
                    data: qualityData,
                    backgroundColor: addAlpha(getThemeColor('primary'), 0.7),
                    borderColor: getThemeColor('primary'),
                    borderWidth: 1
                },
                {
                    label: 'Improvement Rate',
                    data: improvementData,
                    backgroundColor: improvementData.map(rate => 
                        rate > 0 
                            ? addAlpha(getThemeColor('success'), 0.7)
                            : addAlpha(getThemeColor('error'), 0.7)
                    ),
                    borderColor: improvementData.map(rate => 
                        rate > 0 ? getThemeColor('success') : getThemeColor('error')
                    ),
                    borderWidth: 1
                }
            ]
        },
        options: getBarChartOptions('Weekly Progress', 'Score / Rate')
    });
}

// Update linter performance chart
function updateLinterPerformanceChart() {
    const ctx = document.getElementById('linter-performance-chart');
    if (!ctx || !dashboardData?.heatMapData?.linterHeatMap) return;
    
    const linterData = dashboardData.heatMapData.linterHeatMap.slice(0, 10);
    const labels = linterData.map(l => l.name);
    const issuesData = linterData.map(l => l.issuesFound);
    const timeData = linterData.map(l => l.executionTime);
    
    if (charts['linter-performance-chart']) {
        charts['linter-performance-chart'].destroy();
    }
    
    charts['linter-performance-chart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Issues Found',
                    data: issuesData,
                    backgroundColor: addAlpha(getThemeColor('warning'), 0.7),
                    borderColor: getThemeColor('warning'),
                    borderWidth: 1
                },
                {
                    label: 'Execution Time (ms)',
                    data: timeData,
                    backgroundColor: addAlpha(getThemeColor('secondary'), 0.7),
                    borderColor: getThemeColor('secondary'),
                    borderWidth: 1
                }
            ]
        },
        options: getBarChartOptions('Linter Performance', 'Count / Time')
    });
}

// Update heat map view
function updateHeatMapView(viewType = 'files') {
    if (!dashboardData?.heatMapData) return;
    
    // Hide all heat map content
    document.querySelectorAll('.heatmap-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Show selected view
    const contentId = `${viewType.replace('ies', 'y').replace('s', '')}-heatmap-content`;
    const content = document.getElementById(contentId);
    if (content) {
        content.style.display = 'block';
    }
    
    switch (viewType) {
        case 'files':
            updateFileHeatMap();
            break;
        case 'directories':
            updateDirectoryHeatMap();
            break;
        case 'linters':
            updateLinterHeatMapChart();
            break;
    }
}

// Update file heat map
function updateFileHeatMap() {
    const grid = document.getElementById('file-heatmap-grid');
    if (!grid || !dashboardData?.heatMapData?.fileHeatMap) return;
    
    const fileData = dashboardData.heatMapData.fileHeatMap.slice(0, 50); // Show top 50 files
    
    grid.innerHTML = '';
    
    fileData.forEach(file => {
        const tile = document.createElement('div');
        tile.className = `file-tile ${file.severity}-severity`;
        tile.onclick = () => navigateToFile(file.path);
        
        tile.innerHTML = `
            <div class="file-tile-name">${getFileName(file.path)}</div>
            <div class="file-tile-count">${file.issueCount}</div>
        `;
        
        // Add tooltip
        tile.title = `${file.path}\n${file.issueCount} issues (${file.fixableIssues} fixable)\nLinters: ${file.linters.join(', ')}`;
        
        grid.appendChild(tile);
    });
}

// Update directory heat map
function updateDirectoryHeatMap() {
    const list = document.getElementById('directory-heatmap-list');
    if (!list || !dashboardData?.heatMapData?.directoryHeatMap) return;
    
    const directoryData = dashboardData.heatMapData.directoryHeatMap.slice(0, 20);
    
    list.innerHTML = '';
    
    directoryData.forEach(dir => {
        const item = document.createElement('div');
        item.className = 'directory-item';
        item.onclick = () => expandDirectory(dir.path);
        
        item.innerHTML = `
            <div class="directory-header">
                <div class="directory-name">${dir.path || 'Root'}</div>
                <div class="directory-issues">${dir.totalIssues}</div>
            </div>
            <div class="directory-stats">
                <span>${dir.totalFiles} files</span>
                <span class="directory-quality">Quality: ${dir.averageQuality}%</span>
            </div>
            ${dir.hotspotFiles.length > 0 ? `
                <div class="directory-hotspots">
                    Hot spots: ${dir.hotspotFiles.join(', ')}
                </div>
            ` : ''}
        `;
        
        list.appendChild(item);
    });
}

// Update linter heat map chart
function updateLinterHeatMapChart() {
    const ctx = document.getElementById('file-heatmap-chart');
    if (!ctx || !dashboardData?.heatMapData?.fileHeatMap) return;
    
    // Create scatter plot for file heat map
    const fileData = dashboardData.heatMapData.fileHeatMap.slice(0, 100);
    const scatterData = fileData.map((file, index) => ({
        x: index % 10,
        y: Math.floor(index / 10),
        r: Math.max(3, Math.min(15, file.issueCount))
    }));
    
    if (charts['file-heatmap-chart']) {
        charts['file-heatmap-chart'].destroy();
    }
    
    charts['file-heatmap-chart'] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'File Issues',
                data: scatterData,
                backgroundColor: scatterData.map(point => 
                    getHeatMapColor(point.r, Math.max(...scatterData.map(p => p.r)))
                ),
                borderColor: getThemeColor('border'),
                borderWidth: 1
            }]
        },
        options: getScatterChartOptions('File Issues Heat Map')
    });
}

// Update remediation view
function updateRemediationView() {
    if (!dashboardData?.remediationGuidance) return;
    
    const remediations = dashboardData.remediationGuidance;
    
    // Update summary
    const fixableCount = remediations.reduce((sum, r) => sum + (r.automationAvailable ? 1 : 0), 0);
    const totalTime = remediations.reduce((sum, r) => {
        const effort = r.estimatedEffort === 'low' ? 30 : r.estimatedEffort === 'medium' ? 120 : 240;
        return sum + effort;
    }, 0);
    
    updateElement('fixable-issues-count', fixableCount);
    updateElement('estimated-fix-time', formatDuration(totalTime * 60 * 1000));
    updateElement('automation-count', `${fixableCount}/${remediations.length}`);
    
    // Update remediation list
    updateRemediationList(remediations);
}

// Update remediation list
function updateRemediationList(remediations) {
    const list = document.getElementById('remediation-items');
    if (!list) return;
    
    list.innerHTML = '';
    
    remediations.forEach(remediation => {
        const item = document.createElement('div');
        item.className = 'remediation-item';
        
        item.innerHTML = `
            <div class="remediation-header">
                <h3 class="remediation-title">${remediation.title}</h3>
                <span class="priority-badge ${remediation.priority}">${remediation.priority}</span>
            </div>
            <div class="remediation-description">${remediation.description}</div>
            <div class="remediation-meta">
                <span>📁 ${remediation.affectedFiles.length} files affected</span>
                <span>⏱️ ${remediation.estimatedEffort} effort</span>
                <span>🤖 ${remediation.automationAvailable ? 'Auto-fix available' : 'Manual fix required'}</span>
            </div>
            <div class="remediation-actions">
                ${remediation.automationAvailable ? 
                    `<button class="btn btn-primary" onclick="executeRemediation('${remediation.id}')">
                        <span class="icon">🔧</span> Auto-fix
                    </button>` : 
                    `<button class="btn btn-secondary" onclick="showRemediationSteps('${remediation.id}')">
                        <span class="icon">📋</span> View Steps
                    </button>`
                }
                <button class="btn btn-secondary" onclick="showAffectedFiles('${remediation.id}')">
                    <span class="icon">📁</span> Show Files
                </button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

// Update performance view
function updatePerformanceView() {
    if (!dashboardData?.performanceMetrics) return;
    
    const perf = dashboardData.performanceMetrics;
    
    updateElement('execution-time', formatNumber(perf.totalExecutionTime / 1000));
    updateElement('memory-usage', formatNumber(perf.memoryUsage / (1024 * 1024)));
    updateElement('cache-hit-rate', formatNumber((perf.cacheHits / Math.max(perf.cacheHits + perf.cacheMisses, 1)) * 100));
    updateElement('linters-run', Object.keys(perf.linterExecutionTimes).length);
    
    // Update performance recommendations
    updatePerformanceRecommendations();
}

// Update performance recommendations
function updatePerformanceRecommendations() {
    const container = document.getElementById('performance-recommendations');
    if (!container) return;
    
    const recommendations = generatePerformanceRecommendations();
    
    container.innerHTML = `
        <h3>Performance Recommendations</h3>
        ${recommendations.map(rec => `
            <div class="recommendation-item">
                <strong>${rec.title}</strong><br>
                ${rec.description}
            </div>
        `).join('')}
    `;
}

// Generate performance recommendations
function generatePerformanceRecommendations() {
    const recommendations = [];
    
    if (!dashboardData?.performanceMetrics) return recommendations;
    
    const perf = dashboardData.performanceMetrics;
    
    if (perf.totalExecutionTime > 300000) { // > 5 minutes
        recommendations.push({
            title: 'Optimize Execution Time',
            description: 'Consider enabling incremental scanning or reducing the number of active linters.'
        });
    }
    
    if (perf.memoryUsage > 1024 * 1024 * 1024) { // > 1GB
        recommendations.push({
            title: 'Reduce Memory Usage',
            description: 'Enable caching strategies or process files in smaller batches.'
        });
    }
    
    const cacheHitRate = (perf.cacheHits / Math.max(perf.cacheHits + perf.cacheMisses, 1)) * 100;
    if (cacheHitRate < 50) {
        recommendations.push({
            title: 'Improve Cache Performance',
            description: 'Adjust cache strategy to "aggressive" for better performance on repeated runs.'
        });
    }
    
    if (recommendations.length === 0) {
        recommendations.push({
            title: 'Performance Optimized',
            description: 'Your MegaLinter configuration is performing well. No immediate optimizations needed.'
        });
    }
    
    return recommendations;
}

// Navigation and UI functions
function switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
    
    // Update current view
    currentView = viewName;
    
    // Show view
    showView(viewName);
    
    // Update view content
    updateCurrentView();
}

function showView(viewName) {
    // Hide all views
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show target view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Hide loading and error views
    document.getElementById('loading-view')?.classList.remove('active');
    document.getElementById('error-view')?.classList.remove('active');
}

function showError(error) {
    console.error('Dashboard error:', error);
    
    document.getElementById('error-message').textContent = error;
    
    // Hide all other views
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show error view
    document.getElementById('error-view')?.classList.add('active');
    
    updateStatus('error', 'Error loading dashboard');
}

function showSpinner(show) {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.style.opacity = show ? '0.5' : '1';
        refreshBtn.disabled = show;
    }
}

function updateStatus(status, message) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (statusDot) {
        statusDot.className = `status-dot ${status}`;
    }
    
    if (statusText) {
        statusText.textContent = message;
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Settings functions
function loadSettings() {
    try {
        const stored = localStorage.getItem('megalinter-dashboard-settings');
        if (stored) {
            settings = { ...settings, ...JSON.parse(stored) };
        }
        
        // Apply settings to UI
        applySettings();
    } catch (error) {
        console.warn('Failed to load settings:', error);
    }
}

function saveSettings() {
    try {
        // Get values from UI
        settings.theme = document.getElementById('theme-selector')?.value || 'dark';
        settings.refreshInterval = parseInt(document.getElementById('refresh-interval')?.value || '300000');
        settings.notifications.qualityAlerts = document.getElementById('quality-alerts')?.checked || false;
        settings.notifications.cicdAlerts = document.getElementById('cicd-alerts')?.checked || false;
        settings.notifications.performanceAlerts = document.getElementById('performance-alerts')?.checked || false;
        
        // Save to storage
        localStorage.setItem('megalinter-dashboard-settings', JSON.stringify(settings));
        
        // Apply settings
        applySettings();
        
        // Close modal
        closeModal('settings-modal');
        
        // Notify extension
        sendMessage({ 
            command: 'updateConfiguration', 
            config: settings 
        });
        
        showNotification('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}

function applySettings() {
    // Apply theme
    changeTheme(settings.theme);
    
    // Update refresh interval
    updateRefreshInterval(settings.refreshInterval);
    
    // Update UI values
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) themeSelector.value = settings.theme;
    
    const refreshIntervalSelector = document.getElementById('refresh-interval');
    if (refreshIntervalSelector) refreshIntervalSelector.value = settings.refreshInterval.toString();
    
    const qualityAlertsCheckbox = document.getElementById('quality-alerts');
    if (qualityAlertsCheckbox) qualityAlertsCheckbox.checked = settings.notifications.qualityAlerts;
    
    const cicdAlertsCheckbox = document.getElementById('cicd-alerts');
    if (cicdAlertsCheckbox) cicdAlertsCheckbox.checked = settings.notifications.cicdAlerts;
    
    const performanceAlertsCheckbox = document.getElementById('performance-alerts');
    if (performanceAlertsCheckbox) performanceAlertsCheckbox.checked = settings.notifications.performanceAlerts;
}

function changeTheme(theme) {
    document.body.className = `dashboard-body theme-${theme}`;
    settings.theme = theme;
    
    // Update chart colors if charts exist
    Object.keys(charts).forEach(chartId => {
        if (charts[chartId]) {
            // Destroy and recreate charts with new theme
            charts[chartId].destroy();
            delete charts[chartId];
        }
    });
    
    // Refresh current view to apply new theme
    setTimeout(() => {
        updateCurrentView();
    }, 100);
}

function updateRefreshInterval(interval) {
    settings.refreshInterval = interval;
    
    // Clear existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Set new interval if not manual
    if (interval > 0) {
        refreshInterval = setInterval(refreshData, interval);
    }
}

// Action functions
function refreshDashboard() {
    refreshData();
}

function exportData() {
    const format = document.querySelector('input[name="export-format"]:checked')?.value || 'json';
    const includeCharts = document.getElementById('include-charts')?.checked || false;
    const includeTrends = document.getElementById('include-trends')?.checked || false;
    const includeRemediation = document.getElementById('include-remediation')?.checked || false;
    
    sendMessage({
        command: 'exportData',
        format: format,
        options: {
            includeCharts,
            includeTrends,
            includeRemediation
        }
    });
    
    closeModal('export-modal');
}

function executeRemediation(remediationId) {
    if (confirm('This will execute automated remediation steps. Continue?')) {
        sendMessage({
            command: 'executeRemediation',
            remediationId: remediationId
        });
        
        showNotification('Starting remediation...', 'info');
    }
}

function runAutoFix() {
    if (confirm('This will run automated fixes for all available remediation items. Continue?')) {
        sendMessage({
            command: 'runAutoFix'
        });
        
        showNotification('Starting auto-fix process...', 'info');
    }
}

function optimizePerformance() {
    if (confirm('This will optimize the MegaLinter configuration for better performance. Continue?')) {
        sendMessage({
            command: 'optimizePerformance'
        });
        
        showNotification('Optimizing performance...', 'info');
    }
}

function navigateToFile(filepath, line = null) {
    sendMessage({
        command: 'navigateToFile',
        filepath: filepath,
        line: line
    });
}

function showRemediationSteps(remediationId) {
    const remediation = dashboardData?.remediationGuidance?.find(r => r.id === remediationId);
    if (!remediation) return;
    
    const steps = remediation.steps.map((step, index) => 
        `${index + 1}. ${step.description}${step.automated ? ' (Automated)' : ''}`
    ).join('\n');
    
    alert(`Remediation Steps for: ${remediation.title}\n\n${steps}`);
}

function showAffectedFiles(remediationId) {
    const remediation = dashboardData?.remediationGuidance?.find(r => r.id === remediationId);
    if (!remediation) return;
    
    const files = remediation.affectedFiles.join('\n');
    alert(`Affected Files:\n\n${files}`);
}

function expandDirectory(path) {
    // This would expand/collapse directory view
    console.log('Expanding directory:', path);
}

// Filter functions
function updateTimeRange(range) {
    console.log('Time range changed:', range);
    // Would trigger data refresh with new time range
}

function updateTrendMetric(metric) {
    console.log('Trend metric changed:', metric);
    // Would update trend charts with new metric
}

function updateSeverityFilter(severity) {
    console.log('Severity filter changed:', severity);
    // Would filter heat map and remediation data
}

function updatePriorityFilter(priority) {
    console.log('Priority filter changed:', priority);
    // Would filter remediation items
}

// Chart utility functions
function getLineChartOptions(title, yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: getThemeColor('text'),
                    font: { size: 12 }
                }
            },
            title: {
                display: true,
                text: title,
                color: getThemeColor('text'),
                font: { size: 16, weight: 'bold' }
            },
            tooltip: {
                backgroundColor: getThemeColor('tooltipBackground'),
                titleColor: getThemeColor('text'),
                bodyColor: getThemeColor('text'),
                borderColor: getThemeColor('border'),
                borderWidth: 1
            }
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: 'Date',
                    color: getThemeColor('text')
                },
                ticks: { color: getThemeColor('text') },
                grid: { color: getThemeColor('gridLines') }
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: yLabel,
                    color: getThemeColor('text')
                },
                ticks: { color: getThemeColor('text') },
                grid: { color: getThemeColor('gridLines') }
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };
}

function getDoughnutChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'right',
                labels: {
                    color: getThemeColor('text'),
                    font: { size: 12 }
                }
            },
            title: {
                display: true,
                text: title,
                color: getThemeColor('text'),
                font: { size: 16, weight: 'bold' }
            },
            tooltip: {
                backgroundColor: getThemeColor('tooltipBackground'),
                titleColor: getThemeColor('text'),
                bodyColor: getThemeColor('text'),
                borderColor: getThemeColor('border'),
                borderWidth: 1
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };
}

function getRadarChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: getThemeColor('text'),
                    font: { size: 12 }
                }
            },
            title: {
                display: true,
                text: title,
                color: getThemeColor('text'),
                font: { size: 16, weight: 'bold' }
            }
        },
        scales: {
            r: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    color: getThemeColor('text'),
                    stepSize: 20
                },
                grid: {
                    color: getThemeColor('gridLines')
                },
                angleLines: {
                    color: getThemeColor('gridLines')
                },
                pointLabels: {
                    color: getThemeColor('text'),
                    font: { size: 11 }
                }
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };
}

function getBarChartOptions(title, yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: getThemeColor('text'),
                    font: { size: 12 }
                }
            },
            title: {
                display: true,
                text: title,
                color: getThemeColor('text'),
                font: { size: 16, weight: 'bold' }
            }
        },
        scales: {
            x: {
                display: true,
                ticks: { color: getThemeColor('text') },
                grid: { color: getThemeColor('gridLines') }
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: yLabel,
                    color: getThemeColor('text')
                },
                ticks: { color: getThemeColor('text') },
                grid: { color: getThemeColor('gridLines') }
            }
        },
        animation: {
            duration: 800,
            easing: 'easeInOutQuart'
        }
    };
}

function getScatterChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: title,
                color: getThemeColor('text'),
                font: { size: 16, weight: 'bold' }
            }
        },
        scales: {
            x: {
                display: true,
                ticks: { color: getThemeColor('text') },
                grid: { color: getThemeColor('gridLines') }
            },
            y: {
                display: true,
                ticks: { color: getThemeColor('text') },
                grid: { color: getThemeColor('gridLines') }
            }
        }
    };
}

// Utility functions
function getThemeColor(colorName) {
    const colors = {
        primary: settings.theme === 'light' ? '#007acc' : settings.theme === 'high-contrast' ? '#ffffff' : '#1f9cf0',
        secondary: settings.theme === 'light' ? '#5a5a5a' : settings.theme === 'high-contrast' ? '#c0c0c0' : '#cccccc',
        success: '#28a745',
        warning: settings.theme === 'high-contrast' ? '#ffff00' : '#ffc107',
        error: settings.theme === 'light' ? '#dc3545' : settings.theme === 'high-contrast' ? '#ff0000' : '#f14c4c',
        critical: settings.theme === 'high-contrast' ? '#ff0080' : '#8b0000',
        info: settings.theme === 'high-contrast' ? '#00ffff' : '#17a2b8',
        text: settings.theme === 'light' ? '#212529' : '#cccccc',
        background: settings.theme === 'light' ? '#ffffff' : settings.theme === 'high-contrast' ? '#000000' : '#1e1e1e',
        border: settings.theme === 'light' ? '#dee2e6' : settings.theme === 'high-contrast' ? '#ffffff' : '#3c3c3c',
        gridLines: settings.theme === 'light' ? '#e9ecef' : settings.theme === 'high-contrast' ? '#808080' : '#404040',
        tooltipBackground: settings.theme === 'light' ? '#f8f9fa' : settings.theme === 'high-contrast' ? '#000000' : '#2d2d30'
    };
    
    return colors[colorName] || colors.text;
}

function addAlpha(color, alpha) {
    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getHeatMapColor(value, maxValue) {
    const intensity = Math.min(1, value / maxValue);
    
    if (intensity > 0.8) return getThemeColor('critical');
    if (intensity > 0.6) return getThemeColor('error');
    if (intensity > 0.4) return getThemeColor('warning');
    if (intensity > 0.2) return getThemeColor('info');
    return getThemeColor('secondary');
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString();
    } catch {
        return 'Unknown';
    }
}

function formatChartDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}

function formatNumber(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
    }
    return Math.round(value).toString();
}

function formatCicdStatus(status) {
    const statusMap = {
        success: '✅ Success',
        failure: '❌ Failed',
        pending: '⏳ Running',
        unknown: '❓ Unknown'
    };
    return statusMap[status] || '❓ Unknown';
}

function getQualityScoreClass(score) {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
}

function getTrendIcon(trend) {
    const icons = {
        improving: '📈',
        declining: '📉',
        stable: '📊'
    };
    return icons[trend] || '📊';
}

function getFileName(path) {
    return path.split('/').pop() || path;
}

function showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    switch (type) {
        case 'success':
            notification.style.background = getThemeColor('success');
            break;
        case 'error':
            notification.style.background = getThemeColor('error');
            break;
        case 'warning':
            notification.style.background = getThemeColor('warning');
            break;
        default:
            notification.style.background = getThemeColor('info');
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Chart type toggle function
function toggleChartType(chartId, newType) {
    if (charts[chartId]) {
        const currentData = charts[chartId].data;
        const currentOptions = charts[chartId].options;
        
        charts[chartId].destroy();
        
        const ctx = document.getElementById(chartId);
        charts[chartId] = new Chart(ctx, {
            type: newType,
            data: currentData,
            options: currentOptions
        });
        
        // Update button states
        const container = ctx.closest('.chart-container');
        const buttons = container?.querySelectorAll('.chart-control-btn');
        buttons?.forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase() === newType.toLowerCase()) {
                btn.classList.add('active');
            }
        });
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .notification {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
`;
document.head.appendChild(style);

// Export global functions for HTML onclick handlers
window.refreshDashboard = refreshDashboard;
window.exportData = exportData;
window.saveSettings = saveSettings;
window.closeModal = closeModal;
window.executeRemediation = executeRemediation;
window.showRemediationSteps = showRemediationSteps;
window.showAffectedFiles = showAffectedFiles;
window.runAutoFix = runAutoFix;
window.optimizePerformance = optimizePerformance;
window.toggleChartType = toggleChartType;

console.log('🎯 MegaLinter Dashboard script loaded');