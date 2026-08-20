import { EventEmitter } from "node:events";

export interface RuntimeTransportCallbacks {
  onFrame(payload: Uint8Array): void;
  onClose(error: Error): void;
}

export interface RuntimeTransportLike {
  readonly epoch: Uint8Array;
  readonly sessionId: bigint;
  readonly closed: boolean;
  send(payload: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface ConnectionSnapshot {
  readonly generation: number;
  readonly epoch: Buffer;
  readonly sessionId: bigint;
}

export class RuntimeHandle<T extends object = Record<string, unknown>> {
  readonly identifier: Readonly<T>;
  readonly generation: number;
  request(correlation: unknown, payload: Uint8Array): Promise<unknown>;
}

export class ConnectionOwner extends EventEmitter {
  constructor(factory: (callbacks: RuntimeTransportCallbacks) => Promise<RuntimeTransportLike>);
  readonly connected: boolean;
  readonly generation: number | null;
  snapshot(): ConnectionSnapshot | null;
  connect(): Promise<ConnectionSnapshot>;
  restart(): Promise<ConnectionSnapshot>;
  close(): Promise<void>;
  createViewHandle<T extends object>(identifier: T): RuntimeHandle<T>;
  request(correlation: unknown, payload: Uint8Array): Promise<unknown>;
  completeRequest(correlation: unknown, value: unknown, generation?: number): boolean;
  failRequest(correlation: unknown, error: Error, generation?: number): boolean;
}

export class RuntimeTransport implements RuntimeTransportLike {
  static connect(
    runtimePath: string,
    callbacks?: Partial<RuntimeTransportCallbacks> & { timeoutMs?: number },
  ): Promise<RuntimeTransport>;
  readonly epoch: Buffer;
  readonly sessionId: bigint;
  readonly closed: boolean;
  send(payload: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export function createRuntimeTransportFactory(
  runtimePath: string,
  options?: { timeoutMs?: number },
): (callbacks: RuntimeTransportCallbacks) => Promise<RuntimeTransport>;

export class VitrumConnectionError extends Error { readonly code: string }
export class HandshakeError extends VitrumConnectionError {}
export class AuthenticationError extends VitrumConnectionError {}
export class ProtocolMismatchError extends VitrumConnectionError {}
export class ConnectionClosedError extends VitrumConnectionError {}
export class RuntimeRestartedError extends VitrumConnectionError {}
export class StaleHandleError extends VitrumConnectionError {}
export class DuplicateRequestError extends VitrumConnectionError {}
