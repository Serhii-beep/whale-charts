import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration, ChartType } from 'chart.js';
import Annotation from 'chartjs-plugin-annotation';
import { BaseChartDirective } from 'ng2-charts';
import { EMPTY, Subject, Subscription, catchError, forkJoin, map, of, switchMap, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-charts',
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.scss']
})
export class ChartsComponent implements OnInit, OnDestroy {
  private dataset: number[] = [65, 59, 80, 81, 56, 55, 40];
  private unsubscribe$ = new Subject();
  private interval: any;
  private currentSubscription: Subscription | null = null;
  private projectId: number = 0;

  constructor(private httpClient: HttpClient,
    private route: ActivatedRoute,
    private router: Router) {
    Chart.register(Annotation);
  }

  ngOnInit(): void {
    const projId = this.route.snapshot.paramMap.get('projectId');
    if(projId) {
      this.projectId = parseInt(projId);
    }
    this.sendNewRequest();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.complete();
    if (this.interval) {
      clearInterval(this.interval);
    }

    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
  }

  public navigateToProjects(): void {
    this.router.navigate(['/projects']);
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

  public sendNewRequest(): void {
    if(this.interval) {
      clearInterval(this.interval);
    }
    this.getData();
    this.interval = setInterval(() => {
      console.log('Sending new request...');
      this.getData();
    }, 15000);
  }

  private getData(): void {
    if(this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
    this.currentSubscription = this.httpClient.get(`http://129.97.251.100:8080/api/tasks?project=${this.projectId}`).pipe(
      takeUntil(this.unsubscribe$),
      switchMap((res: any) => {
        if(!res || res.length === 0) {
          return of(EMPTY);
        }
        const tasks = res.tasks;
        const tasksRequests = tasks.map((task: any) => this.httpClient.get(`http://129.97.251.100:8080/api/tasks/${task.id}`).pipe(
          catchError(error => {
            console.log(error);
            return of(EMPTY);
          })
        ));

        return forkJoin(tasksRequests).pipe(
          map((results: any) => results.filter((result: any) => result !== null)),
          catchError(error => {
            console.log(error);
            return of(EMPTY);
          })
        );
      }),
      tap(resp => {
        resp = resp.filter((x: any) => !!x.completed_at);
        resp.sort((a: any, b: any) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
        var annotations: any = [];
        var predictions: any = [];
        resp.forEach((task: any) => {
          let a: any = [];
          task.annotations.forEach((annotation: any) => {
            const t = annotation.result.map((ann: any) => ann.value);
            a = [...a, ...t];
          });
          annotations.push(a);
          let p: any = [];
          task.predictions.forEach((prediction: any) => {
            const t = prediction.result.map((pred: any) => pred.value);
            p = [...p, ...t];
          });
          predictions.push(p);
        });
        for(let i = 0; i < annotations.length; ++i) {
          const { TP, FP, FN } = this.evaluateDetection(annotations[i], predictions[i]);
          console.log(`Task: ${i + 1}; TP: ${TP}, FP: ${FP}, FN: ${FN}`);
        }
      }),
      catchError(error => {
        console.log(error);
        return of(EMPTY);
      })
    ).subscribe();
  }

  private evaluateDetection(gtBoxes: any, predBoxes: any, iouThreshold = 0.5): { TP: number; FP: number; FN: number } {
    let TP = 0;
    let FP = 0;

    const matchedGTBoxes = new Set<number>();

    predBoxes.forEach((predBox: any) => {
      let matchFound = false;
      gtBoxes.forEach((gtBox: any, idx: number) => {
        if(matchedGTBoxes.has(idx) || matchFound) return;

        const iou = this.calculateIoU(predBox, gtBox);
        if(iou >= iouThreshold) {
          TP++;
          matchFound = true;
          matchedGTBoxes.add(idx);
        }
      });

      if(!matchFound) {
        FP++;
      }
    });

    const FN = gtBoxes.length - matchedGTBoxes.size;

    return { TP, FP, FN };
  }

  private calculateIoU(box1: any, box2: any): number {
    const [x1, y1, x2, y2] = this.convertToBox(box1);
    const [x1b, y1b, x2b, y2b] = this.convertToBox(box2);

    const interX1 = Math.max(x1, x1b);
    const interY1 = Math.max(y1, y1b);
    const interX2 = Math.max(x2, x2b);
    const interY2 = Math.max(y2, y2b);

    if(interX2 < interX1 || interY2 < interY1) return 0.0;

    const intersectionArea = (interX2 - interX1) * (interY2 - interY1);
    const box1Area = (x2 - x1) * (y2 - y1);
    const box2Area = (x2b - x1b) * (y2b - y1b);

    return intersectionArea / (box1Area + box2Area - intersectionArea);
  }

  private convertToBox(box: any): [number, number, number, number] {
    return [box.x, box.y, box.x + box.width, box.y + box.height];
  }
}
