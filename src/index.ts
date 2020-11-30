/*!
 * Copyright 2019-2020 Lime Technology Inc. All rights reserved.
 * Written by: Alexis Tyler
 */

import { format } from 'util';
import chalk from 'chalk';
import SysLogger from 'ain2';
import getCurrentLine from 'get-current-line';
import getHex from 'number-to-color/hexMap.js';
import { redactSecrets } from 'redact-secrets';

const levels = ['error', 'warn', 'info', 'debug', 'trace', 'silly'] as const;
const transports = ['console', 'syslog'] as const;

interface Options {
    prefix: string;
    syslogTag: string;
    syslogPath: string;
}

export class Logger {
    private prefix = '';
    private timers: { [key: string]: boolean } = {};
    private syslogTag = '';
    private syslogPath = '/dev/log';
    private syslog: typeof SysLogger;

    public level = (process.env.LOG_LEVEL ?? 'info') as typeof levels[number];
    public levels = levels;
    public transport = (process.env.DEBUG ? 'console' : 'syslog') as typeof transports[number];
    public transports = transports;

    private mapping: {
        [key: string]: 'error' | 'warn' | 'info' | 'debug' | 'trace'
    } = {
        error: 'error',
        warn: 'warn',
        info: 'info',
        debug: 'debug',
        trace: 'trace',
        silly: 'debug'
    };

    // Replace secrets with the following
    private redact = redactSecrets('[REDACTED]', {
        keys: [],
        values: []
    });

    private colour(level: typeof levels[number]) {
        return getHex(this.levels.indexOf(level) / this.levels.length);
    }

    private addColourToString(hex: string, string: string) {
        return chalk.hex(hex)(string);
    }

    private _getLineInfo(offset = 0) {
        // Bail unless we're in debug mode and we have line info enabled
        if (!process.env.DEBUG && process.env.LINE_INFO) return;

        const { line: lineNumber, file } = getCurrentLine({
            frames: 3 + offset
        });
        const cwd = process.cwd();
        const filePath = file.startsWith(cwd) ? file.replace(cwd, '.') : file;
        const lineInfo = `${filePath}:${lineNumber}`;
        return `[${chalk.hex('FF4500')(lineInfo)}]`;
    }

    private createSyslogger(tag: string, path: string) {
        const syslog = new SysLogger({
            tag,
            path
        });
        
        syslog.setMessageComposer(function(message: string, severity: number) {
            const severityLevel = {
                0: 'emergency',
                1: 'alert',
                2: 'critical',
                3: 'error',
                4: 'warning',
                5: 'notice',
                6: 'info',
                7: 'debug'
            };
            // @ts-ignore
            return new Buffer.from(`<${this.facility * 8 + severity}>${this.tag} [${severityLevel[severity]}]: ${message}`);
        });

        return syslog;
    }

    constructor(options: Partial<Options> = {}) {
        // Set prefix
        this.prefix = options.prefix ?? this.prefix;

        // Attempt to add syslogger
        try {
            this.syslogTag = options.syslogTag ?? this.syslogTag;
            this.syslogPath = options.syslogPath ?? this.syslogPath;
            this.syslog = this.createSyslogger(this.syslogPath, this.syslogTag);
        } catch {};
            
        // Allow log level to be cycled via SIGUSR2
        process.on('SIGUSR2', () => {
            const index = this.levels.indexOf(this.level);
            // level 0 === Errors
            // level 1 === Warnings
            // level 2 === Info
            // level 3 === Debug
            // level 4 === Trace
            // level 5 === Silly
            // error -> warn -> info -> debug -> trace ->
            if (index === (this.levels.length - 1)) {
                // End of list -> loop
                this.level = this.levels[0];
            } else {
                // Next level
                this.level = this.levels[index + 1];
            }
        
            this._log('debug', 'Log level updated to %s.', [this.level]);
        });

    }

    log(level: typeof levels[number], message: string, args: any[]) {
        // Only enable logging when `this.level >= level`.
        if (this.levels.indexOf(this.level) >= this.levels.indexOf(level)) {
            this._log(level, message, args);
        }
    }
    
    private _log(level: typeof levels[number], message: string, args: any[]) {
        const mappedLevel = this.mapping[level];
        if (this.transport === 'console') {
            console[mappedLevel].call(console, `[${this.addColourToString(this.colour(level), level)}] ${this.prefix}${message}`, ...this.redact.map(args));
        }
        if (this.transport === 'syslog') {
            this.syslog[mappedLevel](format(message, ...args.map(arg => this.redact.map(arg))));
        }
    }

    createChild(options: Partial<Options>) {
        return new Logger({
            ...options,
            prefix: `${this.prefix}${options.prefix}`
        });
    }

    debug(message: string, ...args: any[]): void {
        this.log('debug', message, [...args, this._getLineInfo()]);
    }

    info(message: string, ...args: any[]): void {
        this.log('info', message, args);
    }

    warn(message: string, ...args: any[]): void {
        this.log('warn', message, args);
    }

    error(message: Error): void;
    error(message: string, ...args: any[]): void;
    error(message: any, ...args: any[]): void {
        if (message instanceof Error) {
            this.log('error', message.message, [...args, this._getLineInfo()]);
        } else {
            this.log('error', message, [...args, this._getLineInfo()]);
        }
    }

    trace(message: string, ...args: any[]): void {
        this.log('trace', message, args);
    }

    silly(message: string, ...args: any[]): void {
        this.log('silly', message, args);
    }

    timer(name: string): void {
        if (this.timers[name]) {
            delete this.timers[name];
            console.timeEnd.call(console, name);
        } else {
            this.timers[name] = true;
            console.time.call(console, name);
        }
    }
};