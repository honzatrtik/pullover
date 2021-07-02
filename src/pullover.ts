import { Lazy, Predicate } from "fp-ts/function";
import { makeSemaphore } from "./semaphore";

export type Stream<A> = Lazy<AsyncGenerator<A, void, unknown>>

export const of = <A>(a: A): Stream<A> => async function* () {
    yield a;
}

export const delay = <A>(a: A, delayInMs: number): Stream<A> => async function* () {
    yield new Promise<A>(resolve => setTimeout(() => resolve(a), delayInMs));
}

export const fromIterable = <A>(iterable: Iterable<A> | AsyncIterable<A>): Stream<A> => async function* () {
    for await (const item of iterable) {
        yield item;
    }
}

export const fromIterator = <A>(iterator: Iterator<A> | AsyncIterator<A>): Stream<A> => async function* () {
    let a = await iterator.next();
    while (!a.done) {
        yield a.value;
        a = await iterator.next();
    }
}

export const throwError = (e: unknown): Stream<never> => async function* () {
    yield Promise.reject(e);
}

export const empty: Stream<never> = async function* () {
}

export const concat = <A>(ga: Stream<A>) => (fa: Stream<A>): Stream<A> => async function* () {
    yield* fa();
    yield* ga();
}

export const append = <A>(after: Lazy<A>) => (fa: Stream<A>): Stream<A> => async function* () {
    yield* fa();
    yield after();
}

export const prepend = <A>(before: Lazy<A>) => (fa: Stream<A>): Stream<A> => async function* () {
    yield before();
    yield* fa();
}

export const intersperse = <A>(item: Lazy<A>) => (fa: Stream<A>): Stream<A> => async function* () {
    const gen = fa();
    const i = item();
    let a = await gen.next();
    let b = await gen.next();
    while (!a.done) {
        yield a.value;
        a = b;
        if (!b.done) {
            yield i;
            b = await gen.next();
        }
    }
}

export const recover = <A>(f: (e: unknown) => Stream<A>) => (fa: Stream<A>): Stream<A> => async function* () {
    try {
        yield* fa();
    } catch (e) {
        yield* f(e)();
    }
}

export const take = (n: number) => <A>(fa: Stream<A>): Stream<A> => async function* () {
    let i = n;
    for await (const item of fa()) {
        if (i-- <= 0) {
            break;
        }
        yield item;
    }
}

export const drop = (n: number) => <A>(fa: Stream<A>): Stream<A> => async function* () {
    let i = n;
    for await (const item of fa()) {
        if (i-- > 0) {
            continue;
        }
        yield item;
    }
}


export const mapAsync = <A, B>(f: (a: A) => Promise<B>, concurrency: number = 1) => (fa: Stream<A>): Stream<B> => {
    const gen = fa();
    const semaphore = makeSemaphore(concurrency);
    const promises: Array<Promise<B>> = [];
    return fromIterable({
        [Symbol.asyncIterator]: () => ({
            next: async () => {

                while (semaphore.available()) {
                    const release = await semaphore.acquire();
                    try {
                        const result = await gen.next();
                        if (result.done) {
                            release();
                            break;
                        }

                        const promise = f(result.value);
                        promises.unshift(promise);
                        promise.then(() => release());
                    } catch (e) {
                        release();
                        throw e;
                    }
                }

                const last = promises.pop();
                return last === undefined
                    ? { done: true, value: undefined } as IteratorReturnResult<void>
                    : { done: false, value: await last } as IteratorYieldResult<B>
            }
        })
    })
}

export const filter = <A>(f: Predicate<A>) => (fa: Stream<A>): Stream<A> => async function* () {
    for await (const item of fa()) {
        if (f(item)) {
            yield item;
        }
    }
}

export const map = <A, B>(f: (a: A) => B) => (fa: Stream<A>): Stream<B> => async function* () {
    for await (const item of fa()) {
        yield f(item);
    }
}

export const chain = <A, B>(f: (a: A) => Stream<B>) => (fa: Stream<A>): Stream<B> => async function* () {
    for await (const item of fa()) {
        yield* f(item)();
    }
}

export const reduce = <A, B>(initial: B, f: (acc: B, a: A) => B) => (fa: Stream<A>): Stream<B> => async function* () {
    let result: B = initial;
    for await (const item of fa()) {
        result = f(result, item);
    }
    yield result;
}

export const tap = <A>(f: (a: A) => void) => (fa: Stream<A>): Stream<A> => async function* () {
    for await (const item of fa()) {
        f(item);
        yield item;
    }
}

export const through = <A, B>(f: (fa: Stream<A>) => Stream<B>) => f

export const zip = <A, B>(fb: Stream<B>) => (fa: Stream<A>): Stream<readonly [A, B]> => async function* () {
    const genA = fa();
    const genB = fb();
    let resultA = await genA.next();
    let resultB = await genB.next();
    while (!resultA.done && !resultB.done) {
        yield [resultA.value, resultB.value];
        resultA = await genA.next();
        resultB = await genB.next();
    }
}


export const run = async <A>(fa: Stream<A>): Promise<void> => {
    const gen = fa();
    while (!(await gen.next()).done) {
    }
}

export const runToArray = async <A>(fa: Stream<A>): Promise<Array<A>> => {
    let array: A[] = []
    for await (const item of fa()) {
        array.push(item);
    }
    return array;
}
