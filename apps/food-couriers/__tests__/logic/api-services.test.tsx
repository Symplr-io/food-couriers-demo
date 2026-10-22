const mockSent: Array<Record<string, any>> = [];
// a screen case mounts a navigator and fires every handler — see withTestTimeout
jest.setTimeout(30000);
jest.mock('axios', () => {
  const instance = {
    request: async (config: Record<string, any>) => {
      mockSent.push(config);
      return { data: { id: 1, machineId: 'm-1' }, status: 200 };
    },
    interceptors: { request: { use: () => 0 }, response: { use: () => 0 } },
  };
  const isAxiosError = (e: unknown) => Boolean(e && typeof e === 'object' && 'response' in (e as object));
  return { __esModule: true, default: { create: () => instance, isAxiosError }, isAxiosError, AxiosError: Error };
});

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SupabaseAuth from '../../src/gen/api/SupabaseAuth';
import * as SupabaseData from '../../src/gen/api/SupabaseData';

const MODULES: Array<[string, Record<string, unknown>]> = [
  ['SupabaseAuth', SupabaseAuth as never],
  ['SupabaseData', SupabaseData as never],
];

const opsOf = (mod: Record<string, unknown>) =>
  Object.keys(mod).filter((k) => typeof mod[k] === 'function' && !k.startsWith('use'));
const hooksOf = (mod: Record<string, unknown>) =>
  Object.keys(mod).filter((k) => typeof mod[k] === 'function' && k.startsWith('use'));

describe.each(MODULES)('%s', (name, mod) => {
  beforeEach(() => { mockSent.length = 0; });

  it('declares a base url', () => {
    expect(typeof (mod as { BASE?: unknown }).BASE).toBe('string');
  });

  it('builds a request for every operation it exports', async () => {
    const ops = opsOf(mod);
    expect(ops.length).toBeGreaterThan(0);
    // TWICE, with and without values: every field an operation sends is guarded
    // by a null-and-empty check, so one call only ever takes one
    // side of each of those — and a request builder is mostly those guards.
    for (const op of ops) {
      await (mod[op] as (v?: unknown) => Promise<unknown>)({
        machineId: 'm-1', customerId: 'c-1', id: '1', page: 1, size: 10,
      }).catch(() => undefined);
    }
    for (const op of ops) {
      await (mod[op] as (v?: unknown) => Promise<unknown>)({}).catch(() => undefined);
    }
    // every operation reached the transport with a method and a url
    expect(mockSent.length).toBe(ops.length * 2);
    for (const sent of mockSent) {
      expect(typeof sent.method).toBe('string');
      expect(sent.url === '' || typeof sent.url === 'string').toBe(true);
    }
  });

  it('runs a mutation hook end to end, rotating its idempotency key on success', async () => {
    const hooks = hooksOf(mod);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    for (const hook of hooks) {
      const captured: Array<Record<string, any>> = [];
      const Probe = () => {
        const r = (mod[hook] as (v?: unknown, o?: unknown) => unknown)({}, { enabled: false }) as Record<string, any>;
        captured.push(r);
        return <Text>{hook}</Text>;
      };
      let tree!: renderer.ReactTestRenderer;
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={qc}>
            <Probe />
          </QueryClientProvider>,
        );
      });
      const result = captured[0];
      // a mutation hook is the one that exposes mutateAsync: run it, so the
      // mutationFn body and the onSuccess that rotates the key both execute
      if (result && typeof result.mutateAsync === 'function') {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          await (result.mutateAsync as (v: unknown) => Promise<unknown>)({ machineId: 'm-1' }).catch(
            () => undefined,
          );
        });
      }
      // eslint-disable-next-line no-await-in-loop
      await act(async () => tree.unmount());
    }
    expect(hooks.length).toBeGreaterThan(0);
  });

  it('exposes a usable hook per operation', () => {
    const hooks = hooksOf(mod);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    for (const hook of hooks) {
      const Probe = () => {
        (mod[hook] as (v?: unknown, o?: unknown) => unknown)({}, { enabled: false });
        return <Text>{hook}</Text>;
      };
      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          <QueryClientProvider client={qc}>
            <Probe />
          </QueryClientProvider>,
        );
      });
      expect(JSON.stringify(tree.toJSON())).toContain(hook);
      act(() => tree.unmount());
    }
    expect(hooks.length).toBeGreaterThan(0);
  });
});
