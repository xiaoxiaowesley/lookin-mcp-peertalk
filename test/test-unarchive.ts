// Connect to the simulator on 127.0.0.1:47164, send a Ping (empty payload),
// receive the bplist response, and decode it via the NSKeyedArchiver
// unarchiver. Prints the decoded object — should contain `lookinServerVersion`.
import net from "net";
import { PeertalkChannel } from "../src/peertalk/channel.js";
import {
  LookinRequestType,
  PT_FRAME_VERSION,
} from "../src/peertalk/frame-types.js";
import { unarchive } from "../src/peertalk/keyed-unarchiver.js";

async function main() {
  const socket = net.createConnection({ host: "127.0.0.1", port: 47164 });

  socket.on("error", (err) => {
    console.error("Connection error:", err.message);
    console.error(
      "Make sure a simulator app with LookinServer is running on port 47164"
    );
    process.exit(1);
  });

  await new Promise<void>((resolve) => socket.on("connect", resolve));
  console.log("Connected to 127.0.0.1:47164");

  const channel = new PeertalkChannel();
  channel.connect(socket);

  channel.on("frame", (type, tag, payload) => {
    console.log("Received frame:");
    console.log("  type:", type);
    console.log("  tag:", tag);
    console.log("  payloadSize:", payload.length);
    console.log(
      "  payload (first 64 bytes hex):",
      payload.subarray(0, 64).toString("hex")
    );

    try {
      const decoded = unarchive(payload);
      console.log("Decoded bplist payload:");
      console.dir(decoded, { depth: 6, colors: true });

      if (decoded && typeof decoded === "object") {
        const ver =
          (decoded as any).lookinServerVersion ??
          (decoded as any).serverVersion ??
          (decoded as any).version;
        if (ver !== undefined) {
          console.log("✓ lookinServerVersion =", ver);
        } else {
          console.log(
            "(no lookinServerVersion field detected; printed full object above)"
          );
        }
      }
    } catch (e) {
      console.error("Decode failed:", e);
    }

    channel.close();
    process.exit(0);
  });

  // Send Ping frame (empty payload)
  const tag = channel.sendFrame(LookinRequestType.Ping);
  console.log(
    "Sent Ping frame with tag:",
    tag,
    "(frame version:",
    PT_FRAME_VERSION,
    ")"
  );

  setTimeout(() => {
    console.error("Timeout: no response received within 3 seconds");
    channel.close();
    process.exit(1);
  }, 3000);
}

main().catch(console.error);
