import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const apiKey = localStorage.getItem('label_studio_api_key');
    if(apiKey) {
      const clonedRequest = request.clone({
        headers: request.headers.set('Authorization', `Token ${apiKey}`)
      });

      return next.handle(clonedRequest);
    }
    return next.handle(request);
  }
}
