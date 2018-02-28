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

  push(...args: any[]): Promise<any>;
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

  push(...args: any[]): Promise<any>;
}

export class WriteStream {
  constructor(options: object, fn?: Function);

  emitError(...args: any[]): void;

  end(chunk: any, encoding: string, cb: Function): void;

  promise(): Promise<any>;

  wait(...args: any[]): void;
}

export function collect(stream: ReadStream|WriteStream|TransformStream): (any[]|Buffer|String|null);

export function filter(opts: object, fn?: Function): any[];

export function map(opts: object, fn?: Function): any[];

export function pipe(...streams: (ReadStream|WriteStream|TransformStream)[]): Promise<any>;

export function read(opts: object, readFn: Function): ReadStream;

export function reduce(opts: object, fn?: Function, initial?: any): any[];

export function transform(opts: object, fn?: Function): TransformStream;

export function wait(stream: any): Promise<ReadStream|WriteStream|TransformStream>;

export function maybeResume(stream: ReadStream|WriteStream|TransformStream): Promise<ReadStream|WriteStream|TransformStream>;

export function write(opts: object, writeFn: Function): WriteStream;
