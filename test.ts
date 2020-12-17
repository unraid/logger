import { Logger } from './src';

const log = new Logger();

console.info('====================================');
console.info(`Current transport: ${log.transport}`);
console.info(`Current level: ${log.level}`);
console.info('====================================');

log.levels.forEach((level, index) => {
    log[level]('Level: %s', index);
});