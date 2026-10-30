const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../packages/shared")];
config.resolver.unstable_enablePackageExports = true; // viem subpath exports (viem/ens, viem/chains)
module.exports = config;
