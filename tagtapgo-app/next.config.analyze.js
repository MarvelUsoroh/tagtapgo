const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: true,
});

const nextConfig = require('./next.config.js');

module.exports = withBundleAnalyzer(nextConfig);
