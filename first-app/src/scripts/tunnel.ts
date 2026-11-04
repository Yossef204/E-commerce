import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root directory explicitly
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import * as ngrokModule from '@ngrok/ngrok';
const ngrok: any = (ngrokModule as any).default || ngrokModule;

async function bootstrapTunnel() {
  const token = process.env.NGROK_AUTHTOKEN;
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const domain = 'meadow-unfactual-hyun.ngrok-free.dev';

  if (!token) {
    console.error('❌ Error: NGROK_AUTHTOKEN is missing or empty in .env!');
    process.exit(1);
  }

  try {
    console.log(`🔌 Initializing ngrok tunnel pointing to port ${port}...`);

    const listener = await ngrok.forward({
      addr: port,
      authtoken: token,
      domain: domain,
    });

    console.log('\n======================================================');
    console.log('🚀 Ngrok Public Tunnel is ONLINE & ACTIVE!');
    console.log(`🔗 Public URL: ${listener.url()}`);
    console.log(`📑 Swagger UI: ${listener.url()}/api/docs`);
    console.log(`💳 Paymob Webhook Target: ${listener.url()}/payments/webhook/paymob`);
    console.log('======================================================\n');
    console.log('Press Ctrl+C to stop the tunnel session.');

    // Keep event loop alive while tunnel is active
    const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

    const cleanup = async () => {
      clearInterval(keepAlive);
      console.log('\n🛑 Closing ngrok tunnel...');
      try {
        await ngrok.disconnect();
      } catch {}
      process.exit(0);
    };

    // Keep process alive and register cleanup hooks
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (error) {
    console.error('❌ Failed to establish ngrok tunnel:', error);
    process.exit(1);
  }
}

bootstrapTunnel();
