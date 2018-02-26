interface DeferReturn {
  resolve: Function,
  reject: Function,
  promise: Promise<any>
}

export class FilterStream {
  constructor(options: object, fn?: Function);
}

export class ReadStream {
  constructor(options: object, fn?: Function);

  emitError(...args: any[]): void;

  promise(): Promise<any>;

  push(...args: any[]): void;

  static ReadableState(options: any, stream: any): void;
}

export class ReduceStream {
  constructor(options: object, fn?: Function);

  promise(): Promise<any>;
}

export class TransformStream {
  constructor(options: object, fn?: Function);

  emitError(e: Error): void;

  end(chunk: any, encoding: string, cb: Function): void;

  promise(): Promise<any>;

  push(...args: any[]): void;
}

export class WriteStream {
  constructor(options: object, fn?: Function);

  emitError(...args: any[]): void;

  end(chunk: any, encoding: string, cb: Function): void;

  promise(): Promise<any>;

  wait(...args: any[]): void;
}

export function collect(stream: ReadStream|WriteStream|TransformStream): any[];

export function filter(opts: object, fn?: Function): void;

export function map(opts: object, fn?: Function): void;

export function pipe(...streams: (ReadStream|WriteStream|TransformStream)[]): any;

export function read(opts: object, readFn: Function): void;

export function reduce(opts: object, fn?: Function, initial?: any): void;

export function transform(opts: object, fn?: Function): void;

export function wait(stream: any): Promise<ReadStream|WriteStream|TransformStream>;

export function maybeResume(stream: ReadStream|WriteStream|TransformStream): Promise<ReadStream|WriteStream|TransformStream>;

export function defer(): DeferReturn;

export function write(opts: object, writeFn: Function): void;
