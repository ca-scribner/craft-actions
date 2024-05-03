// -*- mode: javascript; js-indent-level: 2 -*-

import * as core from '@actions/core'
import {CharmcraftBuilder} from './charmcraft-pack'

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

    const builder = new CharmcraftBuilder({
      projectRoot,
      charmcraftChannel,
      charmcraftPackVerbosity,
      charmcraftRevision
    })
    await builder.pack()
    const charm = await builder.outputCharm()
    core.setOutput('charm', charm)
  } catch (error) {
    core.setFailed((error as Error)?.message)
  }
}

void run()
