import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { concat, delay, empty, of, runToArray, throwError, run, recover, fromIterable, mapAsync } from "./pullover";
import { pipe } from "fp-ts/function";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('pullover', () => {
    describe('of', () => {
        it('should create stream with one item', async () => {
            expect(await runToArray(of(666))).to.eql([666]);
        });
    });

    describe('delay', () => {
        it('should emit one item to stream with delay', async () => {
            const result1 = await Promise.race([
                runToArray(empty),
                runToArray(delay(10, 10)),
            ]);

            const result2 = await Promise.race([
                runToArray(delay(10, 10)),
                runToArray(delay(11, 11)),
            ]);

            const result3 = await Promise.race([
                runToArray(delay(9, 9)),
                runToArray(delay(10, 10)),
            ]);

            expect(result1).to.eql([]);
            expect(result2).to.eql([10]);
            expect(result3).to.eql([9]);
        });
    });

    describe('empty', () => {
        it('should create empty stream', async () => {
            expect(await runToArray(empty)).to.eql([]);
        });
    });

    describe('concat', () => {
        it('should concatenate two streams', async () => {
            const stream = pipe(
                of(1),
                concat(of(2)),
            )
            expect(await runToArray(stream)).to.eql([1, 2]);
        });
        it('should return empty stream if concatenating two empty streams', async () => {
            expect(await runToArray(concat(empty)(empty))).to.eql([]);
        });
    });

    describe('throwError', () => {
        it('should create failed stream', async () => {
            const stream = throwError('Some error');
            expect(run(stream)).to.be.rejectedWith('Some error')
        });
    });

    describe('recover', () => {
        it('should recover from failed stream with passed stream', async () => {
            const failedStream = throwError('Some error');
            const streamWithRecovery = pipe(
                failedStream,
                recover(() => of(666))
            );
            expect(await runToArray(streamWithRecovery)).to.eql([666]);
        });
    });

    describe('fromIterable', () => {
        it('should create stream from any iterable', async () => {
            const stream = fromIterable({
                [Symbol.iterator]: function* () {
                    yield 1;
                    yield 2;
                },
            });

            const asyncStream = fromIterable({
                [Symbol.asyncIterator]: async function* () {
                    yield Promise.resolve(3);
                    yield Promise.resolve(4);
                },
            })

            expect(await runToArray(stream)).to.eql([1,2]);
            expect(await runToArray(asyncStream)).to.eql([3,4]);
        });
    });

    describe('mapAsync', () => {
        it('should keep order of items in stream', async () => {
            const stream = pipe(
                fromIterable([0,1,2,3,4,5,6,7,8,9]),
                mapAsync(n =>
                    new Promise(
                    resolve => setTimeout(() => resolve(n * 10), 10 - n)
                    ),
                    5
                )
            );

            expect(await runToArray(stream)).to.eql([0,10,20,30,40,50,60,70,80,90]);
        });
    });
});