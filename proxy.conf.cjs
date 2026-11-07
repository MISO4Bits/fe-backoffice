module.exports = {
  '/web/**': {
    target: process.env.BFF_PROXY_TARGET || 'http://localhost:8081',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/web(?=\/|$)/, ''),
  },
};
