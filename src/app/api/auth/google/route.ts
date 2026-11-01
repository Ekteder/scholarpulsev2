import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthURL } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'scholarpulsev2.vercel.app';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  const url = getGoogleOAuthURL(redirectUri);
  return NextResponse.redirect(url);
}
