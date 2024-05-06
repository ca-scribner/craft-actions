// -*- mode: javascript; js-indent-level: 2 -*-

import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import * as tools from './tools'

const allowedVerbosity = ['quiet', 'brief', 'verbose', 'debug', 'trace']
const charmcraftCacheRestoreKey = 'craft-shared-cache'

interface CharmcraftBuilderOptions {
  projectRoot: string
  charmcraftCache: string
  charmcraftChannel: string
  charmcraftPackVerbosity: string
  charmcraftRevision: string
}

export class CharmcraftBuilder {
  projectRoot: string
  charmcraftCache: string
  charmcraftChannel: string
  charmcraftPackVerbosity: string
  charmcraftRevision: string

  constructor(options: CharmcraftBuilderOptions) {
    this.projectRoot = tools.expandHome(options.projectRoot)
    this.charmcraftChannel = options.charmcraftChannel
    this.charmcraftRevision = options.charmcraftRevision
    this.charmcraftCache = options.charmcraftCache
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
    await tools.ensureSnapd()
    await tools.ensureLXD()
    await tools.ensureCharmcraft(
      this.charmcraftChannel,
      this.charmcraftRevision
    )
    core.endGroup()

    core.startGroup('Packing the charm')
    let charmcraft = 'charmcraft pack'
    let charmcraftPackArgs = ''
    if (this.charmcraftPackVerbosity) {
      charmcraftPackArgs = `${charmcraftPackArgs} --verbosity ${this.charmcraftPackVerbosity}`
    }

    charmcraft = `${charmcraft} ${charmcraftPackArgs.trim()}`
    // DEBUG: Confirm this actually writes where I expect
    await exec.exec('sg', ['lxd', '-c', charmcraft], {
      cwd: this.projectRoot,
      env: { ...process.env, CRAFT_SHARED_CACHE: this.charmcraftCache }
    })
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

interface CharmcraftCacherOptions {
  path: string
  restoreKey: string
  uniqueKey: string
}

export class CharmcraftCacher {
  path: string
  restoreKey: string
  uniqueKey: string

  constructor(options: CharmcraftCacherOptions) {
    this.path = options.path
    this.restoreKey = options.restoreKey
    this.uniqueKey = options.uniqueKey
  }

  async restoreCache(): Promise<void> {
    core.info('DEBUG: restoreCache is alive!')
    core.startGroup('Restoring Charmcraft package cache')
    const cachePaths: string[] = [this.path]
    const restoreKeys: string[] = [this.restoreKey]
    const primaryKey: string = [this.restoreKey, this.uniqueKey].join('-')

    const cacheKey = await cache.restoreCache(
      cachePaths,
      primaryKey,
      restoreKeys
    )

    if (cacheKey) {
      core.info(`Cache restored successfully - found item with cacheKey ${cacheKey}`)
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

  async saveCache(): Promise<void> {
    core.info('DEBUG: saveCache is alive!')
    core.startGroup('Saving Charmcraft package cache')
    const cachePaths: string[] = [this.path]

    const cacheKey = await cache.saveCache(
      cachePaths,
      this.primaryKey(),
    )

    if (cacheKey) {
      core.info(`Saved to cacheKey: ${cacheKey}`)
    } else {
      // throw new Error(
      //     `Failed to restore cache entry. Exiting as fail-on-cache-miss is set. Input key: ${primaryKey}`
      // );
      core.info(
        `Could not save to primaryKey: ${this.primaryKey()}`
      )      
    }
    core.endGroup()
  }

  primaryKey(): string {
    const primaryKey: string = [this.restoreKey, this.uniqueKey].join('-')
    return primaryKey
  }

}

