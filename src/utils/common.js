export function throttle(fn, delay = 100) {
  let last = 0
  let timer = null
  return function (...args) {
    const now = Date.now()
    const remaining = delay - (now - last)
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      last = now
      fn.apply(this, args)
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null
        last = Date.now()
        fn.apply(this, args)
      }, remaining)
    }
  }
}