// Connect to localhost:47164 (simulator first port), send a Ping frame (empty payload), print response.
import net from 'net';
import { PeertalkChannel } from '../src/peertalk/channel.js';
import { LookinRequestType, PT_FRAME_VERSION } from '../src/peertalk/frame-types.js';

async function main() {
  const socket = net.createConnection({ host: '127.0.0.1', port: 47164 });

  socket.on('error', (err) => {
    console.error('Connection error:', err.message);
    console.error('Make sure a simulator app with LookinServer is running on port 47164');
    process.exit(1);
  });

  await new Promise<void>((resolve) => socket.on('connect', resolve));
  console.log('Connected to 127.0.0.1:47164');

  const channel = new PeertalkChannel();
  channel.connect(socket);

  channel.on('frame', (type, tag, payload) => {
    console.log('Received frame:');
    console.log('  type:', type);
    console.log('  tag:', tag);
    console.log('  payloadSize:', payload.length);
    console.log('  payload (first 100 bytes hex):', payload.subarray(0, 100).toString('hex'));

    // Success! Close connection
    channel.close();
    process.exit(0);
  });

  // Send Ping frame (empty payload)
  const tag = channel.sendFrame(LookinRequestType.Ping);
  console.log('Sent Ping frame with tag:', tag, '(frame version:', PT_FRAME_VERSION, ')');

  // Timeout after 3 seconds
  setTimeout(() => {
    console.error('Timeout: no response received within 3 seconds');
    channel.close();
    process.exit(1);
  }, 3000);
}

main().catch(console.error);
