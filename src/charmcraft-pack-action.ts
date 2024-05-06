// -*- mode: javascript; js-indent-level: 2 -*-

import * as core from '@actions/core'
import * as github from '@actions/github'
import {CharmcraftBuilder, CharmcraftCacher} from './charmcraft-pack'

async function run(): Promise<void> {
  try {
    const projectRoot = core.getInput('path')
    core.info(`Building Charm in "${projectRoot}"...`)
    const charmcraftRevision = core.getInput('revision')
    const charmcraftChannel = core.getInput('charmcraft-channel') || 'stable'
    if (charmcraftRevision.length < 1) {
      core.warning(
        `Charmcraft revision not provided. Installing from ${charmcraftChannel}`
      )
    }
    const charmcraftPackVerbosity = core.getInput('verbosity')
    const cachePackages =
      core.getInput('cache-packages').toLowerCase() === 'true'

    const localCharmcraftCache = '/tmp/charmcraft-cache'
    const restoreKey = "craft-shared-cache"
    const uniqueKey: string = [github.context.runId, github.context.runNumber, github.context.job].join('-')
    var cacher = null

    if (cachePackages) {
      cacher = new CharmcraftCacher({
        path: localCharmcraftCache,
        restoreKey,
        uniqueKey
      })
      cacher.restoreCache()
    } else {
      core.info("Charmcraft package caching disabled")
      return
    }

    const builder = new CharmcraftBuilder({
      projectRoot,
      charmcraftCache: localCharmcraftCache,
      charmcraftChannel,
      charmcraftPackVerbosity,
      charmcraftRevision
    })
    await builder.pack()
    
    if (cachePackages) {
      cacher.saveCache()
    }

    const charm = await builder.outputCharm()
    core.setOutput('charm', charm)
  } catch (error) {
    core.setFailed((error as Error)?.message)
  }
}

void run()
