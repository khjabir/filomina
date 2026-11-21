#!/usr/bin/env node
/** Renders public/icon.svg to the PNG sizes used by the manifest and iOS. */
import { readFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("public/icon.svg");
mkdirSync("public/icons", { recursive: true });
await sharp(svg).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(svg).resize(180, 180).png().toFile("app/apple-icon.png");
console.log("icons written: public/icons/icon-192.png, public/icons/icon-512.png, app/apple-icon.png");
