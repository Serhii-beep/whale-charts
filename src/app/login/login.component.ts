import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { EMPTY, catchError, of, tap } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  public apiKey: string = '';

  constructor(private router: Router,
    private httpClient: HttpClient,
    private toastr: ToastrService) { }

  ngOnInit(): void {
    const key = localStorage.getItem('label_studio_api_key');
    if(key) {
      this.router.navigate(['/projects']);
    }
  }

  public submitKey(): void {
    if(!this.apiKey) {
      return;
    }
    localStorage.setItem('label_studio_api_key', this.apiKey);
    this.httpClient.get('http://129.97.251.100:8080/api/projects').pipe(
      tap(() => {
        this.toastr.success('API key is saved');
        this.router.navigate(['/projects'])
      }),
      catchError(() => {
        this.toastr.error('API key is invalid');
        return of(EMPTY);
      })
    ).subscribe();
  }
}
