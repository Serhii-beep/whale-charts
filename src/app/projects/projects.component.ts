import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { EMPTY, Subject, catchError, of, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent implements OnInit, OnDestroy {
  public projects: any;

  private unsubscribe$ = new Subject<void>();

  constructor(private httpClient: HttpClient,
    private router: Router,
    private spinnerService: NgxSpinnerService) { }

  ngOnInit(): void {
    this.spinnerService.show();
    this.httpClient.get('http://129.97.251.100:8080/api/projects').pipe(
      takeUntil(this.unsubscribe$),
      tap((res: any) => {
        this.projects = res.results;
        this.spinnerService.hide();
      }),
      catchError(err => {
        console.log(err);
        this.spinnerService.hide();
        return of(EMPTY);
      })
    ).subscribe();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  public navigateToProject(projectId: any): void {
    this.router.navigate(['/charts', projectId]);
  }
}
