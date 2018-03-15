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

  promise(): Promise<void>;

  push(data: (any|Promise<any>)): Promise<void>;
}

export class ReduceStream {
  constructor(options: StreamOptions, fn?: Function);

  promise(): Promise<void>;
}

export class TransformStream {
  constructor(options: StreamOptions, fn?: Function);

  end(chunk: any, encoding: string, cb: Function): Promise<void>;

  promise(): Promise<void>;

  push(data: (any|Promise<any>)): Promise<void>;
}

export class WriteStream {
  constructor(options: StreamOptions, fn?: Function);

  end(chunk: any, encoding: string, cb: Function): void;

  promise(): Promise<void>;
}

export function collect(stream: ReadStream|WriteStream|TransformStream): (Object[]|Buffer|String|null);

export function filter(opts: StreamOptions, fn?: Function): FilterStream;

export function map(opts: StreamOptions, fn?: Function): TransformStream;

export function pipe(...streams: (ReadStream|WriteStream|TransformStream)[]): Promise<void>;

export function read(opts: StreamOptions, readFn: Function): ReadStream;

export function readAsync(stream: ReadableStream, count: Number): (Object[]|Buffer|String|null);

export function reduce(opts: StreamOptions, fn?: Function, initial?: any): ReduceStream;

export function transform(opts: StreamOptions, fn?: Function): TransformStream;

export function wait(stream: any): Promise<void>;

export function write(opts: StreamOptions, writeFn: Function): WriteStream;
