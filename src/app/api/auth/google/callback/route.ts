import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCodeForUser, createSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const state = req.nextUrl.searchParams.get('state');

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  let baseUrl: string;
  if (process.env.NODE_ENV === 'production' && configuredUrl) {
    baseUrl = configuredUrl.replace(/\/$/, '');
  } else {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'scholarpulsev2.vercel.app';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
    baseUrl = `${proto}://${host}`;
  }
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  // CSRF validation
  const storedState = req.cookies.get('oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    console.error('OAuth state CSRF validation failed');
    const res = NextResponse.redirect(new URL('/?authError=csrf_detected', baseUrl));
    res.cookies.delete('oauth_state');
    return res;
  }

  if (error || !code) {
    const res = NextResponse.redirect(new URL('/?authError=cancelled', baseUrl));
    res.cookies.delete('oauth_state');
    return res;
  }

  try {
    const user = await exchangeGoogleCodeForUser(code, redirectUri);
    await createSession(user);
    const res = NextResponse.redirect(new URL('/', baseUrl));
    res.cookies.delete('oauth_state');
    return res;
  } catch (err: any) {
    console.error('OAuth callback processing failed:', err);
    const res = NextResponse.redirect(new URL('/?authError=failed', baseUrl));
    res.cookies.delete('oauth_state');
    return res;
  }
}
