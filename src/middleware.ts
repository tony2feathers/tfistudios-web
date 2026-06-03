import { defineMiddleware } from 'astro:middleware';

const OPS_PREFIX = '/ops/';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function decodeBasicCredentials(header: string | null): { user: string; password: string } | null {
  if (!header?.startsWith('Basic ')) return null;

  try {
    const encoded = header.slice('Basic '.length).trim();
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) return null;

    return {
      user: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function authChallenge(status = 401): Response {
  return new Response('Authentication required for TFI ops dashboard.', {
    status,
    headers: {
      'WWW-Authenticate': 'Basic realm="TFI Ops", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  if (pathname !== '/ops' && !pathname.startsWith(OPS_PREFIX)) {
    return next();
  }

  const expectedPassword = process.env.OPS_DASHBOARD_PASSWORD;
  const expectedUser = process.env.OPS_DASHBOARD_USER || 'ops';

  if (!expectedPassword) {
    return new Response('OPS_DASHBOARD_PASSWORD is not configured for the private ops dashboard.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const credentials = decodeBasicCredentials(context.request.headers.get('authorization'));
  if (!credentials) {
    return authChallenge();
  }

  const userMatches = constantTimeEqual(credentials.user, expectedUser);
  const passwordMatches = constantTimeEqual(credentials.password, expectedPassword);

  if (!userMatches || !passwordMatches) {
    return authChallenge();
  }

  const response = await next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
