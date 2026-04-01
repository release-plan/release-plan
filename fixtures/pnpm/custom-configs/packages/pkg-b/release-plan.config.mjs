import { fakeRegistryPublish } from '../../local-plugin.mjs';

// pkg-b overrides root config with a different plugin setup
export default {
  plugins: [fakeRegistryPublish({ failPublish: 'pkg-b-error' })],
};
