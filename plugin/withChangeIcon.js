// Expo config plugin: registers alternate app icons for react-native-change-icon.
//
// iOS: each icon is an Icon Composer file (`<iconsDir>/<id>.icon`). Xcode compiles
// it into the asset catalog with light, dark, tinted and clear appearances and
// generates the CFBundleAlternateIcons entries. Flat PNGs
// (`<iconsDir>/<id>-{120,144,152,167}.png`) are still supported as a fallback,
// but only light.
//
// Android: each icon is an activity-alias. With `<iconsDir>/<id>-android-foreground.png`
// it becomes an adaptive icon (plus `<id>-android-monochrome.png` for Android 13+
// themed icons); otherwise the flat `<iconsDir>/<id>.png` is used.
const {
  AndroidConfig,
  IOSConfig,
  createRunOncePlugin,
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");

const LEGACY_IOS_SIZES = [120, 144, 152, 167];
const ANDROID_DPIS = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};
const ANDROID_ADAPTIVE_DP = 108;
const ANDROID_LEGACY_DP = 48;
const ANDROID_RES = "app/src/main/res";

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   ios?: string,
 *   android?: {
 *     foregroundImage?: string,
 *     monochromeImage?: string,
 *     backgroundColor?: string,
 *     backgroundImage?: string,
 *   },
 * }} IconOption
 * @typedef {{ icons: IconOption[], iconsDir?: string }} PluginOptions
 */

function normalizeOptions(options) {
  const opts = Array.isArray(options) ? { icons: options } : options || {};
  const icons = opts.icons || [];
  if (!icons.length) {
    throw new Error(`${pkg.name}: no icons configured`);
  }
  for (const icon of icons) {
    // The id is the iOS icon name and the Android activity-alias class name
    // and resource suffix, so it has to be valid for all three.
    if (!/^[a-z][a-z0-9_]*$/.test(icon.id || "")) {
      throw new Error(
        `${pkg.name}: icon id "${icon.id}" must match /^[a-z][a-z0-9_]*$/`
      );
    }
    if (icon.id === "standard") {
      throw new Error(`${pkg.name}: icon id "standard" is reserved`);
    }
    if (!icon.label) {
      throw new Error(`${pkg.name}: icon "${icon.id}" needs a label`);
    }
  }
  return { iconsDir: opts.iconsDir || "icons", icons };
}

function exists(projectRoot, file) {
  return !!file && fs.existsSync(path.resolve(projectRoot, file));
}

function resolveIosIcon(projectRoot, iconsDir, icon) {
  const composer = icon.ios || path.join(iconsDir, `${icon.id}.icon`);
  if (path.extname(composer) === ".icon" && exists(projectRoot, composer)) {
    return { type: "composer", src: composer };
  }
  if (icon.ios) {
    throw new Error(`${pkg.name}: iOS icon "${icon.ios}" not found`);
  }
  const files = LEGACY_IOS_SIZES.map((size) =>
    path.join(iconsDir, `${icon.id}-${size}.png`)
  );
  const missing = files.filter((file) => !exists(projectRoot, file));
  if (missing.length) {
    throw new Error(
      `${pkg.name}: no iOS icon for "${icon.id}" (expected ${composer} or ${missing.join(", ")})`
    );
  }
  return { type: "legacy", files };
}

function getIosIcons(config, { iconsDir, icons }) {
  const projectRoot = config.modRequest.projectRoot;
  const resolved = icons.map((icon) => ({
    ...icon,
    resolved: resolveIosIcon(projectRoot, iconsDir, icon),
  }));
  // Xcode writes CFBundleAlternateIcons for asset catalog icons; the legacy
  // icons need hand-written entries. Both in one Info.plist is untested.
  const types = new Set(resolved.map((icon) => icon.resolved.type));
  if (types.size > 1) {
    throw new Error(
      `${pkg.name}: mixing .icon and PNG icons is not supported; provide a .icon for every icon`
    );
  }
  return { mode: [...types][0], icons: resolved };
}

