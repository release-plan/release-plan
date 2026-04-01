// Simulates a third-party plugin package.
// A real package would: import type { ... } from 'release-plan' for types only,
// then export a factory function returning a PublishPlugin object.

export function fakeRegistryPublish(options = {}) {
  const calls = [];

  return {
    name: 'fake-registry-publish',

    async prepare(context, api) {
      calls.push({ phase: 'prepare', context, api });
      if (options.failPrepare) {
        throw new api.UserError(options.failPrepare);
      }
    },

    async publish(context, api) {
      calls.push({ phase: 'publish', context, api });
      if (options.failPublish) {
        api.reportFailure(options.failPublish);
      }
    },

    // Exposed for test assertions
    get calls() {
      return calls;
    },
  };
}
