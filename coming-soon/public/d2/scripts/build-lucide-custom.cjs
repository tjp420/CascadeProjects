// simplebeacon-ignore: debugArtifacts — build script uses console.log for build output
"use strict";
const fs = require("fs");
const path = require("path");

const iconsDir = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "lucide-react",
  "dist",
  "esm",
  "icons",
);

const ICON_NAMES = [
  "award",
  "badge-check",
  "bar-chart-3",
  "book-open",
  "bot",
  "check",
  "chevron-down",
  "clipboard-list",
  "clipboard-check",
  "code-2",
  "copy",
  "download",
  "eye",
  "eye-off",
  "file-text",
  "file-up",
  "flask-conical",
  "folder",
  "folder-open",
  "folder-search",
  "globe",
  "help-circle",
  "info",
  "key-round",
  "layers",
  "layout-dashboard",
  "lock",
  "log-in",
  "log-out",
  "mail",
  "map",
  "menu",
  "package",
  "play",
  "rocket",
  "rotate-ccw",
  "save",
  "search",
  "settings",
  "shield",
  "shield-check",
  "shopping-cart",
  "sun",
  "tag",
  "trash-2",
  "unlock",
  "user",
  "user-cog",
  "users",
  "wifi",
  "wrench",
  "x",
  "zap",
];

function resolveIconFile(filePath, depth) {
  if (depth > 5) return null;
  var raw = fs.readFileSync(filePath, "utf8");
  var reExportMatch = raw.match(
    /export\s*\{\s*default\s*\}\s*from\s*['"]\.\/([^'"]+)\.js['"]/,
  );
  if (reExportMatch) {
    var resolved = path.join(path.dirname(filePath), reExportMatch[1] + ".js");
    if (fs.existsSync(resolved)) return resolveIconFile(resolved, depth + 1);
  }
  return filePath;
}

function extractIconNode(filePath) {
  var resolved = resolveIconFile(filePath, 0);
  if (!resolved) return null;
  var raw = fs.readFileSync(resolved, "utf8");
  var match = raw.match(/createLucideIcon\("(\w+)",\s*\[([\s\S]*)\]\)/);
  if (!match) return null;
  var name = match[1];
  var nodeStr = "[" + match[2] + "]";
  var nodes;
  try {
    nodes = new Function("return " + nodeStr)();
  } catch (e) {
    console.error("Failed to parse icon nodes for", resolved, e.message);
    return null;
  }
  return { name: name, nodes: nodes };
}

function nodeToSvgInner(nodes) {
  return nodes
    .map(function (node) {
      var tag = node[0];
      var attrs = node[1];
      var attrStr = Object.keys(attrs)
        .filter(function (k) {
          return k !== "key";
        })
        .map(function (k) {
          return k + '="' + attrs[k] + '"';
        })
        .join(" ");
      if (
        tag === "line" ||
        tag === "path" ||
        tag === "circle" ||
        tag === "rect" ||
        tag === "polyline" ||
        tag === "polygon" ||
        tag === "ellipse"
      ) {
        return "<" + tag + " " + attrStr + "/>";
      }
      return "<" + tag + " " + attrStr + "></" + tag + ">";
    })
    .join("");
}

var iconMap = {};
var missing = [];

for (var i = 0; i < ICON_NAMES.length; i++) {
  var iconName = ICON_NAMES[i];
  var filePath = path.join(iconsDir, iconName + ".js");
  if (!fs.existsSync(filePath)) {
    missing.push(iconName);
    continue;
  }
  var result = extractIconNode(filePath);
  if (!result) {
    missing.push(iconName);
    continue;
  }
  iconMap[iconName] = nodeToSvgInner(result.nodes);
}

if (missing.length > 0) {
  console.error("Missing icons:", missing.join(", "));
  process.exit(1);
}

var banner =
  "/**\n * lucide custom bundle - ISC License\n * Generated from lucide-react v0.460.0\n * Icons: " +
  ICON_NAMES.length +
  " (tree-shaken from " +
  ICON_NAMES.length +
  ")\n */\n";

var js = banner + "\n";
js += "(function(global){\n";
js += "  var icons = " + JSON.stringify(iconMap, null, 0) + ";\n";
js += "  function createIcons(opts){\n";
js += "    opts=opts||{};\n";
js += "    var root=opts.root||document;\n";
js += '    var els=root.querySelectorAll("[data-lucide]");\n';
js += "    for(var i=0;i<els.length;i++){\n";
js += "      var el=els[i];\n";
js += '      var name=el.getAttribute("data-lucide");\n';
js += "      var inner=icons[name];\n";
js += "      if(!inner) continue;\n";
js += "      var size=20;\n";
js += '      var cls=el.className||"";\n';
js += "      var m=cls.match(/icon-(\\d+)/);\n";
js += "      if(m) size=parseInt(m[1],10);\n";
js +=
  '      var svg="<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\""+size+"\\" height=\\""+size+"\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\">"+inner+"</svg>";\n';
js += '      var wrapper=document.createElement("span");\n';
js += '      wrapper.style.display="inline-flex";\n';
js += "      wrapper.innerHTML=svg;\n";
js += "      var newEl=wrapper.firstChild;\n";
js += "      newEl.className=cls;\n";
js += "      el.parentNode.replaceChild(newEl,el);\n";
js += "    }\n";
js += "  }\n";
js += "  global.lucide={createIcons:createIcons,icons:icons};\n";
js += '})(typeof window!=="undefined"?window:this);\n';

var outPath = path.resolve(__dirname, "..", "js", "vendor", "lucide.min.js");
fs.writeFileSync(outPath, js, "utf8");
var sizeBytes = fs.statSync(outPath).size;
console.log(
  "Generated " +
    outPath +
    " (" +
    (sizeBytes / 1024).toFixed(1) +
    " KB, " +
    ICON_NAMES.length +
    " icons)",
);
