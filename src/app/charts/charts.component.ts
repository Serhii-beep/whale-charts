import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { EMPTY, Subject, Subscription, catchError, forkJoin, map, of, switchMap, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-charts',
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.scss']
})
export class ChartsComponent implements OnInit, OnDestroy {
  private unsubscribe$ = new Subject();
  private interval: any;
  private currentSubscription: Subscription | null = null;
  private projectId: number = 0;
  
  public projectName: string = "";
  public tasksCompleted: number = 0;
  public totalTP: number = 0;
  public totalFP: number = 0;
  public totalFN: number = 0;
  public precision: number = 0;
  public recall: number = 0;
  public iouThresh = 0.5;
  public scoreThresh = 0.5;

  constructor(private httpClient: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private spinnerService: NgxSpinnerService) {
  }

  ngOnInit(): void {
    this.spinnerService.show();
    const projId = this.route.snapshot.paramMap.get('projectId');
    if(projId) {
      this.projectId = parseInt(projId);
      this.httpClient.get(`http://129.97.251.100:8080/api/projects/${this.projectId}`).pipe(
        takeUntil(this.unsubscribe$),
        tap((res: any) => {
          this.projectName = res.title;
          this.spinnerService.hide();
        }),
        catchError(error => {
          console.log(error);
          this.spinnerService.hide();
          return of(EMPTY);
        })
      ).subscribe();
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

  public sendNewRequest(): void {
    if(this.interval) {
      clearInterval(this.interval);
    }
    this.getData();
  }

  public getData(): void {
    this.spinnerService.show('key-stats-spinner');
    if(this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
    this.currentSubscription = this.httpClient.get(`http://129.97.251.100:8080/api/tasks?project=${this.projectId}&page=1&page_size=100`).pipe(
      takeUntil(this.unsubscribe$),
      switchMap((res: any) => {
        if(!res || res.length === 0) {
          return of(EMPTY);
        }
        let tasks = res.tasks;
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
        this.tasksCompleted = resp.length;
        resp.sort((a: any, b: any) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
        var annotations: any = [];
        var predictions: any = [];
        console.log(resp);
        resp.forEach((task: any) => {
          let a: any = [];
          task.annotations.forEach((annotation: any) => {
            const t = annotation.result.map((ann: any) => ann.value);
            a = [...a, ...t];
          });
          annotations.push(a);
          let p: any = [];
          task.predictions.forEach((prediction: any) => {
            const t = prediction.result.filter((pred: any) => pred.score >= this.scoreThresh)
              .map((pred: any) => pred.value);
            p = [...p, ...t];
          });
          predictions.push(p);
        });
        let TPs: any = [];
        let FPs: any = [];
        let FNs: any = [];
        for(let i = 0; i < annotations.length; ++i) {
          const { TP, FP, FN } = this.evaluateDetection(annotations[i], predictions[i]);
          console.log(`Task: ${i + 1}; TP: ${TP}, FP: ${FP}, FN: ${FN}`);
          TPs.push(TP);
          FPs.push(FP);
          FNs.push(FN);
        };
        this.totalTP = TPs.reduce((acc: any, curr: any) => acc + curr, 0);
        this.totalFP = FPs.reduce((acc: any, curr: any) => acc + curr, 0);
        this.totalFN = FNs.reduce((acc: any, curr: any) => acc + curr, 0);
        this.precision = this.totalTP / (this.totalTP + this.totalFP);
        this.recall = this.totalTP / (this.totalTP + this.totalFN);
        this.spinnerService.hide('key-stats-spinner');
      }),
      catchError(error => {
        console.log(error);
        this.spinnerService.hide('key-stats-spinner');
        return of(EMPTY);
      })
    ).subscribe();
  }

  private evaluateDetection(gtBoxes: any, predBoxes: any): { TP: number; FP: number; FN: number } {
    let TP = 0;
    let FP = 0;

    const matchedGTBoxes = new Set<number>();

    predBoxes.forEach((predBox: any) => {
      let matchFound = false;
      gtBoxes.forEach((gtBox: any, idx: number) => {
        if(matchedGTBoxes.has(idx) || matchFound) return;

        const iou = this.calculateIoU(predBox, gtBox);
        if(iou >= this.iouThresh) {
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
