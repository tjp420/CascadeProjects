/**
 * No-op handler for the VS Code: extension's local /api/notify bridge.
 *
 * The dashboard calls this endpoint to notify the extension about downloads,
 * auth state, etc. When the dashboard is hosted (simplebeacon.ai) there is no
 * local data server, so the request would otherwise 404. This function swallows
 * the notification and returns 200.
 */
export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (request.method === 'POST' || request.method === 'GET') {
    return new Response(JSON.stringify({ success: true, hosted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('Method not allowed', { status: 405 });
}