const withIosAlternateIcons = (config, options) => {
  config = withXcodeProject(config, (config) => {
    const { mode, icons } = getIosIcons(config, options);
    const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
    const project = config.modResults;

    if (mode === "composer") {
      for (const icon of icons) {
        // Copied next to the main .icon/Images.xcassets, as Expo does for ios.icon.
        const target = path.join(platformProjectRoot, projectName, `${icon.id}.icon`);
        fs.rmSync(target, { recursive: true, force: true });
        fs.cpSync(path.resolve(projectRoot, icon.resolved.src), target, {
          recursive: true,
        });
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: `${projectName}/${icon.id}.icon`,
          groupName: projectName,
          project,
          isBuildFile: true,
          verbose: true,
        });
      }

      const [, target] = IOSConfig.Target.findNativeTargetByName(project, projectName);
      const configurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
        project,
        target.buildConfigurationList
      );
      const names = `"${icons.map((icon) => icon.id).join(" ")}"`;
      for (const [, buildConfig] of configurations) {
        if (buildConfig.buildSettings) {
          buildConfig.buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = names;
        }
      }
      return config;
    }

    const resources = path.join(platformProjectRoot, projectName, "Resources");
    fs.mkdirSync(resources, { recursive: true });
    for (const icon of icons) {
      for (const file of icon.resolved.files) {
        const name = path.basename(file);
        fs.copyFileSync(path.resolve(projectRoot, file), path.join(resources, name));
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: `${projectName}/Resources/${name}`,
          groupName: projectName,
          project,
          isBuildFile: true,
          verbose: true,
        });
      }
    }
    return config;
  });

  config = withInfoPlist(config, (config) => {
    const { mode, icons } = getIosIcons(config, options);
    if (mode === "composer") {
      // Generated by Xcode from ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES.
      delete config.modResults.CFBundleIcons;
      delete config.modResults["CFBundleIcons~ipad"];
      return config;
    }

    const alternateIcons = {};
    for (const icon of icons) {
      alternateIcons[icon.id] = {
        UIPrerenderedIcon: true,
        CFBundleIconFiles: icon.resolved.files.map((file) =>
          path.basename(file, ".png")
        ),
      };
    }
    config.modResults.CFBundleIcons = {
      ...config.modResults.CFBundleIcons,
      CFBundleAlternateIcons: alternateIcons,
    };
    config.modResults["CFBundleIcons~ipad"] = {
      ...config.modResults["CFBundleIcons~ipad"],
      CFBundleAlternateIcons: alternateIcons,
    };
    return config;
  });

  return config;
};

function resolveAndroidIcon(projectRoot, iconsDir, icon) {
  const opts = icon.android || {};
  const foregroundImage =
    opts.foregroundImage || path.join(iconsDir, `${icon.id}-android-foreground.png`);
  if (exists(projectRoot, foregroundImage)) {
    const monochromeImage =
      opts.monochromeImage || path.join(iconsDir, `${icon.id}-android-monochrome.png`);
    if (opts.monochromeImage && !exists(projectRoot, monochromeImage)) {
      throw new Error(`${pkg.name}: "${monochromeImage}" not found`);
    }
    if (opts.backgroundImage && !exists(projectRoot, opts.backgroundImage)) {
      throw new Error(`${pkg.name}: "${opts.backgroundImage}" not found`);
    }
    return {
      type: "adaptive",
      foregroundImage,
      monochromeImage: exists(projectRoot, monochromeImage) ? monochromeImage : null,
      backgroundImage: opts.backgroundImage || null,
      backgroundColor: opts.backgroundColor || "#ffffff",
    };
  }
  if (opts.foregroundImage) {
    throw new Error(`${pkg.name}: "${opts.foregroundImage}" not found`);
  }
  const legacy = path.join(iconsDir, `${icon.id}.png`);
  if (!exists(projectRoot, legacy)) {
    throw new Error(
      `${pkg.name}: no Android icon for "${icon.id}" (expected ${foregroundImage} or ${legacy})`
    );
  }
  return { type: "legacy", src: legacy };
}

function getAndroidIcons(projectRoot, { iconsDir, icons }) {
  return icons.map((icon) => ({
    ...icon,
    resolved: resolveAndroidIcon(projectRoot, iconsDir, icon),
  }));
}

function androidIconResource(icon) {
  return icon.resolved.type === "adaptive"
    ? `@mipmap/ic_launcher_${icon.id}`
    : `@drawable/icon_${icon.id}`;
}

function requireImageUtils(projectRoot) {
  // Ships with expo (@expo/prebuild-config uses it for the main icon).
  return require(require.resolve("@expo/image-utils", { paths: [projectRoot] }));
}

async function writeAndroidLayerAsync(imageUtils, projectRoot, resDir, { src, name, dp, backgroundColor, cacheType }) {
  for (const [dpi, scale] of Object.entries(ANDROID_DPIS)) {
    const size = dp * scale;
    const { source } = await imageUtils.generateImageAsync(
      { projectRoot, cacheType: `${pkg.name}-${cacheType}` },
      {
        src: path.resolve(projectRoot, src),
        width: size,
        height: size,
        resizeMode: "cover",
        backgroundColor: backgroundColor || "transparent",
      }
    );
    const dir = path.join(resDir, `mipmap-${dpi}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.png`), source);
  }
}

