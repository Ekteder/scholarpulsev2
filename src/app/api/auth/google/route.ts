import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthURL } from '@/lib/auth';

function getTrustedBaseUrl(req: NextRequest): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://scholarpulsev2.vercel.app';
  }
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const baseUrl = getTrustedBaseUrl(req);

  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const state = crypto.randomUUID();
  const url = getGoogleOAuthURL(redirectUri, state);

  const response = NextResponse.redirect(url);
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
