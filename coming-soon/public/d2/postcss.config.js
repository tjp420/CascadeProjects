import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// PostCSS plugin: strip -webkit-text-size-adjust from compiled CSS.
// Firefox doesn't recognize the -webkit- prefix and logs a parse warning
// on every page load. The standard text-size-adjust is set in globals.css.
// Uses OnceExit to run after Tailwind injects its preflight CSS.
const stripWebkitTextSizeAdjust = {
  postcssPlugin: "strip-webkit-text-size-adjust",
  OnceExit(root) {
    root.walkDecls("-webkit-text-size-adjust", (decl) => {
      decl.remove();
    });
  },
};

export default {
  plugins: [tailwindcss, autoprefixer, stripWebkitTextSizeAdjust],
};
