#!/usr/bin/env Node
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
  },
}

const argv = parseArgs(process.argv.slice(2), opts)

const defaultConfig = {
  data: path.join(getUserHome(), '.wiki'),
}

const config = Object.assign(defaultConfig, argv)

if (config.data.startsWith('~')) {
  console.error('use full path rather than one starting with ~')
  process.exit()
}

const commons = path.join(config.data, 'commons')

fs.readdir(commons, { withFileTypes: true })
  .then(files => {
    return files.filter(dirent => dirent.isFile()).map(dirent => path.join(dirent.parentPath, dirent.name))
  })
  .then(files => {
    files.forEach(curr => {
      try {
        const image = sharp(curr)
        image.metadata().then(async meta => {
          //console.log('meta', { curr, meta })
          if (!smallEnough(meta.width, meta.height) || meta.format != 'jpeg') {
            await image
              .keepExif()
              .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 92, force: true })
              .toBuffer({ resolveWithObject: true })
              .then(({ data, info }) => {
                console.log(
                  `Squeezing ${curr.split(path.sep).at(-1)} \tfrom ${meta.width}x${meta.height} \tto ${info.width}x${info.height}`,
                )
                fs.writeFile(curr, data)
              })
          }
        })
      } catch (error) {
        console.log('Image Problem', curr, error)
      }
    })
  })
  .catch(error => console.log(`\n${error.message}`))
