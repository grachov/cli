// Common config options used in Percy commands
export const configSchema = {
  snapshot: {
    type: 'object',
    additionalProperties: false,
    properties: {
      widths: {
        type: 'array',
        default: [375, 1280],
        items: {
          type: 'integer',
          maximum: 2000,
          minimum: 10
        }
      },
      minHeight: {
        type: 'integer',
        default: 1024,
        maximum: 2000,
        minimum: 10
      },
      percyCSS: {
        type: 'string',
        default: ''
      },
      enableJavaScript: {
        type: 'boolean'
      },
      scope: {
        type: 'string'
      }
    }
  },
  discovery: {
    type: 'object',
    additionalProperties: false,
    properties: {
      allowedHostnames: {
        type: 'array',
        default: [],
        items: {
          type: 'string',
          allOf: [{
            not: { pattern: '[^/]/' },
            error: 'must not include a pathname'
          }, {
            not: { pattern: '^([a-zA-Z]+:)?//' },
            error: 'must not include a protocol'
          }]
        }
      },
      disallowedHostnames: {
        type: 'array',
        default: [],
        items: {
          type: 'string',
          allOf: [{
            not: { pattern: '[^/]/' },
            error: 'must not include a pathname'
          }, {
            not: { pattern: '^([a-zA-Z]+:)?//' },
            error: 'must not include a protocol'
          }]
        }
      },
      networkIdleTimeout: {
        type: 'integer',
        default: 100,
        maximum: 750,
        minimum: 1
      },
      disableCache: {
        type: 'boolean'
      },
      requestHeaders: {
        type: 'object',
        normalize: false,
        additionalProperties: { type: 'string' }
      },
      authorization: {
        type: 'object',
        additionalProperties: false,
        properties: {
          username: { type: 'string' },
          password: { type: 'string' }
        }
      },
      cookies: {
        anyOf: [{
          type: 'object',
          normalize: false,
          additionalProperties: { type: 'string' }
        }, {
          type: 'array',
          normalize: false,
          items: {
            type: 'object',
            required: ['name', 'value'],
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          }
        }]
      },
      userAgent: {
        type: 'string'
      },
      concurrency: {
        type: 'integer',
        minimum: 1
      },
      launchOptions: {
        type: 'object',
        additionalProperties: false,
        properties: {
          executable: { type: 'string' },
          timeout: { type: 'integer' },
          args: { type: 'array', items: { type: 'string' } },
          headless: { type: 'boolean' }
        }
      }
    }
  }
};

