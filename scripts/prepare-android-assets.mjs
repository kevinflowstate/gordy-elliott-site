import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const source = 'public/at-capacity-icon-512x512.png';
const res = 'android/app/src/main/res';
for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  const directory = `${res}/mipmap-${density}`;
  await mkdir(directory, { recursive: true });
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    await sharp(source).resize(Math.round(48 * scale)).png().toFile(`${directory}/${name}.png`);
  }
  const canvas = Math.round(108 * scale);
  const mark = await sharp(source).resize(Math.round(66 * scale)).png().toBuffer();
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: '#0A0A0A' } })
    .composite([{ input: mark, gravity: 'centre' }]).png().toFile(`${directory}/ic_launcher_foreground.png`);
}
await mkdir(`${res}/drawable-nodpi`, { recursive: true });
await sharp(source).resize(192).png().toFile(`${res}/drawable-nodpi/capacity_splash_icon.png`);
await sharp({ create: { width: 1080, height: 1920, channels: 4, background: '#0A0A0A' } })
  .composite([{ input: await sharp(source).resize(240).png().toBuffer(), gravity: 'centre' }])
  .png().toFile(`${res}/drawable/splash.png`);
