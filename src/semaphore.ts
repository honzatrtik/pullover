import { constVoid } from "fp-ts/function";

type ReleaseFunction = () => void;

export interface Semaphore {
    acquire: () => Promise<ReleaseFunction>,
    available: () => number,
}

export const makeSemaphore = (max: number): Semaphore => {
    const locks = new Set<Symbol>();
    const waitingToAcquire: Array<() => void> = [];

    const makeRelease = (): ReleaseFunction => {
        const lock = Symbol();
        locks.add(lock);
        const keepAliveInterval = setInterval(constVoid, 1000);
        const release = () => {
            if (locks.has(lock)) {
                locks.delete(lock);
                clearInterval(keepAliveInterval);
                const resolve = waitingToAcquire.pop();
                if (resolve) {
                    resolve();
                }
            }
        }

        return release;
    }

    const acquire = (): Promise<ReleaseFunction> =>
        locks.size < max
            ? Promise.resolve(makeRelease())
            : new Promise(resolve => {
                waitingToAcquire.unshift(() => resolve(makeRelease()))
            });

    return {
        acquire,
        available: () => max - locks.size,
    };
};

