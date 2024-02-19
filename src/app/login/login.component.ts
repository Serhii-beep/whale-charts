import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  public apiKey: string = '';

  constructor(private router: Router) { }

  ngOnInit(): void {
    const key = localStorage.getItem('label_studio_api_key');
    if(key) {
      this.router.navigate(['/projects']);
    }
  }

  public submitKey(): void {
    if(this.apiKey) {
      localStorage.setItem('label_studio_api_key', this.apiKey);
      this.router.navigate(['/projects']);
    }
  }
}
