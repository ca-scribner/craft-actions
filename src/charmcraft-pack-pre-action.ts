// -*- mode: javascript; js-indent-level: 2 -*-

import * as core from '@actions/core'
import * as github from '@actions/github'
import {CharmcraftCacher} from './charmcraft-pack'

async function run(): Promise<void> {
  try {
    const cachePackages =
      core.getInput('cache-packages').toLowerCase() === 'true'

    if (cachePackages) {
      core.info("Restoring charmcraft package cache")
    } else {
      core.info("Charmcraft package caching disabled")
      return
    }

    const localCharmcraftCache = '/tmp/charmcraft-cache'
    const restoreKey = "craft-shared-cache"

    // TODO: Add strategy id here.  Not sure how to get that context in the action.
    const uniqueKey: string = [github.context.runId, github.context.runNumber, github.context.job].join('-')

    const cacher = new CharmcraftCacher({
      path: localCharmcraftCache,
      restoreKey,
      uniqueKey
    })

    cacher.restoreCache()

  } catch (error) {
    core.setFailed((error as Error)?.message)
  }
}

void run()
