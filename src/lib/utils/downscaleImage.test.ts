import { describe, it, expect } from 'vitest'
import { fitWithin } from './downscaleImage'

describe('fitWithin', () => {
  it('leaves a small image alone', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('scales a landscape photo by its long edge', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it('scales a portrait photo by its long edge', () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('rounds to whole pixels', () => {
    expect(fitWithin(1000, 333, 500)).toEqual({ width: 500, height: 167 })
  })

  it('pins a square photo at the max edge unchanged', () => {
    expect(fitWithin(1000, 1000, 1600)).toEqual({ width: 1000, height: 1000 })
  })
})
