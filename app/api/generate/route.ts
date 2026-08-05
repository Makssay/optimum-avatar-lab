import { readFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "google/gemini-2.5-flash-image";
const MAX_FILE_SIZE = 8 * 1024 * 1024;
export const runtime = "nodejs";
export const maxDuration = 120;
const moodPrompts: Record<string, string> = {
  bold: "confident, playful, friendly pose with safe bent-arm gestures only",
  mad: "angry, intense, highly expressive pose with clenched teeth and energetic frustration",
  think: "focused, thoughtful pose with an intelligent curious expression",
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}
async function fileToDataUrl(file: File) { return `data:${file.type};base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`; }
async function assetToDataUrl(assetPath: string) {
  const normalizedPath = assetPath.replace(/^\/+/, "");
  const bytes = await readFile(path.join(process.cwd(), "public", normalizedPath));
  return `data:image/png;base64,${bytesToBase64(new Uint8Array(bytes))}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "Add OPENROUTER_API_KEY to the .env file and restart the site." }, { status: 503 });
  try {
    const form = await request.formData();
    const avatar = form.get("avatar");
    const mood = "bold";
    if (!(avatar instanceof File) || !avatar.type.startsWith("image/")) return Response.json({ error: "Upload a valid image file." }, { status: 400 });
    if (avatar.size > MAX_FILE_SIZE) return Response.json({ error: "The image must be 8 MB or smaller." }, { status: 413 });

    const [primaryMascot, mascotHi, avatarReference] = await Promise.all([
      assetToDataUrl("/mascot/thumb.png"),
      assetToDataUrl("/mascot/hi.png"),
      fileToDataUrl(avatar),
    ]);
    const prompt = `Create ONE official Optimum mascot avatar personalized with visual traits from the uploaded subject.

THIS IS THE CORE CONCEPT:
- The output character IS THE OPTIMUM MASCOT, not the person or animal redrawn in a similar illustration style.
- Images 1-2 are the canonical mascot character sheet and have absolute priority for character identity, anatomy, proportions, head shape, lavender/purple body, face construction, oversized visor/goggles, dark futuristic jacket, neon green/cyan trim, bold outlines, and flat 2D rendering.
- Image 3 is only a personalization reference. Extract its most recognizable traits and apply them ONTO the canonical mascot.
- Target balance: 70% canonical Optimum mascot, 30% traits from image 3.

MANDATORY MASCOT LOCK:
1. Keep the same unmistakable mascot species/body, rounded lavender head and face construction shown in images 1-2.
2. Keep the mascot's large visor/goggles as a dominant design element, worn on the eyes or forehead.
3. Keep the mascot's dark tech jacket silhouette and neon green/cyan Optimum accents.
4. Keep the mascot's playful compact proportions, clean black outlines, flat colors, and minimal cel shading.
5. If the result could be mistaken for a normal human portrait or for the original uploaded character, it is wrong. Rebuild it as the mascot.

PERSONALIZATION FROM IMAGE 3:
- Transfer 3 to 5 high-salience traits such as glasses, hairstyle or hat, expression, dominant clothing color, tie/collar, facial markings, species cues, or one distinctive accessory.
- Adapt those traits to fit the mascot rather than replacing the mascot's anatomy. Example: a person with round glasses, a backward black cap, and a red suit becomes the lavender Optimum mascot wearing round glasses, a backward black cap integrated with the visor, and red panels/lapels on the mascot jacket.
- For an animal or robot, translate its beak/muzzle/ears/helmet shapes and color markings into small recognizable mascot features while the base character remains the Optimum mascot.
- Preserve the source mood and a few identifying color cues, but never copy the original face, body, or outfit literally.

DO NOT:
- Do not draw the uploaded person as a human wearing horns, a visor, or mascot accessories.
- Do not produce a lightly restyled copy, tracing, or anime/cartoon portrait of image 3.
- Do not remove the canonical lavender mascot head/body or replace the tech jacket with the original outfit.
- Do not create a second character, duplicate head, companion, floating prop, text, letters, logo, signature, or watermark.
- Do not draw circular frames, glowing rings, halos, badges, medallions, portholes, round background disks, or any circle/oval outline behind or around the mascot. Avoid cyan/aqua neon circles specifically. The background must stay simple and non-circular.
- Do not use any raised straight-arm salute pose, diagonal upward arm gesture, political salute, military salute, stiff extended arm, or gesture that could be mistaken for an extremist salute. If the mascot raises a hand, it must be a friendly bent-elbow wave, thumbs-up, peace sign, or small fist pose close to the body.

OUTPUT STYLE:
- Exactly ONE centered head-and-shoulders mascot avatar with confident Bold-mode energy and safe friendly hand posture only.
- ALWAYS a flat hand-drawn 2D illustration with bold clean outlines, flat color areas, and minimal cel shading.
- No 3D, CGI, photorealism, realistic lighting, volumetric depth, plastic materials, or painterly realism.
- Clean simple background, strong readable silhouette, crisp official brand-quality finish.

FINAL CHECK: first glance must say “Optimum mascot”; second glance must reveal the uploaded avatar's recognizable traits.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": new URL(request.url).origin, "X-Title": "Optimum Avatar Lab" },
        body: JSON.stringify({ model: MODEL, prompt, resolution: "1K", aspect_ratio: "1:1", n: 1, input_references: [primaryMascot, mascotHi, avatarReference].map((url) => ({ type: "image_url", image_url: { url } })) }),
      });
    } finally { clearTimeout(timeout); }

    const payload = (await providerResponse.json()) as { data?: Array<{ b64_json?: string; media_type?: string }>; cost?: number; usage?: { cost?: number }; error?: { message?: string } | string; message?: string };
    const images = payload.data?.filter((item) => item.b64_json).map((item) => `data:${item.media_type || "image/png"};base64,${item.b64_json}`) || [];
    if (!providerResponse.ok || images.length === 0) {
      const message = typeof payload.error === "string" ? payload.error : payload.error?.message || payload.message;
      const friendlyMessage = providerResponse.status === 402
        ? "OpenRouter has insufficient credits for this generation. Top up the balance and try again."
        : message;
      return Response.json({ error: friendlyMessage || "OpenRouter did not return an image. Please try again." }, { status: providerResponse.status || 502 });
    }
    return Response.json({ image: images[0], images, cost: payload.cost ?? payload.usage?.cost, model: MODEL });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return Response.json({ error: "Generation took too long. Please try again." }, { status: 504 });
    return Response.json({ error: "Could not create the avatar. Check the key and try again." }, { status: 500 });
  }
}
