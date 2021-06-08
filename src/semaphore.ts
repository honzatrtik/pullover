import EventEmitter = require("events");
// import { constVoid } from "fp-ts/function";

type AcquireFunction = () => Promise<ReleaseFunction>;
type ReleaseFunction = () => void;

export interface Semaphore {
    acquire: AcquireFunction,
    available: () => number,
}

export const makeSemaphore = (max: number): Semaphore => {
    const locks = new Set<Symbol>();
    const eventEmitter = new EventEmitter();

    const makeRelease = (): ReleaseFunction => {
        const lock = Symbol();
        locks.add(lock);
        const keepAliveInterval = setInterval(() => console.log('tick'), 1000);
        const release = () => {
            if (locks.has(lock)) {
                locks.delete(lock);
                clearInterval(keepAliveInterval);
                eventEmitter.emit('released');
            }
        }

        return release;
    }

    const acquire = (): Promise<ReleaseFunction> =>
        locks.size < max
            ? Promise.resolve(makeRelease())
            : new Promise(
                resolve => eventEmitter.once('released', () => resolve(makeRelease()))
            );

    return {
        acquire,
        available: () => max - locks.size,
    };
};

