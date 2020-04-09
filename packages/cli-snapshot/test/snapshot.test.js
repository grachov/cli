import fs from 'fs';
import path from 'path';
import { inspect } from 'util';
import expect from 'expect';
import mockAPI from '@percy/client/test/helper';
import stdio from '@percy/logger/test/helper';
import { createTestServer } from '@percy/core/test/helpers';
import { Snapshot } from '../src/commands/snapshot';

const cwd = process.cwd();

describe('percy snapshot', () => {
  before(() => {
    require('@percy/cli-command/dist/hooks/init').default();
    require('../src/hooks/init').default();

    fs.mkdirSync(path.join(__dirname, 'tmp'));
    process.chdir(path.join(__dirname, 'tmp'));

    fs.mkdirSync('public');
    fs.writeFileSync(path.join('public', 'test-1.html'), '<p>Test 1</p>');
    fs.writeFileSync(path.join('public', 'test-2.html'), '<p>Test 2</p>');
    fs.writeFileSync(path.join('public', 'test-3.htm'), '<p>Test 3</p>');
    fs.writeFileSync(path.join('public', 'test-4.xml'), '<p>Test 4</p>');
    fs.writeFileSync('pages.yml', [
      '- name: YAML Snapshot',
      '  url: http://localhost:8000'
    ].join('\n'));
    fs.writeFileSync('pages.json', JSON.stringify([{
      name: 'JSON Snapshot',
      url: 'http://localhost:8000'
    }]));
    fs.writeFileSync('pages.js', 'module.exports = ' + inspect([{
      url: 'http://localhost:8000',
      snapshots: [{ name: 'JS Snapshot' }]
    }], { depth: null }));
    fs.writeFileSync('pages-fn.js', 'module.exports = () => (' + inspect([{
      url: 'http://localhost:8000',
      snapshots: [{ name: 'JS Function Snapshot' }]
    }], { depth: null }) + ')');
    fs.writeFileSync('nope', 'not here');
  });

  after(() => {
    fs.unlinkSync('nope');
    fs.unlinkSync('pages.js');
    fs.unlinkSync('pages-fn.js');
    fs.unlinkSync('pages.json');
    fs.unlinkSync('pages.yml');
    fs.unlinkSync(path.join('public', 'test-1.html'));
    fs.unlinkSync(path.join('public', 'test-2.html'));
    fs.unlinkSync(path.join('public', 'test-3.htm'));
    fs.unlinkSync(path.join('public', 'test-4.xml'));
    fs.rmdirSync('public');

    process.chdir(cwd);
    fs.rmdirSync(path.join(__dirname, 'tmp'));
  });

  beforeEach(() => {
    process.env.PERCY_TOKEN = '<<PERCY_TOKEN>>';
    mockAPI.start();
  });

  afterEach(() => {
    delete process.env.PERCY_TOKEN;
    delete process.env.PERCY_ENABLE;
    process.removeAllListeners();
  });

  it('skips snapshotting when Percy is disabled', async () => {
    process.env.PERCY_ENABLE = '0';
    await stdio.capture(() => Snapshot.run(['./public']));

    expect(stdio[2]).toHaveLength(0);
    expect(stdio[1]).toEqual([
      '[percy] Percy is disabled. Skipping snapshots\n'
    ]);
  });

  it('errors when the provided path doesn\'t exist', async () => {
    await expect(stdio.capture(() => (
      Snapshot.run(['./404'])
    ))).rejects.toThrow('Not found: ./404');

    expect(stdio[1]).toHaveLength(0);
    expect(stdio[2]).toEqual([
      '[percy] Error: Not found: ./404\n'
    ]);
  });

  it('errors when the base-url is invalid', async () => {
    await expect(stdio.capture(() => (
      Snapshot.run(['./public', '--base-url=wrong'])
    ))).rejects.toThrow('The base-url flag must begin with a forward slash (/)');

    expect(stdio[1]).toHaveLength(0);
    expect(stdio[2]).toEqual([
      '[percy] Error: The base-url flag must begin with a forward slash (/)\n'
    ]);
  });

  it('errors when there are no snapshots to take', async () => {
    await expect(stdio.capture(() => (
      Snapshot.run(['./public', '--files=no-match'])
    ))).rejects.toThrow('No snapshots found');

    expect(stdio[1]).toHaveLength(0);
    expect(stdio[2]).toEqual([
      '[percy] Error: No snapshots found\n'
    ]);
  });

  describe('snapshotting static directories', () => {
    it('starts a static server and snapshots matching files', async () => {
      await stdio.capture(() => Snapshot.run(['./public']));

      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual(expect.arrayContaining([
        '[percy] Percy has started!\n',
        '[percy] Created build #1: https://percy.io/test/test/123\n',
        '[percy] Snapshot taken: /test-3.htm\n',
        '[percy] Snapshot taken: /test-2.html\n',
        '[percy] Snapshot taken: /test-1.html\n',
        '[percy] Stopping percy...\n',
        '[percy] Finalized build #1: https://percy.io/test/test/123\n',
        '[percy] Done!\n'
      ]));
    });

    it('snapshots matching files hosted with a base-url', async () => {
      await stdio.capture(() => Snapshot.run(['./public', '--base-url=/base/']));

      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual(expect.arrayContaining([
        '[percy] Percy has started!\n',
        '[percy] Created build #1: https://percy.io/test/test/123\n',
        '[percy] Snapshot taken: /base/test-3.htm\n',
        '[percy] Snapshot taken: /base/test-2.html\n',
        '[percy] Snapshot taken: /base/test-1.html\n',
        '[percy] Stopping percy...\n',
        '[percy] Finalized build #1: https://percy.io/test/test/123\n',
        '[percy] Done!\n'
      ]));
    });

    it('does not take snapshots and prints a list with --dry-run', async () => {
      await stdio.capture(() => Snapshot.run(['./public', '--dry-run']));
      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual([
        '[percy] Snapshots:\n',
        '/test-1.html\n',
        '/test-2.html\n',
        '/test-3.htm\n'
      ]);
    });
  });

  describe('snapshotting a list of pages', () => {
    let server;

    beforeEach(async () => {
      server = await createTestServer();
      server.app.get('/', (req, res) => {
        res.set('Content-Type', 'text/html').send('<p>Test</p>');
      });
    });

    afterEach(() => {
      server.close();
    });

    it('snapshots pages from .yaml files', async () => {
      await stdio.capture(() => Snapshot.run(['./pages.yml']));

      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual([
        '[percy] Percy has started!\n',
        '[percy] Created build #1: https://percy.io/test/test/123\n',
        '[percy] Snapshot taken: YAML Snapshot\n',
        '[percy] Stopping percy...\n',
        '[percy] Finalized build #1: https://percy.io/test/test/123\n',
        '[percy] Done!\n'
      ]);
    });

    it('snapshots pages from .json files', async () => {
      await stdio.capture(() => Snapshot.run(['./pages.json']));

      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual([
        '[percy] Percy has started!\n',
        '[percy] Created build #1: https://percy.io/test/test/123\n',
        '[percy] Snapshot taken: JSON Snapshot\n',
        '[percy] Stopping percy...\n',
        '[percy] Finalized build #1: https://percy.io/test/test/123\n',
        '[percy] Done!\n'
      ]);
    });

    it('snapshots pages from .js files', async () => {
      await stdio.capture(() => Snapshot.run(['./pages.js']));

      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual([
        '[percy] Percy has started!\n',
        '[percy] Created build #1: https://percy.io/test/test/123\n',
        '[percy] Snapshot taken: JS Snapshot\n',
        '[percy] Stopping percy...\n',
        '[percy] Finalized build #1: https://percy.io/test/test/123\n',
        '[percy] Done!\n'
      ]);
    });

    it('snapshots pages from .js files that export a function', async () => {
      await stdio.capture(() => Snapshot.run(['./pages-fn.js']));

      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual([
        '[percy] Percy has started!\n',
        '[percy] Created build #1: https://percy.io/test/test/123\n',
        '[percy] Snapshot taken: JS Function Snapshot\n',
        '[percy] Stopping percy...\n',
        '[percy] Finalized build #1: https://percy.io/test/test/123\n',
        '[percy] Done!\n'
      ]);
    });

    it('errors with unknown file extensions', async () => {
      await expect(stdio.capture(() => (
        Snapshot.run(['./nope'])
      ))).rejects.toThrow('Unsupported filetype: ./nope');

      expect(stdio[1]).toHaveLength(0);
      expect(stdio[2]).toEqual([
        '[percy] Error: Unsupported filetype: ./nope\n'
      ]);
    });

    it('prints a list with --dry-run', async () => {
      await stdio.capture(() => Snapshot.run(['./pages.js', '--dry-run']));
      expect(stdio[2]).toHaveLength(0);
      expect(stdio[1]).toEqual([
        '[percy] Snapshots:\n',
        'JS Snapshot\n'
      ]);
    });
  });
});
