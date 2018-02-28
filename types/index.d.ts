export interface DeferReturn {
  resolve: Function,
  reject: Function,
  promise: Promise<any>
}

export interface StreamOptions {
  concurrent?: 1,
  objectMode?: true,
  [others: string]: any
}

export class FilterStream {
  constructor(options: StreamOptions, fn?: Function);
}

export class ReadStream {
  constructor(options: StreamOptions, fn?: Function);

  promise(): Promise<any>;

  push(...args: any[]): Promise<any>;
}

export class ReduceStream {
  constructor(options: StreamOptions, fn?: Function);

  promise(): Promise<any>;
}

export class TransformStream {
  constructor(options: StreamOptions, fn?: Function);

  end(chunk: any, encoding: string, cb: Function): void;

  promise(): Promise<any>;

  push(...args: any[]): Promise<any>;
}

export class WriteStream {
  constructor(options: StreamOptions, fn?: Function);

  end(chunk: any, encoding: string, cb: Function): void;

  promise(): Promise<any>;

  wait(...args: any[]): void;
}

export function collect(stream: ReadStream|WriteStream|TransformStream): (any[]|Buffer|String|null);

export function filter(opts: StreamOptions, fn?: Function): FilterStream;

export function map(opts: StreamOptions, fn?: Function): TransformStream;

export function pipe(...streams: (ReadStream|WriteStream|TransformStream)[]): Promise<void>;

export function read(opts: StreamOptions, readFn: Function): ReadStream;

export function reduce(opts: StreamOptions, fn?: Function, initial?: any): ReduceStream;

export function transform(opts: StreamOptions, fn?: Function): TransformStream;

export function wait(stream: any): Promise<ReadStream|WriteStream|TransformStream>;

export function write(opts: StreamOptions, writeFn: Function): WriteStream;
