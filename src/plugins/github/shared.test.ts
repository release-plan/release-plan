import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createOctokit } from './shared.js';

const octokitConstructor = vi.fn();
vi.mock('@octokit/rest', () => {
  return {
    Octokit: function (...args: unknown[]) {
      octokitConstructor(...args);
    },
  };
});

describe('createOctokit', function () {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.GITHUB_AUTH = process.env.GITHUB_AUTH;
    savedEnv.GITHUB_API_URL = process.env.GITHUB_API_URL;
    savedEnv.GITHUB_DOMAIN = process.env.GITHUB_DOMAIN;
    octokitConstructor.mockClear();
  });

  afterEach(() => {
    // Restore original env values
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('uses GITHUB_API_URL as baseUrl when set', function () {
    process.env.GITHUB_API_URL = 'https://api.custombase.com';
    process.env.GITHUB_AUTH = 'auth';

    createOctokit();

    expect(octokitConstructor).toHaveBeenCalledOnce();
    expect(octokitConstructor.mock.lastCall![0]).toEqual({
      auth: 'auth',
      baseUrl: 'https://api.custombase.com',
    });
  });

  it('derives baseUrl from GITHUB_DOMAIN when set', function () {
    delete process.env.GITHUB_API_URL;
    process.env.GITHUB_DOMAIN = 'custombase.com';
    process.env.GITHUB_AUTH = 'auth';

    createOctokit();

    expect(octokitConstructor).toHaveBeenCalledOnce();
    expect(octokitConstructor.mock.lastCall![0]).toEqual({
      auth: 'auth',
      baseUrl: 'https://api.custombase.com',
    });
  });

  it('GITHUB_API_URL takes precedence over GITHUB_DOMAIN', function () {
    process.env.GITHUB_API_URL = 'https://api.explicit.com';
    process.env.GITHUB_DOMAIN = 'custombase.com';
    process.env.GITHUB_AUTH = 'auth';

    createOctokit();

    expect(octokitConstructor).toHaveBeenCalledOnce();
    expect(octokitConstructor.mock.lastCall![0]).toEqual({
      auth: 'auth',
      baseUrl: 'https://api.explicit.com',
    });
  });

  it('uses undefined baseUrl when neither env var is set', function () {
    delete process.env.GITHUB_API_URL;
    delete process.env.GITHUB_DOMAIN;
    process.env.GITHUB_AUTH = 'auth';

    createOctokit();

    expect(octokitConstructor).toHaveBeenCalledOnce();
    expect(octokitConstructor.mock.lastCall![0]).toEqual({
      auth: 'auth',
      baseUrl: undefined,
    });
  });
});
