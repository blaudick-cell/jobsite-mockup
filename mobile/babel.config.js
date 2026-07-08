// Expo Router auto-wires its entry through `expo-router/babel`'s replacement
// (now folded into `babel-preset-expo`). Keep this file minimal — the preset
// covers Reanimated, the router, and JSX runtime out of the box.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
