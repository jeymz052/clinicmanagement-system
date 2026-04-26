import { isAuthorizedCronRequest } from "@/src/lib/cron";
import { httpError, ok } from "@/src/lib/http";
import { processDueNotifications } from "@/src/lib/services/notification-dispatch";

async function handleDrainCron(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return ok({ message: "Forbidden" }, 403);
    }

    return ok(await processDueNotifications());
  } catch (e) {
    return httpError(e);
  }
}

export async function GET(req: Request) {
  return handleDrainCron(req);
}

export async function POST(req: Request) {
  return handleDrainCron(req);
}
