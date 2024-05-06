// -*- mode: javascript; js-indent-level: 2 -*-

import * as core from '@actions/core'
import {CharmcraftBuilder} from './charmcraft-pack'

async function run(): Promise<void> {
  try {
    const projectRoot = core.getInput('path')
    core.info(`Building Charm in "${projectRoot}"...`)
    const charmcraftRevision = core.getInput('revision')
    const charmcraftChannel = core.getInput('charmcraft-channel') || 'stable'
    const cachePackages =
      core.getInput('cache-packages').toLowerCase() === 'true'
    if (charmcraftRevision.length < 1) {
      core.warning(
        `Charmcraft revision not provided. Installing from ${charmcraftChannel}`
      )
    }
    const charmcraftPackVerbosity = core.getInput('verbosity')

    const builder = new CharmcraftBuilder({
      projectRoot,
      // TODO: Remove cachePackages from builder
      cachePackages,
      charmcraftChannel,
      charmcraftPackVerbosity,
      charmcraftRevision
    })

    if (cachePackages) {
      await builder.restoreCache()
    }
    await builder.pack()
    if (cachePackages) {
      await builder.saveCache()
    }    
    
    const charm = await builder.outputCharm()
    core.setOutput('charm', charm)
  } catch (error) {
    core.setFailed((error as Error)?.message)
  }
}

void run()
