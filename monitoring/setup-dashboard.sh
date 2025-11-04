#!/bin/bash
# Setup Cloud Monitoring Dashboard for AICIN
# This script creates a comprehensive monitoring dashboard with key metrics

PROJECT_ID="aicin-477004"
DASHBOARD_NAME="AICIN Multi-Agent System"

echo "📊 Creating Cloud Monitoring Dashboard for AICIN..."

# Create dashboard JSON configuration
cat > /tmp/aicin-dashboard.json << 'EOF'
{
  "displayName": "AICIN Multi-Agent System",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Orchestrator - Request Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.label.service_name=\"orchestrator\" metric.type=\"run.googleapis.com/request_count\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE"
                    }
                  }
                },
                "plotType": "LINE",
                "targetAxis": "Y1"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Requests/sec",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "xPos": 6,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Orchestrator - Response Time (P95)",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.label.service_name=\"orchestrator\" metric.type=\"run.googleapis.com/request_latencies\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_DELTA",
                      "crossSeriesReducer": "REDUCE_PERCENTILE_95",
                      "groupByFields": ["resource.service_name"]
                    }
                  }
                },
                "plotType": "LINE",
                "targetAxis": "Y1"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Latency (ms)",
              "scale": "LINEAR"
            },
            "thresholds": [
              {
                "value": 2500,
                "color": "YELLOW",
                "direction": "ABOVE"
              }
            ]
          }
        }
      },
      {
        "yPos": 4,
        "width": 4,
        "height": 4,
        "widget": {
          "title": "Success Rate (All Services)",
          "scorecard": {
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/request_count\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_RATE",
                  "crossSeriesReducer": "REDUCE_SUM",
                  "groupByFields": ["metric.response_code_class"]
                }
              }
            },
            "sparkChartView": {
              "sparkChartType": "SPARK_LINE"
            },
            "thresholds": [
              {
                "value": 0.95,
                "color": "YELLOW",
                "direction": "BELOW"
              }
            ]
          }
        }
      },
      {
        "xPos": 4,
        "yPos": 4,
        "width": 4,
        "height": 4,
        "widget": {
          "title": "Active Instances (All Services)",
          "scorecard": {
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/container/instance_count\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_MEAN",
                  "crossSeriesReducer": "REDUCE_SUM"
                }
              }
            },
            "sparkChartView": {
              "sparkChartType": "SPARK_BAR"
            }
          }
        }
      },
      {
        "xPos": 8,
        "yPos": 4,
        "width": 4,
        "height": 4,
        "widget": {
          "title": "Memory Utilization",
          "scorecard": {
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/container/memory/utilizations\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_MEAN",
                  "crossSeriesReducer": "REDUCE_MEAN"
                }
              }
            },
            "gaugeView": {
              "lowerBound": 0.0,
              "upperBound": 1.0
            },
            "thresholds": [
              {
                "value": 0.8,
                "color": "YELLOW",
                "direction": "ABOVE"
              },
              {
                "value": 0.9,
                "color": "RED",
                "direction": "ABOVE"
              }
            ]
          }
        }
      },
      {
        "yPos": 8,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Content Matcher - Processing Time",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" resource.label.service_name=\"content-matcher\" metric.type=\"run.googleapis.com/request_latencies\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_DELTA",
                      "crossSeriesReducer": "REDUCE_MEAN",
                      "groupByFields": ["resource.service_name"]
                    }
                  }
                },
                "plotType": "LINE",
                "targetAxis": "Y1"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Latency (ms)",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "xPos": 6,
        "yPos": 8,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Error Rate by Service",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/request_count\" metric.response_code_class=\"4xx\" OR metric.response_code_class=\"5xx\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM",
                      "groupByFields": ["resource.service_name"]
                    }
                  }
                },
                "plotType": "STACKED_AREA",
                "targetAxis": "Y1"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Errors/sec",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "yPos": 12,
        "width": 12,
        "height": 4,
        "widget": {
          "title": "All Agents - Request Latency Distribution",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/request_latencies\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_DELTA",
                      "crossSeriesReducer": "REDUCE_PERCENTILE_50",
                      "groupByFields": ["resource.service_name"]
                    }
                  }
                },
                "plotType": "LINE",
                "targetAxis": "Y1",
                "legendTemplate": "${resource.service_name} (P50)"
              },
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/request_latencies\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_DELTA",
                      "crossSeriesReducer": "REDUCE_PERCENTILE_95",
                      "groupByFields": ["resource.service_name"]
                    }
                  }
                },
                "plotType": "LINE",
                "targetAxis": "Y1",
                "legendTemplate": "${resource.service_name} (P95)"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Latency (ms)",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "yPos": 16,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "CPU Utilization by Service",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/container/cpu/utilizations\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_MEAN",
                      "crossSeriesReducer": "REDUCE_MEAN",
                      "groupByFields": ["resource.service_name"]
                    }
                  }
                },
                "plotType": "LINE",
                "targetAxis": "Y1"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "CPU %",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "xPos": 6,
        "yPos": 16,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Billable Instance Time",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_run_revision\" metric.type=\"run.googleapis.com/container/billable_instance_time\"",
                    "aggregation": {
                      "alignmentPeriod": "60s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM",
                      "groupByFields": ["resource.service_name"]
                    }
                  }
                },
                "plotType": "STACKED_AREA",
                "targetAxis": "Y1"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Seconds",
              "scale": "LINEAR"
            }
          }
        }
      }
    ]
  }
}
EOF

# Create the dashboard
echo "Creating dashboard in project: $PROJECT_ID"
gcloud monitoring dashboards create --config-from-file=/tmp/aicin-dashboard.json --project=$PROJECT_ID

echo "✅ Dashboard created successfully!"
echo ""
echo "📊 View your dashboard at:"
echo "https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
echo "Key Metrics Tracked:"
echo "  - Request rate and latency (P50, P95)"
echo "  - Success rate and error rate"
echo "  - Active instances and auto-scaling"
echo "  - CPU and memory utilization"
echo "  - Cost (billable instance time)"
echo "  - Per-agent performance breakdown"

# Clean up
rm /tmp/aicin-dashboard.json