// Common per-snapshot capture options
export const snapshotSchema = {
  $id: '/snapshot',
  $ref: '#/$defs/snapshot',
  $defs: {
    common: {
      type: 'object',
      properties: {
        widths: { $ref: '/config/snapshot#/properties/widths' },
        scope: { $ref: '/config/snapshot#/properties/scope' },
        minHeight: { $ref: '/config/snapshot#/properties/minHeight' },
        percyCSS: { $ref: '/config/snapshot#/properties/percyCSS' },
        enableJavaScript: { $ref: '/config/snapshot#/properties/enableJavaScript' },
        discovery: {
          type: 'object',
          additionalProperties: false,
          properties: {
            allowedHostnames: { $ref: '/config/discovery#/properties/allowedHostnames' },
            disallowedHostnames: { $ref: '/config/discovery#/properties/disallowedHostnames' },
            requestHeaders: { $ref: '/config/discovery#/properties/requestHeaders' },
            authorization: { $ref: '/config/discovery#/properties/authorization' },
            disableCache: { $ref: '/config/discovery#/properties/disableCache' },
            userAgent: { $ref: '/config/discovery#/properties/userAgent' }
          }
        }
      }
    },
    exec: {
      error: 'must be a function, function body, or array of functions',
      oneOf: [
        { oneOf: [{ type: 'string' }, { instanceof: 'Function' }] },
        { type: 'array', items: { $ref: '/snapshot#/$defs/exec/oneOf/0' } }
      ]
    },
    precapture: {
      type: 'object',
      properties: {
        waitForSelector: { type: 'string' },
        waitForTimeout: { type: 'integer', minimum: 1, maximum: 30000 }
      }
    },
    capture: {
      type: 'object',
      allOf: [
        { $ref: '/snapshot#/$defs/common' },
        { $ref: '/snapshot#/$defs/precapture' }
      ],
      properties: {
        name: { type: 'string' },
        execute: {
          oneOf: [{ $ref: '/snapshot#/$defs/exec' }, {
            type: 'object',
            additionalProperties: false,
            properties: {
              afterNavigation: { $ref: '/snapshot#/$defs/exec' },
              beforeResize: { $ref: '/snapshot#/$defs/exec' },
              afterResize: { $ref: '/snapshot#/$defs/exec' },
              beforeSnapshot: { $ref: '/snapshot#/$defs/exec' }
            }
          }]
        },
        additionalSnapshots: {
          type: 'array',
          items: {
            type: 'object',
            $ref: '/snapshot#/$defs/precapture',
            unevaluatedProperties: false,
            oneOf: [{
              required: ['name']
            }, {
              anyOf: [
                { required: ['prefix'] },
                { required: ['suffix'] }
              ]
            }],
            properties: {
              name: { type: 'string' },
              prefix: { type: 'string' },
              suffix: { type: 'string' },
              execute: { $ref: '/snapshot#/$defs/exec' }
            },
            errors: {
              oneOf: ({ params }) => params.passingSchemas
                ? 'prefix & suffix are ignored when a name is provided'
                : 'missing required name, prefix, or suffix'
            }
          }
        }
      }
    },
    predicate: {
      error: 'must be a pattern or an array of patterns',
      oneOf: [{
        oneOf: [
          { type: 'string' },
          { instanceof: 'RegExp' },
          { instanceof: 'Function' }
        ]
      }, {
        type: 'array',
        items: { $ref: '/snapshot#/$defs/predicate/oneOf/0' }
      }]
    },
    filter: {
      type: 'object',
      properties: {
        include: { $ref: '/snapshot#/$defs/predicate' },
        exclude: { $ref: '/snapshot#/$defs/predicate' }
      }
    },
    options: {
      oneOf: [{
        type: 'object',
        unevaluatedProperties: false,
        allOf: [
          { $ref: '/snapshot#/$defs/filter' },
          { $ref: '/snapshot#/$defs/capture' }
        ]
      }, {
        type: 'array',
        items: { $ref: '/snapshot#/$defs/options/oneOf/0' }
      }]
    },
    snapshot: {
      type: 'object',
      required: ['url'],
      $ref: '/snapshot#/$defs/capture',
      unevaluatedProperties: false,
      properties: {
        url: { type: 'string' }
      }
    },
    snapshots: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: '/snapshot#/$defs/snapshot' },
          { $ref: '/snapshot#/$defs/snapshot/properties/url' }
        ]
      }
    },
    dom: {
      type: 'object',
      $id: '/snapshot/dom',
      $ref: '/snapshot#/$defs/common',
      required: ['url', 'domSnapshot'],
      unevaluatedProperties: false,
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
        domSnapshot: { type: 'string' }
      },
      errors: {
        unevaluatedProperties: e => (
          snapshotSchema.$defs.precapture.properties[e.params.unevaluatedProperty] ||
          snapshotSchema.$defs.capture.properties[e.params.unevaluatedProperty]
        ) ? 'not accepted with DOM snapshots' : 'unknown property'
      }
    },
    list: {
      type: 'object',
      $id: '/snapshot/list',
      $ref: '/snapshot#/$defs/filter',
      unevaluatedProperties: false,
      required: ['snapshots'],
      properties: {
        baseUrl: {
          type: 'string',
          pattern: '^https?://',
          errors: { pattern: 'must include a protocol and hostname' }
        },
        snapshots: { $ref: '/snapshot#/$defs/snapshots' },
        options: { $ref: '/snapshot#/$defs/options' }
      }
    },
    server: {
      type: 'object',
      $id: '/snapshot/server',
      $ref: '/snapshot#/$defs/filter',
      unevaluatedProperties: false,
      required: ['serve'],
      properties: {
        serve: { type: 'string' },
        port: { type: 'integer' },
        baseUrl: {
          type: 'string',
          pattern: '^/',
          errors: { pattern: 'must start with a forward slash (/)' }
        },
        cleanUrls: {
          type: 'boolean'
        },
        rewrites: {
          type: 'object',
          normalize: false,
          additionalProperties: { type: 'string' }
        },
        snapshots: { $ref: '/snapshot#/$defs/snapshots' },
        options: { $ref: '/snapshot#/$defs/options' }
      }
    },
    sitemap: {
      type: 'object',
      $id: '/snapshot/sitemap',
      $ref: '/snapshot#/$defs/filter',
      required: ['sitemap'],
      unevaluatedProperties: false,
      properties: {
        sitemap: { type: 'string' },
        options: { $ref: '/snapshot#/$defs/options' }
      }
    }
  }
};

