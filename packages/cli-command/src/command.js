import logger from '@percy/logger';
import PercyConfig from '@percy/config';
import { set, del } from '@percy/config/utils';
import { generatePromise, AbortController, AbortError } from '@percy/core/utils';
import * as CoreConfig from '@percy/core/config';
import * as builtInFlags from './flags.js';
import formatHelp from './help.js';
import parse from './parse.js';

// Copies a command definition and adds built-in flags and config options.
function withBuiltIns(definition) {
  let def = { ...definition };
  def.flags = [...(def.flags ?? [])];

  // ensure built-ins aren't already overridden
  let addDedupedFlag = flag => {
    if (!def.flags.find(f => f.name === flag.name)) {
      let short = def.flags.find(f => f.short === flag.short);
      def.flags.push(short ? del({ ...flag }, 'short') : flag);
    }
  };

  // add percy specific built-in flags
  if (def.percy && def.percy !== true) {
    builtInFlags.PERCY.forEach(addDedupedFlag);

    // maybe include percy discovery flags
    if (def.percy.discoveryFlags !== false) {
      builtInFlags.DISCOVERY.forEach(addDedupedFlag);
    }
  }

  // always add global built-in flags
  builtInFlags.GLOBAL.forEach(addDedupedFlag);

  // copy any existing config before adding to it
  def.config = { ...def.config };
  def.config.schemas = [...(def.config.schemas ?? [])];
  def.config.migrations = [...(def.config.migrations ?? [])];

  // add percy specific built-in config options
  if (def.percy) {
    def.config.schemas.unshift(CoreConfig.schemas);
    def.config.migrations.unshift(CoreConfig.migrations);
  }

  return def;
}

// Helper to throw an error with an exit code and optional reason message
function exit(exitCode, reason = '') {
  let err = reason instanceof Error ? reason : new Error(reason);
  throw Object.assign(err, { exitCode });
}

// Runs the parsed command callback with a contextual argument consisting of specific parsed input
// and other common command helpers and properties.
async function runCommandWithContext(parsed) {
  let { command, flags, args, argv, log } = parsed;
  // include flags, args, argv, logger, exit helper, and env info
  let context = { flags, args, argv, log, exit };
  let env = context.env = process.env;
  let pkg = command.packageInformation;
  let def = command.definition;

  // automatically include a preconfigured percy instance
  if (def.percy) {
    let { Percy } = await import('@percy/core');

    // set defaults and prune preconfiguraton options
    let conf = del({ server: false, ...def.percy }, 'discoveryFlags');
    if (pkg) conf.clientInfo ||= `${pkg.name}/${pkg.version}`;
    conf.environmentInfo ||= `node/${process.version}`;

    Object.defineProperty(context, 'percy', {
      configurable: true,

      get() {
        // percy is disabled, do not return an instance
        if (env.PERCY_ENABLE === '0') return;

        // redefine the context property once configured
        Object.defineProperty(context, 'percy', {
          // map and merge percy arguments with config options
          value: new Percy([...parsed.operators.entries()]
            .reduce((conf, [opt, value]) => opt.percyrc ? (
              set(conf, opt.percyrc, value)) : conf, conf))
        });

        return context.percy;
      }
    });
  }

  // process signals will abort
  let ctrl = new AbortController();
  let signals = ['SIGUSR1', 'SIGUSR2', 'SIGTERM', 'SIGINT', 'SIGHUP'].map(signal => {
    let handler = () => ctrl.abort(new AbortError(signal, { signal, exitCode: 0 }));
    handler.off = () => process.off(signal, handler);
    process.on(signal, handler);
    return handler;
  });

  // run the command callback with context and cleanup handlers after
  await generatePromise(command.callback(context), ctrl.signal, error => {
    for (let handler of signals) handler.off();
    if (error) throw error;
  });
}

// Returns a command runner function that when run will parse provided command-line options and run
// the parsed command callback. The returned runner will automatically output version and help
// information when requested, and handle any thrown errors exiting when appropriate.
export function command(name, definition, callback) {
  definition = withBuiltIns(definition);

  // auto register config schemas and migrations
  PercyConfig.addSchema(definition.config.schemas);
  PercyConfig.addMigration(definition.config.migrations);

  async function runner(argv = []) {
    // reset loglevel for testing
    logger.loglevel('info');
    let log = logger('cli');

    try {
      // parse input
      let parsed = await parse(runner, argv);

      if (parsed.version) {
        // version requested
        log.stdout.write(parsed.command.definition.version + '\n');
      } else if (parsed.help || !parsed.command.callback) {
        // command help requested
        log.stdout.write(await formatHelp(parsed.command) + '\n');
      } else {
        // run command callback
        await runCommandWithContext(parsed);
      }
    } catch (err) {
      // auto log unhandled error messages
      if (err.message && !err.signal) {
        if (err.exitCode === 0) log.warn(err.message);
        else log.error(err);
      }

      // exit when appropriate
      if (err.exitCode !== 0) {
        err.exitCode ??= 1;
        err.message ||= `EEXIT: ${err.exitCode}`;

        if (definition.exitOnError) {
          process.exit(err.exitCode);
        }

        // re-throw when not exiting
        throw err;
      }
    }
  }

  // define command meta information
  Object.defineProperties(runner, {
    name: { enumerable: true, value: name },
    definition: { enumerable: true, value: definition },
    callback: { enumerable: true, value: callback }
  });

  return runner;
}

export default command;
