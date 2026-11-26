import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)
// jsdom does not implement top-layer focus and dismissal. Those use the native browser dialog.
if (!HTMLDialogElement.prototype.showModal)
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
if (!HTMLDialogElement.prototype.close)
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
