import React from 'react';
import sampleGraphData from '../../web/data/metrics-sample.json';

export default function DashboardView() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Using sample data: {JSON.stringify(sampleGraphData)}</p>
    </div>
  );
}
