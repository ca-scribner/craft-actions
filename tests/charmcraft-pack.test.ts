// -*- mode: javascript; js-indent-level: 2 -*-

import * as os from 'os'
import * as path from 'path'
import * as cache from '@actions/cache'
import * as exec from '@actions/exec'
import * as build from '../src/charmcraft-pack'
import * as tools from '../src/tools'
import * as fs from 'fs'

afterEach(() => {
  jest.restoreAllMocks()
})

test('CharmcraftBuilder expands tilde in project root', () => {
  let builder = new build.CharmcraftBuilder({
    projectRoot: '~',
    cachePackages: false,
    charmcraftChannel: 'edge',
    charmcraftPackVerbosity: 'trace',
    charmcraftRevision: '1'
  })
  expect(builder.projectRoot).toBe(os.homedir())

  builder = new build.CharmcraftBuilder({
    projectRoot: '~/foo/bar',
    cachePackages: false,
    charmcraftChannel: 'stable',
    charmcraftPackVerbosity: 'trace',
    charmcraftRevision: '1'
  })
  expect(builder.projectRoot).toBe(path.join(os.homedir(), 'foo/bar'))
})

test('CharmcraftBuilder.pack runs a Charm build', async () => {
  expect.assertions(4)

  const ensureSnapd = jest
    .spyOn(tools, 'ensureSnapd')
    .mockImplementation(async (): Promise<void> => {})
  const ensureLXD = jest
    .spyOn(tools, 'ensureLXD')
    .mockImplementation(async (): Promise<void> => {})
  const ensureCharmcraft = jest
    .spyOn(tools, 'ensureCharmcraft')
    .mockImplementation(async (channel): Promise<void> => {})
  const execMock = jest
    .spyOn(exec, 'exec')
    .mockImplementation(
      async (program: string, args?: string[]): Promise<number> => {
        return 0
      }
    )

  const projectDir = 'project-root'
  const builder = new build.CharmcraftBuilder({
    projectRoot: projectDir,
    cachePackages: false,
    charmcraftChannel: 'stable',
    charmcraftPackVerbosity: 'debug',
    charmcraftRevision: '1'
  })
  await builder.pack()

  expect(ensureSnapd).toHaveBeenCalled()
  expect(ensureLXD).toHaveBeenCalled()
  expect(ensureCharmcraft).toHaveBeenCalled()
  expect(execMock).toHaveBeenCalledWith(
    'sg',
    ['lxd', '-c', 'charmcraft pack --verbosity debug'],
    {
      cwd: projectDir,
      env: expect.objectContaining({CRAFT_SHARED_CACHE: '/tmp/charmcraft-cache' })
    }
  )
})

test('CharmcraftBuilder.build can set the Charmcraft channel', async () => {
  expect.assertions(1)

  const ensureSnapd = jest
    .spyOn(tools, 'ensureSnapd')
    .mockImplementation(async (): Promise<void> => {})
  const ensureLXD = jest
    .spyOn(tools, 'ensureLXD')
    .mockImplementation(async (): Promise<void> => {})
  const ensureCharmcraft = jest
    .spyOn(tools, 'ensureCharmcraft')
    .mockImplementation(async (channel): Promise<void> => {})
  const execMock = jest
    .spyOn(exec, 'exec')
    .mockImplementation(
      async (program: string, args?: string[]): Promise<number> => {
        return 0
      }
    )

  const builder = new build.CharmcraftBuilder({
    projectRoot: '.',
    cachePackages: false,
    charmcraftChannel: 'test-channel',
    charmcraftPackVerbosity: 'trace',
    charmcraftRevision: ''
  })
  await builder.pack()

  expect(ensureCharmcraft).toHaveBeenCalledWith('test-channel', '')
})

