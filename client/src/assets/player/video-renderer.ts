// Thanks: https://github.com/feross/render-media
// TODO: use render-media once https://github.com/feross/render-media/issues/32 is fixed

import * as MediaElementWrapper from 'mediasource'
import { extname } from 'path'
import * as videostream from 'videostream'

const VIDEOSTREAM_EXTS = [
  '.m4a',
  '.m4v',
  '.mp4'
]

type RenderMediaOptions = {
  controls: boolean
  autoplay: boolean
}

function renderVideo (
  file,
  elem: HTMLVideoElement,
  opts: RenderMediaOptions,
  callback: (err: Error, renderer: any) => void
) {
  validateFile(file)

  return renderMedia(file, elem, opts, callback)
}

function renderMedia (file, elem: HTMLVideoElement, opts: RenderMediaOptions, callback: (err: Error, renderer?: any) => void) {
  const extension = extname(file.name).toLowerCase()
  let preparedElem = undefined
  let currentTime = 0
  let renderer

  try {
    if (VIDEOSTREAM_EXTS.indexOf(extension) >= 0) {
      renderer = useVideostream()
    } else {
      renderer = useMediaSource()
    }
  } catch (err) {
    return callback(err)
  }

  function useVideostream () {
    prepareElem()
    preparedElem.addEventListener('error', function onError () {
      preparedElem.removeEventListener('error', onError)

      return fallbackToMediaSource()
    })
    preparedElem.addEventListener('loadstart', onLoadStart)
    return videostream(file, preparedElem)
  }

  function useMediaSource (useVP9 = false) {
    const codecs = getCodec(file.name, useVP9)

    prepareElem()
    preparedElem.addEventListener('error', function onError(err) {
      // Try with vp9 before returning an error
      if (codecs.indexOf('vp8') !== -1) {
        preparedElem.removeEventListener('error', onError)

        return fallbackToMediaSource(true)
      }

      return callback(err)
    })
    preparedElem.addEventListener('loadstart', onLoadStart)

    const wrapper = new MediaElementWrapper(preparedElem)
    const writable = wrapper.createWriteStream(codecs)
    file.createReadStream().pipe(writable)

    if (currentTime) preparedElem.currentTime = currentTime

    return wrapper
  }

  function fallbackToMediaSource (useVP9 = false) {
    if (useVP9 === true) console.log('Falling back to media source with VP9 enabled.')
    else console.log('Falling back to media source..')

    useMediaSource(useVP9)
  }

  function prepareElem () {
    if (preparedElem === undefined) {
      preparedElem = elem

      preparedElem.addEventListener('progress', function () {
        currentTime = elem.currentTime
      })
    }
  }

  function onLoadStart () {
    preparedElem.removeEventListener('loadstart', onLoadStart)
    if (opts.autoplay) preparedElem.play()

    callback(null, renderer)
  }
}

function validateFile (file) {
  if (file == null) {
    throw new Error('file cannot be null or undefined')
  }
  if (typeof file.name !== 'string') {
    throw new Error('missing or invalid file.name property')
  }
  if (typeof file.createReadStream !== 'function') {
    throw new Error('missing or invalid file.createReadStream property')
  }
}

function getCodec (name: string, useVP9 = false) {
  const ext = extname(name).toLowerCase()
  if (ext === '.mp4') {
    return 'video/mp4; codecs="avc1.640029, mp4a.40.5"'
  }

  if (ext === '.webm') {
    if (useVP9 === true) return 'video/webm; codecs="vp9, opus"'

    return 'video/webm; codecs="vp8, vorbis"'
  }

  return undefined
}

export {
  renderVideo
}
