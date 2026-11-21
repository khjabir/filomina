#!/usr/bin/env node
/**
 * Renders the brand SVGs (public/brand/*.svg) to the raster sizes the web needs:
 *   app/icon.png (favicon), app/apple-icon.png, public/icons/icon-192.png, icon-512.png,
 *   public/brand/og.png (1200×630 social preview)
 */
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

mkdirSync("public/icons", { recursive: true });
const appIcon = readFileSync("public/brand/app-icon.svg");
const logoIcon = readFileSync("public/brand/logo-icon.svg");

const render = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png();
await render(appIcon, 256).toFile("app/icon.png");
await render(appIcon, 180).toFile("app/apple-icon.png");
await render(appIcon, 192).toFile("public/icons/icon-192.png");
await render(appIcon, 512).toFile("public/icons/icon-512.png");

// social preview: icon + wordmark on a deep navy background
const icon = await render(logoIcon, 300).toBuffer();
const wordmark = await sharp(readFileSync("public/brand/wordmark-light.svg"), { density: 384 }).resize({ width: 640 }).png().toBuffer();
const wm = await sharp(wordmark).metadata();
const tagline = Buffer.from(`<svg width="640" height="60" xmlns="http://www.w3.org/2000/svg"><text x="4" y="40" font-family="'Helvetica Neue', Arial, sans-serif" font-size="32" fill="#9BA1B5">Selfie in. Your photos out.</text></svg>`);
await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#07080f" } })
  .composite([
    { input: icon, left: 110, top: 165 },
    { input: wordmark, left: 450, top: Math.round(315 - wm.height / 2) - 30 },
    { input: tagline, left: 450, top: Math.round(315 + wm.height / 2) - 10 },
  ])
  .png()
  .toFile("public/brand/og.png");
console.log("brand assets rendered");
