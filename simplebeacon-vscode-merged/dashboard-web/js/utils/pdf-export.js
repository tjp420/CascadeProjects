export function exportToPDF(items) {
  const printWindow = window.open('', '_blank');
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SimpleBeacon AI - Compliance Report</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #222; padding: 40px; }
        .header { border-bottom: 2px solid #1a73e8; padding-bottom: 20px; margin-bottom: 30px; }
        .item { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 6px; }
        .pass { border-left: 6px solid #28a745; }
        .fail { border-left: 6px solid #dc3545; background-color: #fff9f9; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 3px; font-weight: 700; font-size: 12px; color: white; }
        .badge.pass { background: #28a745; }
        .badge.fail { background: #dc3545; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SimpleBeacon Compliance Certificate</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
      <div>
        ${items.map(item => `
          <div class="item ${item.status.toLowerCase()}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div><strong>${item.article}: ${item.title}</strong></div>
              <div><span class="badge ${item.status.toLowerCase()}">${item.status}</span></div>
            </div>
            <p style="margin-top:8px;color:#444">${item.desc}</p>
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
