import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { makeSemaphore } from "./semaphore";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('semaphore', () => {

    describe('makeSemaphore', () => {
        it('should create semaphore with acquire function', () => {
            const semaphore = makeSemaphore(1);
            expect(semaphore.acquire).to.be.a('function');
        });
    });

    describe('available', () => {
        it('should report number of available locks', async () => {
            const semaphore = makeSemaphore(2);
            expect(semaphore.available()).to.be.equal(2);
            const release1 = await semaphore.acquire();
            expect(semaphore.available()).to.be.equal(1);
            const release2 = await semaphore.acquire();
            expect(semaphore.available()).to.be.equal(0);
            release1();
            expect(semaphore.available()).to.be.equal(1);
            release2();
            expect(semaphore.available()).to.be.equal(2);
        });
    });


    it('should wait for lock to be released to acquire again', async () => {
        const actions: string[] = [];
        const semaphore = makeSemaphore(1);

        const release1 = await semaphore.acquire();
        actions.push('acquire1');

        setTimeout(() => {
            actions.push('release1');
            release1();
        }, 10);

        const release2Promise = semaphore.acquire();
        const release3Promise = semaphore.acquire();

        release2Promise.then(release2 => {
            actions.push("acquire2");
            release2();
            actions.push("release2");

        });
        release3Promise.then(release3 => {
            actions.push("acquire3");
            release3();
            actions.push("release3");
        });


        return Promise.all([
            release2Promise,
            release3Promise,
        ]).then(() => {
            expect(actions).to.eql([
                'acquire1',
                'release1',
                'acquire2',
                'release2',
                'acquire3',
                'release3',
            ]);
        });
    });


});