test('CharmcraftBuilder.build can set the Charmcraft revision', async () => {
  expect.assertions(1)

  const ensureSnapd = jest
    .spyOn(tools, 'ensureSnapd')
    .mockImplementation(async (): Promise<void> => {})
  const ensureLXD = jest
    .spyOn(tools, 'ensureLXD')
    .mockImplementation(async (): Promise<void> => {})
  const ensureCharmcraft = jest
    .spyOn(tools, 'ensureCharmcraft')
    .mockImplementation(async (channel): Promise<void> => {})
  const execMock = jest
    .spyOn(exec, 'exec')
    .mockImplementation(
      async (program: string, args?: string[]): Promise<number> => {
        return 0
      }
    )

  const builder = new build.CharmcraftBuilder({
    projectRoot: '.',
    cachePackages: false,
    charmcraftChannel: 'channel',
    charmcraftPackVerbosity: 'trace',
    charmcraftRevision: '123'
  })
  await builder.pack()

  expect(ensureCharmcraft).toHaveBeenCalledWith('channel', '123')
})

test('CharmcraftBuilder.build can pass known verbosity', async () => {
  expect.assertions(2)

  const ensureSnapd = jest
    .spyOn(tools, 'ensureSnapd')
    .mockImplementation(async (): Promise<void> => {})
  const ensureLXD = jest
    .spyOn(tools, 'ensureLXD')
    .mockImplementation(async (): Promise<void> => {})
  const ensureCharmcraft = jest
    .spyOn(tools, 'ensureCharmcraft')
    .mockImplementation(async (channel): Promise<void> => {})
  const execMock = jest
    .spyOn(exec, 'exec')
    .mockImplementation(
      async (program: string, args?: string[]): Promise<number> => {
        return 0
      }
    )

  const builder = new build.CharmcraftBuilder({
    projectRoot: '.',
    cachePackages: false,
    charmcraftChannel: 'stable',
    charmcraftPackVerbosity: 'trace',
    charmcraftRevision: '1'
  })
  await builder.pack()

  expect(execMock).toHaveBeenCalledWith(
    'sg',
    ['lxd', '-c', 'charmcraft pack --verbosity trace'],
    expect.anything()
  )

  const badBuilder = () => {
    new build.CharmcraftBuilder({
      projectRoot: '.',
      cachePackages: false,
      charmcraftChannel: 'stable',
      charmcraftPackVerbosity: 'fake-verbosity',
      charmcraftRevision: '1'
    })
  }
  expect(badBuilder).toThrow()
})

test('CharmcraftBuilder.outputCharm fails if there are no Charms', async () => {
  expect.assertions(2)

  const projectDir = 'project-root'
  const builder = new build.CharmcraftBuilder({
    projectRoot: projectDir,
    cachePackages: false,
    charmcraftChannel: 'stable',
    charmcraftPackVerbosity: 'trace',
    charmcraftRevision: '1'
  })

  const readdir = jest
    .spyOn(fs.promises, 'readdir')
    .mockResolvedValue(['not-a-charm' as unknown as fs.Dirent])

  await expect(builder.outputCharm()).rejects.toThrow(
    'No .charm files produced by build'
  )
  expect(readdir).toHaveBeenCalled()
})

test('CharmcraftBuilder.outputCharm returns the first Charm', async () => {
  expect.assertions(2)

  const projectDir = 'project-root'
  const builder = new build.CharmcraftBuilder({
    projectRoot: projectDir,
    cachePackages: false,
    charmcraftChannel: 'stable',
    charmcraftPackVerbosity: 'trace',
    charmcraftRevision: '1'
  })

  const readdir = jest
    .spyOn(fs.promises, 'readdir')
    .mockResolvedValue(['one.charm', 'two.charm'] as unknown as fs.Dirent[])

  await expect(builder.outputCharm()).resolves.toEqual('project-root/one.charm')
  expect(readdir).toHaveBeenCalled()
})

test('CharmcraftBuilder.restoreCache() restores the package cache', async () => {
  expect.assertions(1)

  const restoreCache = jest
    .spyOn(cache, 'restoreCache')
    .mockImplementation(async (): Promise<string | undefined> => {
      return '0'
    })

    const builder = new build.CharmcraftBuilder({
      projectRoot: "~",
      cachePackages: true,
      charmcraftChannel: 'stable',
      charmcraftPackVerbosity: 'trace',
      charmcraftRevision: '1'
    })

    builder.restoreCache()

  expect(restoreCache).toHaveBeenCalled()

})