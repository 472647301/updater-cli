#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { cosmiconfig } from 'cosmiconfig'
import packageConfig from '../package.json' with { type: 'json' }
import { existsSync, readFileSync, unlinkSync, createReadStream } from 'fs'
import { PlatformType, type Options, type VersionEntity } from './typing.js'
import { adminLogin, createVersion, fetchCacheData, to } from './utils.js'
import { input } from '@inquirer/prompts'
import { homedir, platform } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import FormData from 'form-data'
import fetch from 'node-fetch'
import AdmZip from 'adm-zip'

export { PlatformType, type Options, type VersionEntity } from './typing.js'

const program = new Command()
const explorer = cosmiconfig('updater-cli')

const tagName = `${packageConfig.name}:`
const __dirname = dirname(fileURLToPath(import.meta.url))

const setCacheData = async (baseUrl: string, cachePath: string) => {
  const username = await input({ message: 'Enter username' })
  if (!username) process.exit()
  const password = await input({ message: 'Enter password' })
  if (!password) process.exit()
  console.log(chalk.green(tagName, `get login credentials`))
  const [err] = await to(adminLogin(baseUrl, username, password, cachePath))
  if (err) {
    console.log(chalk.red(tagName, err))
  } else {
    console.log(chalk.green(tagName, 'login successful'))
  }
  process.exit()
}

const uploadZipFile = async (
  token: string,
  config: Options,
  filePath: string,
  cachePath: string
) => {
  console.log(chalk.green(tagName, `start upload files`))
  if (!existsSync(filePath)) {
    console.log(chalk.red(tagName, `missing ${filePath}`))
    process.exit()
  }
  const form = new FormData()
  if (config.desc) form.append('desc', config.desc)
  if (config.name) form.append('name', config.name)
  if (config.version) form.append('ver', config.version)
  if (config.channel) form.append('channel', config.channel)
  if (typeof config.isMandatory === 'number') {
    form.append('isMandatory', `${config.isMandatory}`)
  }
  form.append('platform', config.platform.join(','))
  form.append('file', createReadStream(filePath))
  const response = await fetch(`${config.baseUrl}/version/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form
  })
  const data = (await response.json()) as {
    code: number
    message?: string
    data: VersionEntity
  }
  unlinkSync(filePath)
  if (!data) {
    console.log(chalk.red(tagName, 'file upload failed'))
    process.exit()
  }
  if (data.code) {
    console.log(chalk.red(tagName, 'file upload failed'))
    console.log(chalk.red(tagName, data.message))
    if (data.code === 401) {
      unlinkSync(cachePath)
    }
    process.exit()
  } else {
    console.log(chalk.green(tagName, JSON.stringify(data)))
    if (config.success) config.success(data.data)
  }
}

const updateVersion = async (
  token: string,
  config: Options,
  cachePath: string
) => {
  if (config.downloadUrl) {
    console.log(chalk.green(tagName, `start add version`))
    const data = await createVersion(token, config)
    if (!data) {
      console.log(chalk.red(tagName, 'add version failed'))
      process.exit()
    }
    if (data.code) {
      console.log(chalk.red(tagName, 'add version failed'))
      console.log(chalk.red(tagName, data.message))
      if (data.code === 401) {
        unlinkSync(cachePath)
      }
      process.exit()
    } else {
      console.log(chalk.green(tagName, JSON.stringify(data)))
      if (config.success) config.success(data.data)
    }
    process.exit()
  }
  const iOS = config.platform.includes(PlatformType.iOS)
  const zipName = iOS ? 'main.jsbundle.zip' : 'index.android.bundle.zip'
  const isMobile = iOS || config.platform.includes(PlatformType.Android)
  if (isMobile) {
    await uploadZipFile(
      token,
      config,
      join(process.cwd(), `output/${zipName}`),
      cachePath
    )
  } else {
    let outPath = 'dist/win-unpacked/resources/app.asar'
    if (platform() !== 'win32') {
      if (!config.productName) {
        console.log(chalk.red(tagName, 'missing parameters productName'))
        process.exit()
      }
      outPath = `dist/mac-arm64/${config.productName}.app/Contents/Resources/app.asar`
    }
    console.log(chalk.green(tagName, `start compressing files`))
    const zipPath = join(__dirname, '../app.zip')
    const zip = new AdmZip()
    zip.addLocalFile(outPath)
    const bool = await zip.writeZipPromise(zipPath)
    if (!bool) {
      console.log(chalk.red(tagName, 'compression failed'))
      process.exit()
    }
    uploadZipFile(token, config, zipPath, cachePath)
  }
}

const updateAction = async (name: string) => {
  console.log(chalk.green(tagName, `${name} start uploading`))
  console.log(chalk.green(tagName, `reading configuration`))
  const [err, res] = await to(
    explorer.load(join(process.cwd(), 'updater-cli.config.ts'))
  )
  if (err || !res) {
    console.log(chalk.red(tagName, err?.message || 'no updater-cli.ts file'))
    process.exit()
  }
  console.log(chalk.green(tagName, `configuration read successfully`))
  const config = res.config as Options
  config.name = name || config.name
  if (!config.name) {
    console.log(chalk.red(tagName, 'missing parameters name'))
    process.exit()
  }
  if (!config.baseUrl) {
    console.log(chalk.red(tagName, 'missing parameters baseUrl'))
    process.exit()
  }
  if (!config.version) {
    console.log(chalk.red(tagName, 'missing parameters version'))
    process.exit()
  }
  if (!config.platform.length) {
    console.log(chalk.red(tagName, 'missing parameters platform'))
    process.exit()
  }
  const cachePath = join(
    homedir(),
    `.${config.baseUrl.replace(/[^a-zA-Z]/g, '')}`
  )
  if (!existsSync(cachePath)) {
    await setCacheData(config.baseUrl, cachePath)
    return
  }
  const cacheContent = readFileSync(cachePath).toString()
  const cacheData = fetchCacheData(cacheContent)
  if (!cacheData.token) {
    await setCacheData(config.baseUrl, cachePath)
  } else {
    await updateVersion(cacheData.token, config, cachePath)
  }
}

program.version(packageConfig.version).description(packageConfig.description)

program.command('update <name>').action(updateAction)

program.parse(process.argv)

export const defineConfig = (options: Options) => {
  return options
}
