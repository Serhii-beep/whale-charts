import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { EMPTY, Subject, Subscription, catchError, forkJoin, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { ImageWhale } from '../models/image-whale';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-charts',
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.scss'],
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
  public imageWhales: ImageWhale[] = [];
  public filteredImageWhales: ImageWhale[] = [];
  public searchImageInput: string = "";
  public keyStatsLoading = true;
  public bbWidth: number = 40;
  public bbHeight: number = 40;

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
      this.httpClient.get(`http://${environment.ip}:${environment.port}/api/projects/${this.projectId}`).pipe(
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

  public searchInputChanged() {
    this.filteredImageWhales = this.imageWhales.filter(x => x.imageName.toLowerCase().includes(this.searchImageInput.toLowerCase()));
  }

  public getData(): void {
    this.keyStatsLoading = true;
    this.spinnerService.show('key-stats-spinner');
    this.spinnerService.show('table-spinner');
    if(this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
    this.currentSubscription = this.httpClient.get(`http://${environment.ip}:${environment.port}/api/projects/${this.projectId}/tasks?page_size=100000`).pipe(
      takeUntil(this.unsubscribe$),
      tap((res: any) => {
        if(!res || res.length === 0) {
          return;
        }
        let tasks = res;
        console.log(tasks);
        this.imageWhales = [];
        tasks = tasks.filter((task: any) => task.is_labeled);
        this.tasksCompleted = tasks.length;
        var annotations: any = [];
        var predictions: any = [];
        let imgNames: any = [];
        tasks.forEach((task: any) => {
          const lastIndexSlash = task.data.image.lastIndexOf('/');
          const imgName = task.data.image.substring(lastIndexSlash + 1);
          imgNames.push(imgName);
          let a: any = [];
          let w = 0;
          let h = 0;
          let w_h_given = false;
          if(task.annotations && task.annotations.length > 0 && task.annotations[0].result.length > 0) {
            w_h_given = true;
            w = task.annotations[0].result[0].original_width;
            h = task.annotations[0].result[0].original_height;
          }
          task.annotations.forEach((annotation: any) => {
            const t = annotation.result.map((ann: any) => {
              if(w_h_given) {
                ann.value.x = ann.value.x * w / 100.0;
                ann.value.y = ann.value.y * h / 100.0;
                ann.value.width = this.bbWidth;
                if(ann.type === "keypointlabels") {
                  ann.value.x -= ann.value.width / 2.0;
                  ann.value.y -= ann.value.width / 2.0;
                }
              }
              return ann.value;
            });
            a = [...a, ...t];
          });
          annotations.push(a);
          let p: any = [];
          task.predictions.forEach((prediction: any) => {
            const t = prediction.result.filter((pred: any) => pred.score >= this.scoreThresh).map((pred: any) => {
              if(w_h_given) {
                pred.value.x = pred.value.x * w / 100.0;
                pred.value.y = pred.value.y * h / 100.0;
                pred.value.width = this.bbWidth;
              }
              return pred.value;
            });
            p = [...p, ...t];
          });
          predictions.push(p);
        });
        let TPs: any = [];
        let FPs: any = [];
        let FNs: any = [];
        for(let i = 0; i < annotations.length; ++i) {
          const { TP, FP, FN } = this.evaluateDetection(annotations[i], predictions[i]);
          this.imageWhales.push({
            imageName: decodeURI(imgNames[i]),
            tp: TP,
            fp: FP,
            fn: FN
          });
          console.log(this.imageWhales[i]);
          TPs.push(TP);
          FPs.push(FP);
          FNs.push(FN);
        };
        this.filteredImageWhales = this.imageWhales;
        this.spinnerService.hide('table-spinner');
        this.totalTP = TPs.reduce((acc: any, curr: any) => acc + curr, 0);
        this.totalFP = FPs.reduce((acc: any, curr: any) => acc + curr, 0);
        this.totalFN = FNs.reduce((acc: any, curr: any) => acc + curr, 0);
        this.precision = this.totalTP / (this.totalTP + this.totalFP);
        this.recall = this.totalTP / (this.totalTP + this.totalFN);
        this.spinnerService.hide('key-stats-spinner');
        this.keyStatsLoading = false;
      }),
      catchError(error => {
        console.log(error);
        this.spinnerService.hide('key-stats-spinner');
        this.spinnerService.hide('table-spinner');
        this.keyStatsLoading = false;
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
    return [box.x, box.y, box.x + box.width, box.y + box.width];
  }
}
