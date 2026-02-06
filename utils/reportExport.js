const fs = require('fs');
const path = require('path');

// Simple CSV export utility
const convertToCSV = (data, headers = null) => {
  if (!data || data.length === 0) return '';
  
  // Auto-detect headers if not provided
  if (!headers) {
    headers = Object.keys(data[0]);
  }
  
  // Create CSV header row
  let csv = headers.join(',') + '\n';
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      let value = row[header];
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Convert to string and escape quotes
      value = String(value).replace(/"/g, '""');
      
      // Wrap in quotes if contains comma, newline, or quote
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`;
      }
      
      return value;
    });
    
    csv += values.join(',') + '\n';
  });
  
  return csv;
};

// Format data for different report types
const formatOrderReportForExport = (reportData) => {
  return reportData.daily_data.map(day => ({
    Date: day.date,
    'Total Orders': day.total_orders,
    'Revenue': parseFloat(day.revenue || 0).toFixed(2),
    'Avg Order Value': parseFloat(day.avg_order_value || 0).toFixed(2),
    'Completed Orders': day.completed_orders,
    'Cancelled Orders': day.cancelled_orders,
    'Table Orders': day.table_orders,
    'Zomato Orders': day.zomato_orders,
    'Swiggy Orders': day.swiggy_orders,
    'Paid Revenue': parseFloat(day.paid_revenue || 0).toFixed(2),
    'Paid Orders': day.paid_orders
  }));
};

const formatRevenueReportForExport = (reportData) => {
  return reportData.data.map(period => ({
    Period: period.period,
    'Total Orders': period.total_orders,
    'Total Revenue': parseFloat(period.total_revenue || 0).toFixed(2),
    'Total Tax': parseFloat(period.total_tax || 0).toFixed(2),
    'Total Discount': parseFloat(period.total_discount || 0).toFixed(2),
    'Avg Order Value': parseFloat(period.avg_order_value || 0).toFixed(2),
    'Min Order Value': parseFloat(period.min_order_value || 0).toFixed(2),
    'Max Order Value': parseFloat(period.max_order_value || 0).toFixed(2),
    'Paid Orders': period.paid_orders,
    'Paid Revenue': parseFloat(period.paid_revenue || 0).toFixed(2)
  }));
};

const formatProductReportForExport = (reportData) => {
  return reportData.items.map(item => ({
    'Item Name': item.name,
    'Category': item.category_name,
    'Total Quantity Sold': item.total_quantity,
    'Total Revenue': parseFloat(item.total_revenue || 0).toFixed(2),
    'Order Count': item.order_count,
    'Average Price': parseFloat(item.avg_price || 0).toFixed(2),
    'Current Price': parseFloat(item.current_price || 0).toFixed(2),
    'Vegetarian': item.is_veg ? 'Yes' : 'No',
    'Spicy': item.is_spicy ? 'Yes' : 'No'
  }));
};

// Main export function
const exportReport = (reportType, reportData, format = 'csv') => {
  let formattedData;
  let filename;
  
  switch (reportType) {
    case 'orders':
      formattedData = formatOrderReportForExport(reportData);
      filename = `orders_report_${new Date().toISOString().split('T')[0]}`;
      break;
    case 'revenue':
      formattedData = formatRevenueReportForExport(reportData);
      filename = `revenue_report_${new Date().toISOString().split('T')[0]}`;
      break;
    case 'products':
      formattedData = formatProductReportForExport(reportData);
      filename = `products_report_${new Date().toISOString().split('T')[0]}`;
      break;
    default:
      throw new Error('Unsupported report type');
  }
  
  if (format === 'csv') {
    const csvContent = convertToCSV(formattedData);
    return {
      content: csvContent,
      filename: `${filename}.csv`,
      contentType: 'text/csv'
    };
  }
  
  throw new Error('Unsupported export format');
};

module.exports = {
  convertToCSV,
  exportReport,
  formatOrderReportForExport,
  formatRevenueReportForExport,
  formatProductReportForExport
};