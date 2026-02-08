module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@nova/types': '../../packages/types/src',
            '@nova/utils': '../../packages/utils/src',
          },
        },
      ],
    ],
  };
};
