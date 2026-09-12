import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { LoginResponse } from '../models/auth.models';

const STORAGE_KEY = 'pv_auth';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        accountType: 'STAFF',
        name: 'Jane',
        email: 'jane@example.com',
        username: 'jane',
      })
    );

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    httpMock.verify();
  });

  it('shares a single in-flight refresh call across concurrent callers', () => {
    const fakeResponse: LoginResponse = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      accountType: 'STAFF',
      expiresIn: 900,
      name: 'Jane',
      email: 'jane@example.com',
      username: 'jane',
      requiresUsernameSetup: false,
      setupToken: null,
    };

    let firstResult: LoginResponse | undefined;
    let secondResult: LoginResponse | undefined;

    service.refreshToken().subscribe((res) => (firstResult = res));
    service.refreshToken().subscribe((res) => (secondResult = res));

    const req = httpMock.expectOne((r) => r.url.includes('/api/auth/refresh'));
    req.flush(fakeResponse);

    expect(firstResult).toEqual(fakeResponse);
    expect(secondResult).toEqual(fakeResponse);
  });
});
