// Simulates a third-party plugin package.
// A real package would: import type { ... } from 'release-plan' for types only,
// then export a factory function returning a PublishPlugin object.

export function fakeRegistryPublish(options = {}) {
  const calls = [];

  return {
    name: 'fake-registry-publish',

    async validate(context) {
      calls.push({ phase: 'validate', context, api: this });
      if (options.failValidate) {
        this.releaseError(options.failValidate);
      }
    },

    async publish(context) {
      calls.push({ phase: 'publish', context, api: this });
      if (options.failPublish) {
        this.reportFailure(options.failPublish);
      }
    },

    // Exposed for test assertions
    get calls() {
      return calls;
    },
  };
}
