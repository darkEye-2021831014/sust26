/**
 * Next.js instrumentation hook. Runs once on server start.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startupInit } = await import('@/app/init');
  try {
    await startupInit();
  } catch (err) {
    // Print to console so the failure is visible in the host's deploy logs.
    // eslint-disable-next-line no-console
    console.error('[instrumentation] startup failed:', err);
    throw err;
  }
}
