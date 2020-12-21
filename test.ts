import { Logger } from './src';

const basic = () => {
    const log = new Logger();

    log.levels.forEach((level, index) => {
        log[level]('Level: %s', index);
    });
};

const basicWithPrefix = () => {
    const logger = new Logger({
        prefix: '@unraid'
    });
    const log = logger.createChild({
        prefix: 'core'
    });
    
    log.levels.forEach((level, index) => {
        log[level]('Level: %s', index);
    });
};

const multipleChildLoggers = () => {
    const logger = new Logger({
        prefix: '@unraid'
    });
    const log = logger.createChild({
        prefix: 'core'
    });
    const log2 = logger.createChild({
        prefix: 'test'
    });
    
    log.levels.forEach((level, index) => {
        log[level]('Level: %s', index);
        log2[level]('Level: %s', index);
    });
};

const runTests = (tests: Function[]) => {
    tests.forEach(test => {
        console.log('Title: %s', test.name);
        test();
        console.log('\n\n');
    });
};

runTests([
    basic,
    basicWithPrefix,
    multipleChildLoggers
]);
