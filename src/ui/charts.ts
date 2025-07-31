/**
 * Chart Generation and Interactive Visualization Components
 * Provides server-side chart configuration and client-side rendering utilities
 */

import {
  DashboardData,
  TrendData,
  HeatMapData,
  OverviewMetrics,
  DailyMetric,
  FileHeatMapItem,
  LinterHeatMapItem,
  SeverityDistribution
} from './dashboard';

export interface ChartConfiguration {
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
  responsive: boolean;
  maintainAspectRatio: boolean;
}

export type ChartType = 
  | 'line' 
  | 'bar' 
  | 'doughnut' 
  | 'pie' 
  | 'radar' 
  | 'scatter' 
  | 'bubble'
  | 'heatmap';

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: any[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
  pointRadius?: any;
  pointHoverRadius?: number;
}

export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: {
    legend: LegendOptions;
    title: TitleOptions;
    tooltip: TooltipOptions;
  };
  scales?: any;
  animation?: AnimationOptions;
  interaction?: InteractionOptions;
}

export interface LegendOptions {
  display: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  labels?: {
    color: string;
    font: {
      size: number;
    };
  };
}

export interface TitleOptions {
  display: boolean;
  text: string;
  color: string;
  font: {
    size: number;
    weight: string;
  };
}

export interface TooltipOptions {
  enabled: boolean;
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
  borderColor: string;
  borderWidth: number;
}

export interface ScalesOptions {
  x?: AxisOptions;
  y?: AxisOptions;
}

export interface AxisOptions {
  display: boolean;
  title: {
    display: boolean;
    text: string;
    color: string;
  };
  ticks: {
    color: string;
  };
  grid: {
    color: string;
  };
}

export interface AnimationOptions {
  duration: number;
  easing: string;
}

export interface InteractionOptions {
  intersect: boolean;
  mode: 'index' | 'dataset' | 'point' | 'nearest';
}

export interface HeatMapDataPoint {
  x: number;
  y: number;
  v: number; // value
  label?: string;
}

export class ChartGenerator {
  private readonly themeColors: ThemeColors;

  constructor(theme: 'light' | 'dark' | 'high-contrast' = 'dark') {
    this.themeColors = this.getThemeColors(theme);
  }

