import fs from 'fs';
import logger from '@percy/logger';
import Server from './server';
import pkg from '../package.json';

export function createPercyServer(percy, port) {
  return new Server({ port })
  // facilitate logger websocket connections
    .websocket(ws => logger.connect(ws))
  // general middleware
    .route((req, res, next) => {
      // treat all request bodies as json
      if (req.body) try { req.body = JSON.parse(req.body); } catch {}

      // add version header
      res.setHeader('Access-Control-Expose-Headers', '*, X-Percy-Core-Version');
      res.setHeader('X-Percy-Core-Version', pkg.version);

      // return json errors
      return next().catch(e => res.json(e.status ?? 500, {
        error: e.message,
        success: false
      }));
    })
  // healthcheck returns basic information
    .route('get', '/percy/healthcheck', (req, res) => res.json(200, {
      loglevel: percy.loglevel(),
      config: percy.config,
      build: percy.build,
      success: true
    }))
  // get or set config options
    .route(['get', 'post'], '/percy/config', async (req, res) => res.json(200, {
      config: req.body ? await percy.setConfig(req.body) : percy.config,
      success: true
    }))
  // responds once idle (may take a long time)
    .route('get', '/percy/idle', async (req, res) => res.json(200, {
      success: await percy.idle().then(() => true)
    }))
  // convenient @percy/dom bundle
    .route('get', '/percy/dom.js', (req, res) => {
      return res.file(200, require.resolve('@percy/dom'));
    })
  // legacy agent wrapper for @percy/dom
    .route('get', '/percy-agent.js', async (req, res) => {
      logger('core:server').deprecated([
        'It looks like you’re using @percy/cli with an older SDK.',
        'Please upgrade to the latest version to fix this warning.',
        'See these docs for more info: https:docs.percy.io/docs/migrating-to-percy-cli'
      ].join(' '));

      let content = await fs.promises.readFile(require.resolve('@percy/dom'), 'utf-8');
      let wrapper = '(window.PercyAgent = class { snapshot(n, o) { return PercyDOM.serialize(o); } });';
      return res.send(200, 'applicaton/javascript', content.concat(wrapper));
    })
  // post one or more snapshots
    .route('post', '/percy/snapshot', async (req, res) => {
      let snapshot = percy.snapshot(req.body);
      if (!req.url.searchParams.has('async')) await snapshot;
      return res.json(200, { success: true });
    })
  // stops percy at the end of the current event loop
    .route('/percy/stop', (req, res) => {
      setImmediate(() => percy.stop());
      return res.json(200, { success: true });
    });
}