// Grouped schemas for easier registration
export const schemas = [
  configSchema,
  snapshotSchema
];

// Config migrate function
export function configMigration(config, util) {
  /* eslint-disable curly */
  if (config.version < 2) {
    // discovery options have moved
    util.map('agent.assetDiscovery.allowedHostnames', 'discovery.allowedHostnames');
    util.map('agent.assetDiscovery.networkIdleTimeout', 'discovery.networkIdleTimeout');
    util.map('agent.assetDiscovery.cacheResponses', 'discovery.disableCache', v => !v);
    util.map('agent.assetDiscovery.requestHeaders', 'discovery.requestHeaders');
    util.map('agent.assetDiscovery.pagePoolSizeMax', 'discovery.concurrency');
    util.del('agent');
  } else {
    let notice = { type: 'config', until: '1.0.0' };
    // snapshot discovery options have moved
    util.deprecate('snapshot.authorization', { map: 'discovery.authorization', ...notice });
    util.deprecate('snapshot.requestHeaders', { map: 'discovery.requestHeaders', ...notice });
  }
}

// Snapshot option migrate function
export function snapshotMigration(config, util, root = '') {
  let notice = { type: 'snapshot', until: '1.0.0', warn: true };
  // discovery options have moved
  util.deprecate(`${root}.authorization`, { map: `${root}.discovery.authorization`, ...notice });
  util.deprecate(`${root}.requestHeaders`, { map: `${root}.discovery.requestHeaders`, ...notice });
  // snapshots option was renamed
  util.deprecate(`${root}.snapshots`, { map: `${root}.additionalSnapshots`, ...notice });
}

// Snapshot list options migrate function
export function snapshotListMigration(config, util) {
  if (config.snapshots) {
    // migrate each snapshot options
    for (let i in config.snapshots) {
      if (typeof config.snapshots[i] !== 'string') {
        snapshotMigration(config, util, `snapshots[${i}]`);
      }
    }
  }

  // overrides option was renamed
  let notice = { type: 'snapshot', until: '1.0.0', warn: true };
  util.deprecate('overrides', { map: 'options', ...notice });

  // migrate options
  if (Array.isArray(config.options)) {
    for (let i in config.options) {
      snapshotMigration(config, util, `options[${i}]`);
    }
  } else {
    snapshotMigration(config, util, 'options');
  }
}

// Grouped migrations for easier registration
export const migrations = {
  '/config': configMigration,
  '/snapshot': snapshotMigration,
  '/snapshot/dom': snapshotMigration,
  '/snapshot/list': snapshotListMigration,
  '/snapshot/server': snapshotListMigration,
  '/snapshot/sitemap': snapshotListMigration
};
