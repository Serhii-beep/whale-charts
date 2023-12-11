import { Component, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import Annotation from 'chartjs-plugin-annotation';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  private dataset: number[] = [65, 59, 80, 81, 56, 55, 40];

  constructor() {
    Chart.register(Annotation);
  }

  public lineChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: this.dataset,
        label: 'Data',
        borderColor: '#000000',
        pointBackgroundColor: '#000000',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(148,159,177,0.8)',
        pointRadius: 5
      }
    ],
    labels: ['', '', '', '', '', '', '']
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0,
      },
    },
    scales: {
      y: {
        position: 'left',
      },
      y1: {
        position: 'right',
        grid: {
          color: 'rgba(255,0,0,0.3)',
        },
        ticks: {
          color: 'red',
        },
      },
    },
    plugins: {
      annotation: {
        annotations: [
          {
            type: 'line',
            scaleID: 'y-axis-0',
            yMin: this.calculateMean(this.dataset),
            yMax: this.calculateMean(this.dataset),
            borderColor: 'orange',
            label: {
              content: `${this.calculateMean(this.dataset)}`,
              display: true,
              color: 'orange'
            }
          },
          {
            type: 'line',
            scaleID: 'y-axis-0',
            yMin: this.calculateMean(this.dataset) + 3 * this.calculateStdDev(this.dataset),
            yMax: this.calculateMean(this.dataset) + 3 * this.calculateStdDev(this.dataset),
            borderColor: 'blue',
            label: {
              content: `${this.calculateMean(this.dataset) + 3 * this.calculateStdDev(this.dataset)}`,
              display: true,
              color: 'white'
            },
            borderDash: [5]
          },
          {
            type: 'line',
            scaleID: 'y-axis-0',
            yMin: this.calculateMean(this.dataset) - 3 * this.calculateStdDev(this.dataset),
            yMax: this.calculateMean(this.dataset) - 3 * this.calculateStdDev(this.dataset),
            borderColor: 'blue',
            label: {
              content: `${this.calculateMean(this.dataset) - 3 * this.calculateStdDev(this.dataset)}`,
              display: true,
              color: 'white'
            },
            borderDash: [5]
          }
        ]
      }
    }
  };

  public lineChartType: ChartType = 'line';

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  private calculateMean(numbers: number[]): number {
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum / numbers.length;
  }

  private calculateStdDev(numbers: number[]): number {
    const mean = this.calculateMean(numbers);
    const variance = numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }
}
