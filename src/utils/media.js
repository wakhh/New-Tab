export function shuffleArray(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function itemId(item) {
  if (!item) return null
  return item.url || localUrl(item)
}

export function localUrl(item) {
  return item.path1 + '/' + (item.path2 ? encodeURIComponent(item.path2) + '/' : '') + encodeURIComponent(item.filename)
}

export function mediaUrl(item) {
  return item.url || localUrl(item)
}

export function sourceOf(it) {
  if (!it) return null
  return { src: it.url ? 'network' : 'local', type: it.type }
}

export function sourceEquals(a, b) {
  return !!a && !!b && a.src === b.src && a.type === b.type
}

export function findItemById(k, sourceFiles, src, type) {
  if (!k || !src || !type) return null
  return sourceFiles[src]?.[type]?.value.find((f) => itemId(f) === k) || null
}

export function buildList(sourceFiles, src, type, folderVal, sortByVal, sortDirVal) {
  let list = sourceFiles[src][type].value
  if (folderVal !== 'all') {
    if (src === 'local')
      list = list.filter((f) => (f.path2 ? f.path1 + '/' + f.path2 : f.path1) === folderVal)
    else
      list = list.filter((f) => f.site === folderVal)
  }
  const key = sortByVal === 'name'
    ? (src === 'local' ? 'filename' : 'pathname')
    : (src === 'local' ? 'mtime' : 'ctime')
  const nameKey = src === 'local' ? 'filename' : 'pathname'
  const dir = sortDirVal === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const av = a[key], bv = b[key]
    let r
    if (typeof av === 'number' && typeof bv === 'number') r = (av - bv) * dir
    else r = String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true }) * dir
    if (r !== 0) return r
    return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), undefined, { numeric: true })
  })
}