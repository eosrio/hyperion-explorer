module.exports = {
  apps: [{
    name: 'hyperion-explorer',
    script: './dist/hyperion-explorer/server/server.mjs',
    watch: false,
    env: {
      HYP_EXPLORER_PORT: 4777,
      HYP_EXPLORER_HOST: '127.0.0.1'
    }
  }]
};
