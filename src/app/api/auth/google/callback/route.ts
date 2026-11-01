import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCodeForUser, createSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'scholarpulsev2.vercel.app';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  if (error || !code) {
    return NextResponse.redirect(new URL('/?authError=cancelled', req.url));
  }

  try {
    const user = await exchangeGoogleCodeForUser(code, redirectUri);
    await createSession(user);
    return NextResponse.redirect(new URL('/', req.url));
  } catch (err: any) {
    console.error('OAuth callback processing failed:', err);
    return NextResponse.redirect(new URL('/?authError=failed', req.url));
  }
}
