import { httpError, ok, requireActor, HttpError } from "@/src/lib/http";
import { uploadLandingImage } from "@/src/lib/services/landing-content";

// POST /api/v2/landing-content/upload
// Multipart form: { kind: "hero-bg" | "doctor-photo", file: <image> }
// Returns { url } — caller then PATCHes /landing-content with that URL.
//
// Kept as two requests (upload then PATCH) so a failed save doesn't leave
// orphan rows pointing at a missing image, and a successful upload can be
// previewed before commit.
export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const form = await req.formData();
    const kindRaw = String(form.get("kind") ?? "");
    const file = form.get("file");

    if (kindRaw !== "hero-bg" && kindRaw !== "doctor-photo") {
      throw new HttpError(400, "kind must be 'hero-bg' or 'doctor-photo'");
    }
    if (!(file instanceof File)) {
      throw new HttpError(400, "file is required");
    }

    const result = await uploadLandingImage(kindRaw, file, actor);
    return ok(result);
  } catch (e) {
    return httpError(e);
  }
}
