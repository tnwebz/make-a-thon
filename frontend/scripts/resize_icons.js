import { Jimp } from "jimp";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resizeAssets() {
  try {
    const publicDir = path.join(__dirname, "../public");
    
    // Icon source
    const sourceIconPath = "C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\e184a509-df0a-4834-9ede-24197f6d1526\\pwa_icon_512_1784353545466.png";
    console.log(`Reading source icon from: ${sourceIconPath}`);
    const img = await Jimp.read(sourceIconPath);

    // Resize to 512x512
    console.log("Resizing and writing pwa-512x512.png...");
    const img512 = img.clone();
    img512.resize({ w: 512, h: 512 });
    await img512.write(path.join(publicDir, "pwa-512x512.png"));

    // Resize to 192x192
    console.log("Resizing and writing pwa-192x192.png...");
    const img192 = img.clone();
    img192.resize({ w: 192, h: 192 });
    await img192.write(path.join(publicDir, "pwa-192x192.png"));

    // Resize to 180x180 (apple-touch-icon)
    console.log("Resizing and writing apple-touch-icon.png...");
    const img180 = img.clone();
    img180.resize({ w: 180, h: 180 });
    await img180.write(path.join(publicDir, "apple-touch-icon.png"));

    // Resize to 32x32 (favicon.png)
    console.log("Resizing and writing favicon.png...");
    const img32 = img.clone();
    img32.resize({ w: 32, h: 32 });
    await img32.write(path.join(publicDir, "favicon.png"));

    // Desktop screenshot source & resize to exactly 1280x720
    const sourceDesktopPath = "C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\e184a509-df0a-4834-9ede-24197f6d1526\\desktop_screenshot_1784357608244.png";
    console.log(`Reading and resizing desktop screenshot: ${sourceDesktopPath}`);
    const desktopImg = await Jimp.read(sourceDesktopPath);
    desktopImg.resize({ w: 1280, h: 720 });
    await desktopImg.write(path.join(publicDir, "desktop-screenshot.png"));

    // Mobile screenshot source & resize to exactly 750x1334
    const sourceMobilePath = "C:\\Users\\MSI\\.gemini\\antigravity-ide\\brain\\e184a509-df0a-4834-9ede-24197f6d1526\\mobile_screenshot_1784357647113.png";
    console.log(`Reading and resizing mobile screenshot: ${sourceMobilePath}`);
    const mobileImg = await Jimp.read(sourceMobilePath);
    mobileImg.resize({ w: 750, h: 1334 });
    await mobileImg.write(path.join(publicDir, "mobile-screenshot.png"));

    console.log("✅ All icons and screenshots physically resized and written successfully!");
  } catch (error) {
    console.error("❌ Error resizing assets:", error);
    process.exit(1);
  }
}

resizeAssets();
