#!/usr/bin/env node
// scans images commons for oversized images, and fixes them.

// parameters:
//    data: path to wiki's data folder.

const process = require('node:process')
const path = require('node:path')
const fs = require('node:fs/promises')

const minimist = require('minimist')
const parseArgs = minimist

const sharp = require('sharp')

const getUserHome = () => process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE

const targetWidth = 1920
const targetHeight = 1080

const smallEnough = (width, height) => width <= targetWidth && height <= targetHeight

const opts = {
  alias: {
    d: 'data',
    n: 'dryrun',
  },
  boolean: ['dryrun'],
  default: {
    data: path.join(getUserHome(), '.wiki'),
    dryrun: false,
  },
}

const config = parseArgs(process.argv.slice(2), opts)

if (config.data.startsWith('~')) {
  console.error('use full path rather than one starting with ~')
  process.exit()
}

if (config.dryrun) {
  console.log('DRY RUN: no changes will be applied\n')
}

const commons = path.join(config.data, 'commons')
let modified = 0

fs.readdir(commons, { withFileTypes: true })
  .then(files => {
    return files.filter(dirent => dirent.isFile()).map(dirent => path.join(dirent.parentPath, dirent.name))
  })
  .then(files => {
    return files.map(curr => {
      return new Promise(resolve => {
        let image
        try {
          image = sharp(curr)
        } catch {
          console.log(`Unable to load ${curr.split(path.sep).at(-1)}`)
          return resolve()
        }
        image
          .metadata()
          .then(async meta => {
            if (!smallEnough(meta.width, meta.height) || meta.format != 'jpeg') {
              await image
                .keepExif()
                .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 92, force: true })
                .toBuffer({ resolveWithObject: true })
                .then(async ({ data, info }) => {
                  console.log(
                    `${curr.split(path.sep).at(-1)} ${info.width != meta.width || info.height != meta.height ? `\tfrom ${meta.width}x${meta.height} to ${info.width}x${info.height}` : ''} ${meta.format != 'jpeg' ? `\tfrom ${meta.format} to jpeg` : ''}`,
                  )
                  modified++
                  if (!config.dryrun) {
                    try {
                      await fs.access(curr, fs.constants.W_OK)
                      await fs.writeFile(curr, data)
                      resolve()
                    } catch {
                      console.log(`skipping ${curr.split(path.sep).at(-1)} unable to write.`)
                      resolve()
                    }
                  } else {
                    resolve()
                  }
                })
            } else {
              resolve()
            }
          })
          .catch(err => {
            console.log(`Unable to process ${curr.split(path.sep).at(-1)}`)
            return resolve()
          })
      })
    })
  })
  .then(done => {
    Promise.all(done).then(() => {
      if (modified === 0) {
        console.log('No image files needed fixing')
      } else if (config.dryrun) {
        console.log(`${modified} images need fixing`)
      } else {
        console.log(`${modified} images have been fixed`)
      }
    })
  })
  .catch(error => console.log(`\n${error.message}`))
