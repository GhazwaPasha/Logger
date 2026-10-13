// Marks a compiled output dir as CommonJS so Node does not treat its .js files as ESM.
require("node:fs").writeFileSync(require("node:path").join(process.argv[2], "package.json"), "{\"type\":\"commonjs\"}\n");
