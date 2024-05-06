// -*- mode: javascript; js-indent-level: 2 -*-

import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import * as tools from './tools'

const allowedVerbosity = ['quiet', 'brief', 'verbose', 'debug', 'trace']
const localCharmcraftCache = '/tmp/charmcraft-cache'
const charmcraftCacheRestoreKey = 'craft-shared-cache'

interface CharmcraftBuilderOptions {
  projectRoot: string
  cachePackages: boolean
  charmcraftChannel: string
  charmcraftPackVerbosity: string
  charmcraftRevision: string
}

export class CharmcraftBuilder {
  projectRoot: string
  cachePackages: boolean
  charmcraftChannel: string
  charmcraftPackVerbosity: string
  charmcraftRevision: string

  constructor(options: CharmcraftBuilderOptions) {
    this.projectRoot = tools.expandHome(options.projectRoot)
    this.charmcraftChannel = options.charmcraftChannel
    this.charmcraftRevision = options.charmcraftRevision
    this.cachePackages = options.cachePackages
    if (allowedVerbosity.includes(options.charmcraftPackVerbosity)) {
      this.charmcraftPackVerbosity = options.charmcraftPackVerbosity
    } else {
      throw new Error(
        'Invalid verbosity "${options.charmcraftPackVerbosity}".' +
          'Allowed values are ${allowedVerbosity.join(", ")}.'
      )
    }
  }

  async pack(): Promise<void> {
    core.startGroup('Installing Charmcraft plus dependencies')
    if (this.cachePackages) {
      await this.restoreCache()
    }
    await tools.ensureSnapd()
    await tools.ensureLXD()
    await tools.ensureCharmcraft(
      this.charmcraftChannel,
      this.charmcraftRevision
    )
    core.endGroup()

    let charmcraft = 'charmcraft pack'
    let charmcraftPackArgs = ''
    if (this.charmcraftPackVerbosity) {
      charmcraftPackArgs = `${charmcraftPackArgs} --verbosity ${this.charmcraftPackVerbosity}`
    }

    charmcraft = `${charmcraft} ${charmcraftPackArgs.trim()}`
    await exec.exec('sg', ['lxd', '-c', charmcraft], {
      cwd: this.projectRoot
    })
  }

  async restoreCache(): Promise<void> {
    core.info('DEBUG: restoreCache is alive!')
    core.startGroup('Restoring Charmcraft package cache')
    const cachePaths: string[] = [localCharmcraftCache]
    const restoreKeys: string[] = [charmcraftCacheRestoreKey]

    // TODO: Add strategy id here.  Not sure how to get that context in the action.
    const primaryKey: string = [charmcraftCacheRestoreKey, github.context.runId, github.context.runNumber, github.context.job].join('-')

    const cacheKey = await cache.restoreCache(
      cachePaths,
      primaryKey,
      restoreKeys
    )

    if (cacheKey) {
      core.info(`Got hit on cacheKey: ${cacheKey}`)
    } else {
      // throw new Error(
      //     `Failed to restore cache entry. Exiting as fail-on-cache-miss is set. Input key: ${primaryKey}`
      // );
      core.info(
        `Cache not found for input keys: ${[primaryKey, ...restoreKeys].join(
          ', '
        )}`
      )      
    }
    core.endGroup()
  }

  // This wrapper is for the benefit of the tests, due to the crazy
  // typing of fs.promises.readdir()
  async #readdir(dir: string): Promise<string[]> {
    return await fs.promises.readdir(dir)
  }

  async outputCharm(): Promise<string> {
    const files = await this.#readdir(this.projectRoot)
    const charms = files.filter(name => name.endsWith('.charm'))

    if (charms.length === 0) {
      throw new Error('No .charm files produced by build')
    }
    if (charms.length > 1) {
      core.warning(`Multiple Charms found in ${this.projectRoot}`)
    }
    return path.join(this.projectRoot, charms[0])
  }
}
