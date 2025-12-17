// app/api/mobile/chat/route.ts
import { POST as ChatPOST } from '../chat/route';

// We reuse the exact same logic to ensure "Single Source of Truth"
// The Mobile App will fetch to: https://converge-app.com/api/mobile/chat
export async function POST(req: Request) {
  return ChatPOST(req);
}
