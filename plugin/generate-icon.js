#!/usr/bin/env node
// Drafts icon sources for the config plugin from a flat logo-on-white PNG:
//   <out>/<id>.icon                     Icon Composer file (light, dark, tinted/clear)
//   <out>/<id>-android-foreground.png   adaptive icon foreground (logo in the safe zone)
//   <out>/<id>-android-monochrome.png   Android 13+ themed icon
//
// The logo is cut out of the white background; dark mode inverts its greys and
// keeps its colours, tinted/clear mode uses a white silhouette. This is a quick
// start: open the .icon in Icon Composer to check and refine it.
//
// Requires ImageMagick 7 (`magick`). Previews need Xcode 26+ (ictool).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const USAGE = `Usage: change-icon-generate <logo.png> --id <id> [options]

Options:
  --out <dir>          output directory (default: icons)
  --fuzz <percent>     how close to white a pixel must be to be removed (default: 9)
  --light-fill <hex>   background in light mode (default: #ffffff)
  --dark-fill <hex>    background in dark mode (default: #151718)
  --preview            also render <out>/previews/<id>-<appearance>.png with ictool
`;

// Adaptive icons show the central 72dp of 108dp, and the safe zone is 66dp.
const ANDROID_SAFE_ZONE = 66 / 108;
const SIZE = 1024;
const PREVIEW_RENDITIONS = ["Default", "Dark", "TintedLight", "TintedDark", "ClearLight", "ClearDark"];

function parseArgs(argv) {
  const args = { out: "icons", fuzz: "9", lightFill: "#ffffff", darkFill: "#151718", preview: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--id") args.id = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--fuzz") args.fuzz = next();
    else if (arg === "--light-fill") args.lightFill = next();
    else if (arg === "--dark-fill") args.darkFill = next();
    else if (arg === "--preview") args.preview = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg.startsWith("-")) throw new Error(`unknown option ${arg}`);
    else rest.push(arg);
  }
  args.src = rest[0];
  return args;
}

function magick(...args) {
  execFileSync("magick", args, { stdio: ["ignore", "ignore", "inherit"] });
}

/** "#rrggbb" -> "srgb:r,g,b,1" as Icon Composer writes it */
function toIconColor(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`invalid colour ${hex}, expected #rrggbb`);
  const channels = [0, 2, 4].map((i) => (parseInt(match[1].slice(i, i + 2), 16) / 255).toFixed(5));
  return `srgb:${channels.join(",")},1.00000`;
}

function iconJson({ lightFill, darkFill }) {
  return {
    "fill-specializations": [
      { value: { solid: toIconColor(lightFill) } },
      { appearance: "dark", value: { solid: toIconColor(darkFill) } },
    ],
    groups: [
      {
        layers: [
          {
            "image-name-specializations": [
              { value: "logo-light.png" },
              { appearance: "dark", value: "logo-dark.png" },
              // Tinted and clear icons are derived from luminance: a white
              // silhouette keeps the logo visible instead of an outline.
              { appearance: "tinted", value: "logo-mono.png" },
            ],
            // Flat logos look embossed/hollow with the glass material.
            glass: false,
            name: "logo",
          },
        ],
        specular: false,
        shadow: { kind: "neutral", opacity: 0.5 },
        translucency: { enabled: false, value: 0.5 },
      },
    ],
    "supported-platforms": { squares: ["iOS"] },
  };
}

function findIctool() {
  const developerDir = execFileSync("xcode-select", ["-p"], { encoding: "utf8" }).trim();
  const ictool = path.join(
    developerDir,
    "..",
    "Applications",
    "Icon Composer.app",
    "Contents",
    "Executables",
    "ictool"
  );
  if (!fs.existsSync(ictool)) throw new Error(`ictool not found at ${ictool} (needs Xcode 26+)`);
  return ictool;
}

function generate(args) {
  const { src, id, out } = args;
  const icon = path.join(out, `${id}.icon`);
  const assets = path.join(icon, "Assets");
  fs.rmSync(icon, { recursive: true, force: true });
  fs.mkdirSync(assets, { recursive: true });

  const light = path.join(assets, "logo-light.png");
  const dark = path.join(assets, "logo-dark.png");
  const mono = path.join(assets, "logo-mono.png");

  // Cut out the white background, then scale to the 1024 canvas.
  magick(src, "-alpha", "set", "-fuzz", `${args.fuzz}%`, "-transparent", "white",
    "-filter", "Lanczos", "-resize", `${SIZE}x${SIZE}`,
    "-background", "none", "-gravity", "center", "-extent", `${SIZE}x${SIZE}`, light);
  // Dark: invert greys (black text -> light), keep brand colours but lift
  // dark ones (e.g. navy) so they stay readable on the dark fill.
  magick(light, "-channel", "RGB", "-fx",
    "saturation < 0.25 ? 1 - u * 0.9 : (lightness < 0.45 ? u + 0.45 - lightness : u)",
    "+channel", dark);
  // Silhouette for tinted/clear and the Android monochrome layer.
  magick(light, "-channel", "RGB", "-evaluate", "set", "100%", "+channel", mono);

  fs.writeFileSync(path.join(icon, "icon.json"), JSON.stringify(iconJson(args), null, 2) + "\n");

  const safe = String(Math.round(SIZE * ANDROID_SAFE_ZONE));
  for (const [source, name] of [[light, "foreground"], [mono, "monochrome"]]) {
    magick(source, "-resize", `${safe}x${safe}`, "-background", "none", "-gravity", "center",
      "-extent", `${SIZE}x${SIZE}`, path.join(out, `${id}-android-${name}.png`));
  }

  if (args.preview) {
    const ictool = findIctool();
    const previews = path.join(out, "previews");
    fs.mkdirSync(previews, { recursive: true });
    const files = PREVIEW_RENDITIONS.map((rendition) => {
      const file = path.join(previews, `${id}-${rendition}.png`);
      execFileSync(ictool, [icon, "--export-image", "--output-file", file, "--platform", "iOS",
        "--rendition", rendition, "--width", "256", "--height", "256", "--scale", "1",
        "--tint-color", "0.6", "--tint-strength", "0.8"], { stdio: "ignore" });
      return file;
    });
    magick("montage", ...files, "-tile", `${files.length}x1`, "-geometry", "+4+4",
      "-background", "#777777", path.join(previews, `${id}.png`));
  }
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    process.exit(1);
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (!args.src || !args.id) {
    console.error(USAGE);
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(args.id)) {
    console.error(`--id must match /^[a-z][a-z0-9_]*$/`);
    process.exit(1);
  }
  generate(args);
  console.log(`${args.id}: ${path.join(args.out, `${args.id}.icon`)}, ${args.id}-android-{foreground,monochrome}.png`);
}

main();
