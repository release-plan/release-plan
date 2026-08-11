import { fakeRegistryPublish } from './local-plugin.mjs';

export default {
  plugins: [
    fakeRegistryPublish(),
    { name: 'inline-root-plugin', publish: async () => {} },
  ],
};