async function writeAndroidIconsAsync(config, options) {
  const { projectRoot, platformProjectRoot } = config.modRequest;
  const resDir = path.join(platformProjectRoot, ANDROID_RES);
  const icons = getAndroidIcons(projectRoot, options);
  let imageUtils;

  for (const icon of icons) {
    const { resolved, id } = icon;
    if (resolved.type === "legacy") {
      const dir = path.join(resDir, "drawable-mdpi");
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.resolve(projectRoot, resolved.src), path.join(dir, `icon_${id}.png`));
      continue;
    }

    imageUtils = imageUtils || requireImageUtils(projectRoot);
    const base = `ic_launcher_${id}`;
    await writeAndroidLayerAsync(imageUtils, projectRoot, resDir, {
      src: resolved.foregroundImage,
      name: `${base}_foreground`,
      dp: ANDROID_ADAPTIVE_DP,
      cacheType: `${id}-foreground`,
    });
    if (resolved.monochromeImage) {
      await writeAndroidLayerAsync(imageUtils, projectRoot, resDir, {
        src: resolved.monochromeImage,
        name: `${base}_monochrome`,
        dp: ANDROID_ADAPTIVE_DP,
        cacheType: `${id}-monochrome`,
      });
    }
    if (resolved.backgroundImage) {
      await writeAndroidLayerAsync(imageUtils, projectRoot, resDir, {
        src: resolved.backgroundImage,
        name: `${base}_background`,
        dp: ANDROID_ADAPTIVE_DP,
        cacheType: `${id}-background`,
      });
    }
    // Pre-Android 8 (minSdk 24) has no adaptive icons: flattened square.
    await writeAndroidLayerAsync(imageUtils, projectRoot, resDir, {
      src: resolved.foregroundImage,
      name: base,
      dp: ANDROID_LEGACY_DP,
      backgroundColor: resolved.backgroundColor,
      cacheType: `${id}-legacy`,
    });

    const background = resolved.backgroundImage
      ? `@mipmap/${base}_background`
      : `@color/${base}_background`;
    const layers = [
      `    <background android:drawable="${background}"/>`,
      `    <foreground android:drawable="@mipmap/${base}_foreground"/>`,
    ];
    if (resolved.monochromeImage) {
      layers.push(`    <monochrome android:drawable="@mipmap/${base}_monochrome"/>`);
    }
    const anyDpi = path.join(resDir, "mipmap-anydpi-v26");
    fs.mkdirSync(anyDpi, { recursive: true });
    fs.writeFileSync(
      path.join(anyDpi, `${base}.xml`),
      [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
        ...layers,
        "</adaptive-icon>",
        "",
      ].join("\n")
    );
  }
}

function addActivityAliases(config, options) {
  const icons = getAndroidIcons(config.modRequest.projectRoot, options);
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
  const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);

  // The aliases are the launcher entries; MainActivity must not be one itself.
  const launcherFilter = (mainActivity["intent-filter"] || []).find((filter) =>
    (filter.action || []).some(
      (action) => action.$["android:name"] === "android.intent.action.MAIN"
    )
  );
  if (launcherFilter && launcherFilter.category) {
    launcherFilter.category = launcherFilter.category.filter(
      (category) => category.$["android:name"] !== "android.intent.category.LAUNCHER"
    );
    if (!launcherFilter.category.length) {
      delete launcherFilter.category;
    }
  }

  const entries = [
    ...icons.map((icon) => ({
      id: icon.id,
      label: icon.label,
      icon: androidIconResource(icon),
      enabled: false,
    })),
    {
      id: "standard",
      label: "@string/app_name",
      icon: "@mipmap/ic_launcher",
      enabled: true,
    },
  ];

  const aliases = (application["activity-alias"] || []).filter(
    (alias) => !entries.some((entry) => alias.$["android:name"] === `.${entry.id}`)
  );
  for (const entry of entries) {
    // No roundIcon: launchers then use android:icon instead of the
    // application's round icon.
    aliases.push({
      $: {
        "android:name": `.${entry.id}`,
        "android:targetActivity": ".MainActivity",
        "android:label": entry.label,
        "android:icon": entry.icon,
        "android:exported": "true",
        "android:enabled": String(entry.enabled),
      },
      "intent-filter": [
        {
          $: { "android:label": entry.label },
          action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
          category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
        },
      ],
    });
  }
  application["activity-alias"] = aliases;
}

const withAndroidAlternateIcons = (config, options) => {
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      await writeAndroidIconsAsync(config, options);
      return config;
    },
  ]);

  config = withAndroidColors(config, (config) => {
    const icons = getAndroidIcons(config.modRequest.projectRoot, options);
    for (const icon of icons) {
      const name = `ic_launcher_${icon.id}_background`;
      const value =
        icon.resolved.type === "adaptive" && !icon.resolved.backgroundImage
          ? icon.resolved.backgroundColor
          : null;
      config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
        name,
        value,
      });
    }
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    addActivityAliases(config, options);
    return config;
  });

  return config;
};

/** @type {import('expo/config-plugins').ConfigPlugin<PluginOptions | IconOption[]>} */
const withChangeIcon = (config, options) => {
  const normalized = normalizeOptions(options);
  config = withIosAlternateIcons(config, normalized);
  config = withAndroidAlternateIcons(config, normalized);
  return config;
};

module.exports = createRunOncePlugin(withChangeIcon, pkg.name, pkg.version);
