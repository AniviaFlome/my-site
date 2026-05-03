export async function onRequest(context) {
  const ua = context.request.headers.get('User-Agent') || '';
  if (ua.toLowerCase().includes('curl')) {
    const url = new URL(context.request.url);
    const assetUrl = new URL('/curl/index.txt', url.origin);
    const resp = await context.env.ASSETS.fetch(assetUrl.toString());
    return new Response(resp.body, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return context.next();
}