  /**
   * Generates quality trend line chart
   */
  generateQualityTrendChart(trendData: TrendData): ChartConfiguration {
    const labels = trendData.dailyMetrics.map(m => 
      new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Quality Score',
          data: trendData.qualityTrend,
          borderColor: this.themeColors.primary,
          backgroundColor: this.addAlpha(this.themeColors.primary, 0.1),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 8
        }]
      },
      options: this.getDefaultLineChartOptions('Code Quality Trend', 'Quality Score (%)'),
      responsive: true,
      maintainAspectRatio: false
    };
  }

  /**
   * Generates issue types trend chart
   */
  generateIssueTypeTrendChart(trendData: TrendData): ChartConfiguration {
    const labels = trendData.dailyMetrics.map(m => 
      new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Errors',
            data: trendData.issueTypeTrends.errors,
            borderColor: this.themeColors.error,
            backgroundColor: this.addAlpha(this.themeColors.error, 0.1),
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Warnings',
            data: trendData.issueTypeTrends.warnings,
            borderColor: this.themeColors.warning,
            backgroundColor: this.addAlpha(this.themeColors.warning, 0.1),
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Info',
            data: trendData.issueTypeTrends.info,
            borderColor: this.themeColors.info,
            backgroundColor: this.addAlpha(this.themeColors.info, 0.1),
            borderWidth: 2,
            fill: false,
            tension: 0.4
          }
        ]
      },
      options: this.getDefaultLineChartOptions('Issue Types Over Time', 'Number of Issues'),
      responsive: true,
      maintainAspectRatio: false
    };
  }

  /**
   * Generates performance trend chart
   */
  generatePerformanceTrendChart(trendData: TrendData): ChartConfiguration {
    const labels = trendData.dailyMetrics.map(m => 
      new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Execution Time (ms)',
          data: trendData.performanceTrends.executionTime,
          borderColor: this.themeColors.secondary,
          backgroundColor: this.addAlpha(this.themeColors.secondary, 0.1),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6
        }]
      },
      options: this.getDefaultLineChartOptions('Performance Trend', 'Execution Time (ms)'),
      responsive: true,
      maintainAspectRatio: false
    };
  }

  /**
   * Generates severity distribution pie chart
   */
  generateSeverityDistributionChart(severityData: SeverityDistribution): ChartConfiguration {
    const data = [
      severityData.critical,
      severityData.high,
      severityData.medium,
      severityData.low,
      severityData.info
    ];

    const labels = ['Critical', 'High', 'Medium', 'Low', 'Info'];
    const colors = [
      this.themeColors.critical,
      this.themeColors.error,
      this.themeColors.warning,
      this.themeColors.info,
      this.themeColors.secondary
    ];

    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          label: 'Issues by Severity',
          data,
          backgroundColor: colors,
          borderColor: colors.map(color => this.darkenColor(color, 0.2)),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: this.themeColors.text,
              font: { size: 12 }
            }
          },
          title: {
            display: true,
            text: 'Issues by Severity',
            color: this.themeColors.text,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            enabled: true,
            backgroundColor: this.themeColors.tooltipBackground,
            titleColor: this.themeColors.text,
            bodyColor: this.themeColors.text,
            borderColor: this.themeColors.border,
            borderWidth: 1
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
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  /**
   * Generates linter performance bar chart
   */
  generateLinterPerformanceChart(linterData: LinterHeatMapItem[]): ChartConfiguration {
    const topLinters = linterData.slice(0, 10); // Top 10 linters
    const labels = topLinters.map(l => l.name);
    const issuesData = topLinters.map(l => l.issuesFound);
    const timeData = topLinters.map(l => l.executionTime);

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Issues Found',
            data: issuesData,
            backgroundColor: this.addAlpha(this.themeColors.warning, 0.7),
            borderColor: this.themeColors.warning,
            borderWidth: 1
          },
          {
            label: 'Execution Time (ms)',
            data: timeData,
            backgroundColor: this.addAlpha(this.themeColors.secondary, 0.7),
            borderColor: this.themeColors.secondary,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: this.themeColors.text,
              font: { size: 12 }
            }
          },
          title: {
            display: true,
            text: 'Linter Performance',
            color: this.themeColors.text,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            enabled: true,
            backgroundColor: this.themeColors.tooltipBackground,
            titleColor: this.themeColors.text,
            bodyColor: this.themeColors.text,
            borderColor: this.themeColors.border,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Linters',
              color: this.themeColors.text
            },
            ticks: { color: this.themeColors.text },
            grid: { color: this.themeColors.gridLines }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Count / Time',
              color: this.themeColors.text
            },
            ticks: { color: this.themeColors.text },
            grid: { color: this.themeColors.gridLines }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeInOutQuart'
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  /**
   * Generates file heat map visualization data
   */
  generateFileHeatMapData(fileData: FileHeatMapItem[]): {
    chartConfig: ChartConfiguration;
    heatMapMatrix: HeatMapDataPoint[];
  } {
    // Group files by directory for heat map visualization
    const directories = new Map<string, FileHeatMapItem[]>();
    
    fileData.forEach(file => {
      const dir = file.path.split('/').slice(0, -1).join('/') || 'root';
      if (!directories.has(dir)) {
        directories.set(dir, []);
      }
      directories.get(dir)!.push(file);
    });

    const heatMapMatrix: HeatMapDataPoint[] = [];
    const labels: string[] = [];
    let yIndex = 0;

    directories.forEach((files, dir) => {
      labels.push(dir);
      files.forEach((file, xIndex) => {
        heatMapMatrix.push({
          x: xIndex,
          y: yIndex,
          v: file.issueCount,
          label: `${file.path}: ${file.issueCount} issues`
        });
      });
      yIndex++;
    });

    // For now, return a scatter chart as a simplified heat map
    // In a real implementation, you'd use a proper heat map library
    const chartConfig: ChartConfiguration = {
      type: 'scatter',
      data: {
        labels: labels,
        datasets: [{
          label: 'File Issues Heat Map',
          data: heatMapMatrix.map(point => ({ x: point.x, y: point.y })),
          backgroundColor: heatMapMatrix.map(point => 
            this.getHeatMapColor(point.v, Math.max(...heatMapMatrix.map(p => p.v)))
          ),
          borderColor: this.themeColors.border,
          borderWidth: 1,
          pointRadius: heatMapMatrix.map(point => Math.max(3, Math.min(15, point.v / 2)))
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
            position: 'top'
          },
          title: {
            display: true,
            text: 'File Issues Heat Map',
            color: this.themeColors.text,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            enabled: true,
            backgroundColor: this.themeColors.tooltipBackground,
            titleColor: this.themeColors.text,
            bodyColor: this.themeColors.text,
            borderColor: this.themeColors.border,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Files',
              color: this.themeColors.text
            },
            ticks: { color: this.themeColors.text },
            grid: { color: this.themeColors.gridLines }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Directories',
              color: this.themeColors.text
            },
            ticks: { 
              callback: function(value: any, index: number) {
                return labels[index] || '';
              }
            },
            grid: { color: this.themeColors.gridLines }
          }
        },
        animation: {
          duration: 1200,
          easing: 'easeInOutQuart'
        },
        interaction: {
          intersect: true,
          mode: 'point'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    return { chartConfig, heatMapMatrix };
  }

  /**
   * Generates overview metrics radar chart
   */
  generateOverviewRadarChart(overview: OverviewMetrics, historicalAverage?: OverviewMetrics): ChartConfiguration {
    const labels = [
      'Quality Score',
      'Error Resolution',
      'Warning Management',
      'Fixable Issues',
      'CI/CD Health'
    ];

    const currentData = [
      overview.qualityScore,
      Math.max(0, 100 - (overview.errorCount / Math.max(overview.totalIssues, 1)) * 100),
      Math.max(0, 100 - (overview.warningCount / Math.max(overview.totalIssues, 1)) * 100),
      (overview.fixableCount / Math.max(overview.totalIssues, 1)) * 100,
      overview.cicdStatus === 'success' ? 100 : overview.cicdStatus === 'pending' ? 50 : 0
    ];

    const datasets: ChartDataset[] = [{
      label: 'Current',
      data: currentData,
      backgroundColor: this.addAlpha(this.themeColors.primary, 0.2),
      borderColor: this.themeColors.primary,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 8
    }];

    if (historicalAverage) {
      const historicalData = [
        historicalAverage.qualityScore,
        Math.max(0, 100 - (historicalAverage.errorCount / Math.max(historicalAverage.totalIssues, 1)) * 100),
        Math.max(0, 100 - (historicalAverage.warningCount / Math.max(historicalAverage.totalIssues, 1)) * 100),
        (historicalAverage.fixableCount / Math.max(historicalAverage.totalIssues, 1)) * 100,
        historicalAverage.cicdStatus === 'success' ? 100 : historicalAverage.cicdStatus === 'pending' ? 50 : 0
      ];

      datasets.push({
        label: 'Historical Average',
        data: historicalData,
        backgroundColor: this.addAlpha(this.themeColors.secondary, 0.2),
        borderColor: this.themeColors.secondary,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6
      });
    }

    return {
      type: 'radar',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: this.themeColors.text,
              font: { size: 12 }
            }
          },
          title: {
            display: true,
            text: 'Code Quality Overview',
            color: this.themeColors.text,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            enabled: true,
            backgroundColor: this.themeColors.tooltipBackground,
            titleColor: this.themeColors.text,
            bodyColor: this.themeColors.text,
            borderColor: this.themeColors.border,
            borderWidth: 1
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: this.themeColors.text,
              stepSize: 20
            },
            grid: {
              color: this.themeColors.gridLines
            },
            angleLines: {
              color: this.themeColors.gridLines
            },
            pointLabels: {
              color: this.themeColors.text,
              font: { size: 11 }
            }
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
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  /**
   * Generates weekly progress bar chart
   */
  generateWeeklyProgressChart(trendData: TrendData): ChartConfiguration {
    const labels = trendData.weeklyTrends.map(w => 
      new Date(w.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    const qualityData = trendData.weeklyTrends.map(w => w.averageQuality);
    const improvementData = trendData.weeklyTrends.map(w => w.improvmentRate);

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Average Quality',
            data: qualityData,
            backgroundColor: this.addAlpha(this.themeColors.primary, 0.7),
            borderColor: this.themeColors.primary,
            borderWidth: 1
          },
          {
            label: 'Improvement Rate',
            data: improvementData,
            backgroundColor: improvementData.map(rate => 
              rate > 0 
                ? this.addAlpha(this.themeColors.success, 0.7)
                : this.addAlpha(this.themeColors.error, 0.7)
            ),
            borderColor: improvementData.map(rate => 
              rate > 0 ? this.themeColors.success : this.themeColors.error
            ),
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: this.themeColors.text,
              font: { size: 12 }
            }
          },
          title: {
            display: true,
            text: 'Weekly Progress',
            color: this.themeColors.text,
            font: { size: 16, weight: 'bold' }
          },
          tooltip: {
            enabled: true,
            backgroundColor: this.themeColors.tooltipBackground,
            titleColor: this.themeColors.text,
            bodyColor: this.themeColors.text,
            borderColor: this.themeColors.border,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Week',
              color: this.themeColors.text
            },
            ticks: { color: this.themeColors.text },
            grid: { color: this.themeColors.gridLines }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Score / Rate',
              color: this.themeColors.text
            },
            ticks: { color: this.themeColors.text },
            grid: { color: this.themeColors.gridLines }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeInOutQuart'
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  // Utility methods

  private getDefaultLineChartOptions(title: string, yAxisLabel: string): ChartOptions {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: this.themeColors.text,
            font: { size: 12 }
          }
        },
        title: {
          display: true,
          text: title,
          color: this.themeColors.text,
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          enabled: true,
          backgroundColor: this.themeColors.tooltipBackground,
          titleColor: this.themeColors.text,
          bodyColor: this.themeColors.text,
          borderColor: this.themeColors.border,
          borderWidth: 1
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Date',
            color: this.themeColors.text
          },
          ticks: { color: this.themeColors.text },
          grid: { color: this.themeColors.gridLines }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: yAxisLabel,
            color: this.themeColors.text
          },
          ticks: { color: this.themeColors.text },
          grid: { color: this.themeColors.gridLines }
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

  private getThemeColors(theme: 'light' | 'dark' | 'high-contrast'): ThemeColors {
    switch (theme) {
      case 'light':
        return {
          primary: '#007acc',
          secondary: '#5a5a5a',
          success: '#28a745',
          warning: '#ffc107',
          error: '#dc3545',
          critical: '#8b0000',
          info: '#17a2b8',
          text: '#212529',
          background: '#ffffff',
          border: '#dee2e6',
          gridLines: '#e9ecef',
          tooltipBackground: '#f8f9fa'
        };
      case 'high-contrast':
        return {
          primary: '#ffffff',
          secondary: '#c0c0c0',
          success: '#00ff00',
          warning: '#ffff00',
          error: '#ff0000',
          critical: '#ff0080',
          info: '#00ffff',
          text: '#ffffff',
          background: '#000000',
          border: '#ffffff',
          gridLines: '#808080',
          tooltipBackground: '#000000'
        };
      case 'dark':
      default:
        return {
          primary: '#1f9cf0',
          secondary: '#cccccc',
          success: '#28a745',
          warning: '#ffc107',
          error: '#f14c4c',
          critical: '#ff4081',
          info: '#17a2b8',
          text: '#cccccc',
          background: '#1e1e1e',
          border: '#3c3c3c',
          gridLines: '#404040',
          tooltipBackground: '#2d2d30'
        };
    }
  }

  private addAlpha(color: string, alpha: number): string {
    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private darkenColor(color: string, amount: number): string {
    // Simple color darkening
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.round(255 * amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.round(255 * amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.round(255 * amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private getHeatMapColor(value: number, maxValue: number): string {
    const intensity = Math.min(1, value / maxValue);
    
    if (intensity > 0.8) return this.themeColors.critical;
    if (intensity > 0.6) return this.themeColors.error;
    if (intensity > 0.4) return this.themeColors.warning;
    if (intensity > 0.2) return this.themeColors.info;
    return this.themeColors.secondary;
  }

  /**
   * Generates chart configurations for all dashboard visualizations
   */
  generateAllCharts(data: DashboardData): Record<string, ChartConfiguration> {
    return {
      qualityTrend: this.generateQualityTrendChart(data.trendAnalysis),
      issueTypeTrend: this.generateIssueTypeTrendChart(data.trendAnalysis),
      performanceTrend: this.generatePerformanceTrendChart(data.trendAnalysis),
      severityDistribution: this.generateSeverityDistributionChart(data.heatMapData.severityDistribution),
      linterPerformance: this.generateLinterPerformanceChart(data.heatMapData.linterHeatMap),
      overviewRadar: this.generateOverviewRadarChart(data.overview),
      weeklyProgress: this.generateWeeklyProgressChart(data.trendAnalysis)
    };
  }
}

interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  critical: string;
  info: string;
  text: string;
  background: string;
  border: string;
  gridLines: string;
  tooltipBackground: string;
}

/**
 * Client-side chart utilities for the dashboard frontend
 */
export const ChartUtils = {
  /**
   * Formats numbers for display in charts
   */
  formatNumber: (value: number): string => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  },

  /**
   * Formats duration in milliseconds to human readable
   */
  formatDuration: (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  },

  /**
   * Gets color based on quality score
   */
  getQualityColor: (score: number): string => {
    if (score >= 90) return '#28a745';
    if (score >= 70) return '#ffc107';
    if (score >= 50) return '#fd7e14';
    return '#dc3545';
  },

  /**
   * Gets trend arrow icon
   */
  getTrendIcon: (trend: 'improving' | 'stable' | 'declining'): string => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '📊';
    }
  }
};