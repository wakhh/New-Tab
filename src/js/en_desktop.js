// ====== 默认文件夹 ======
export const DEFAULT_FOLDERS_EN = [
  { id: 'f_search',  startRow: 0, startCol: 0,  endRow: 10, endCol: 1,  titleTop: 'Search/Social', titleBottom: '' },
  { id: 'f_media',   startRow: 0, startCol: 2,  endRow: 10, endCol: 3,  titleTop: 'Video/Media',   titleBottom: '' },
  { id: 'f_dev',     startRow: 0, startCol: 4,  endRow: 10, endCol: 5,  titleTop: 'Dev Tools',     titleBottom: '' },
  { id: 'f_browser', startRow: 0, startCol: 24, endRow: 7,  endCol: 24, titleTop: 'Browser',       titleBottom: '' }
]

// ====== 默认图标 ======
export const DEFAULT_ICONS_EN = [
  // ====== Search/Social ======
  { id: 's0', name: 'Google',      fileId: null, iconUrl: 'https://www.google.com/favicon.ico',         url: 'https://www.google.com/search?q=%s',     search: true,  row: 0,  col: 0 },
  { id: 's1', name: 'Bing',        fileId: null, iconUrl: 'https://www.bing.com/favicon.ico',          url: 'https://www.bing.com/search?q=%s',       search: true,  row: 1,  col: 0 },
  { id: 's2', name: 'DuckDuckGo',  fileId: null, iconUrl: 'https://duckduckgo.com/favicon.ico',         url: 'https://duckduckgo.com/?q=%s',           search: true,  row: 2,  col: 0 },
  { id: 's3', name: 'Startpage',   fileId: null, iconUrl: 'https://www.startpage.com/favicon.ico',      url: 'https://www.startpage.com/do/search?q=%s', search: true, row: 3, col: 0 },
  { id: 's4', name: 'Perplexity',  fileId: null, iconUrl: 'https://www.perplexity.ai/favicon.ico',      url: 'https://www.perplexity.ai/?q=%s',        search: true,  row: 4,  col: 0 },
  { id: 's5', name: 'ChatGPT',     fileId: null, iconUrl: 'https://chatgpt.com/favicon.ico',             url: 'https://chatgpt.com/',                   search: false, row: 5,  col: 0 },
  { id: 's6', name: 'Claude',      fileId: null, iconUrl: 'https://claude.ai/favicon.ico',               url: 'https://claude.ai/',                     search: false, row: 6,  col: 0 },
  { id: 's7', name: 'Gemini',      fileId: null, iconUrl: 'https://gemini.google.com/favicon.ico',       url: 'https://gemini.google.com/',             search: false, row: 7,  col: 0 },
  { id: 's8', name: 'Gmail',       fileId: null, iconUrl: 'https://mail.google.com/favicon.ico',         url: 'https://mail.google.com/',               search: false, row: 8,  col: 0 },
  { id: 's9', name: 'Outlook',     fileId: null, iconUrl: 'https://outlook.live.com/favicon.ico',        url: 'https://outlook.live.com/',              search: false, row: 9,  col: 0 },
  { id: 's10', name: 'Reddit',     fileId: null, iconUrl: 'https://www.reddit.com/favicon.ico',          url: 'https://www.reddit.com/',                search: false, row: 10, col: 0 },

  { id: 's11', name: 'Twitter',    fileId: null, iconUrl: 'https://twitter.com/favicon.ico',             url: 'https://twitter.com/',                   search: false, row: 0,  col: 1 },
  { id: 's12', name: 'Mastodon',   fileId: null, iconUrl: 'https://mastodon.social/favicon.ico',         url: 'https://mastodon.social/',               search: false, row: 1,  col: 1 },
  { id: 's13', name: 'LinkedIn',   fileId: null, iconUrl: 'https://www.linkedin.com/favicon.ico',        url: 'https://www.linkedin.com/',              search: false, row: 2,  col: 1 },
  { id: 's14', name: 'Facebook',   fileId: null, iconUrl: 'https://www.facebook.com/favicon.ico',        url: 'https://www.facebook.com/',              search: false, row: 3,  col: 1 },
  { id: 's15', name: 'Amazon',     fileId: null, iconUrl: 'https://www.amazon.com/favicon.ico',          url: 'https://www.amazon.com/s?k=%s',          search: true,  row: 4,  col: 1 },
  { id: 's16', name: 'eBay',       fileId: null, iconUrl: 'https://www.ebay.com/favicon.ico',           url: 'https://www.ebay.com/',                  search: false, row: 5,  col: 1 },
  { id: 's17', name: 'Wikipedia',  fileId: null, iconUrl: 'https://en.wikipedia.org/favicon.ico',        url: 'https://en.wikipedia.org/w/index.php?search=%s', search: true, row: 6, col: 1 },
  { id: 's18', name: 'IMDb',       fileId: null, iconUrl: 'https://www.imdb.com/favicon.ico',           url: 'https://www.imdb.com/',                  search: false, row: 7,  col: 1 },
  { id: 's19', name: 'Medium',     fileId: null, iconUrl: 'https://medium.com/favicon.ico',             url: 'https://medium.com/',                    search: false, row: 8,  col: 1 },

  // ====== Video/Media ======
  { id: 'm0', name: 'YouTube',     fileId: null, iconUrl: 'https://www.youtube.com/favicon.ico',       url: 'https://www.youtube.com/',               search: false, row: 0,  col: 2 },
  { id: 'm1', name: 'Netflix',     fileId: null, iconUrl: 'https://www.netflix.com/favicon.ico',       url: 'https://www.netflix.com/',               search: false, row: 1,  col: 2 },
  { id: 'm2', name: 'Spotify',     fileId: null, iconUrl: 'https://open.spotify.com/favicon.ico',       url: 'https://open.spotify.com/',              search: false, row: 2,  col: 2 },
  { id: 'm3', name: 'Twitch',      fileId: null, iconUrl: 'https://www.twitch.tv/favicon.ico',          url: 'https://www.twitch.tv/',                 search: false, row: 3,  col: 2 },
  { id: 'm4', name: 'Vimeo',       fileId: null, iconUrl: 'https://vimeo.com/favicon.ico',              url: 'https://vimeo.com/',                     search: false, row: 4,  col: 2 },
  { id: 'm5', name: 'SoundCloud',  fileId: null, iconUrl: 'https://soundcloud.com/favicon.ico',        url: 'https://soundcloud.com/',                search: false, row: 5,  col: 2 },
  { id: 'm6', name: 'Apple TV',    fileId: null, iconUrl: 'https://www.apple.com/favicon.ico',         url: 'https://tv.apple.com/',                  search: false, row: 6,  col: 2 },
  { id: 'm7', name: 'Disney+',     fileId: null, iconUrl: 'https://www.disneyplus.com/favicon.ico',    url: 'https://www.disneyplus.com/',            search: false, row: 7,  col: 2 },
  { id: 'm8', name: 'HBO Max',     fileId: null, iconUrl: 'https://www.max.com/favicon.ico',          url: 'https://www.max.com/',                   search: false, row: 8,  col: 2 },
  { id: 'm9', name: 'Plex',        fileId: null, iconUrl: 'https://www.plex.tv/favicon.ico',           url: 'https://www.plex.tv/',                   search: false, row: 9,  col: 2 },
  { id: 'm10', name: 'Bandcamp',   fileId: null, iconUrl: 'https://bandcamp.com/favicon.ico',          url: 'https://bandcamp.com/',                  search: false, row: 10, col: 2 },

  { id: 'm11', name: 'Archive',    fileId: null, iconUrl: 'https://archive.org/favicon.ico',          url: 'https://archive.org/',                   search: false, row: 0,  col: 3 },

  // ====== Dev Tools ======
  { id: 'd0', name: 'MDN',         fileId: null, iconUrl: 'https://developer.mozilla.org/favicon.ico', url: 'https://developer.mozilla.org/',         search: false, row: 0,  col: 4 },
  { id: 'd1', name: 'GitHub',      fileId: null, iconUrl: 'https://github.com/favicon.ico',            url: 'https://github.com/',                    search: false, row: 1,  col: 4 },
  { id: 'd2', name: 'Stack Overflow', fileId: null, iconUrl: 'https://stackoverflow.com/favicon.ico', url: 'https://stackoverflow.com/search?q=%s',  search: true,  row: 2,  col: 4 },
  { id: 'd3', name: 'npm',         fileId: null, iconUrl: 'https://www.npmjs.com/favicon.ico',        url: 'https://www.npmjs.com/',                 search: false, row: 3,  col: 4 },
  { id: 'd4', name: 'Docker',      fileId: null, iconUrl: 'https://hub.docker.com/favicon.ico',       url: 'https://hub.docker.com/',                search: false, row: 4,  col: 4 },
  { id: 'd5', name: 'PyPI',        fileId: null, iconUrl: 'https://pypi.org/favicon.ico',             url: 'https://pypi.org/',                      search: false, row: 5,  col: 4 },
  { id: 'd6', name: 'Crates',      fileId: null, iconUrl: 'https://crates.io/favicon.ico',            url: 'https://crates.io/',                     search: false, row: 6,  col: 4 },
  { id: 'd7', name: 'Fonts',       fileId: null, iconUrl: 'https://fonts.google.com/favicon.ico',     url: 'https://fonts.google.com/',              search: false, row: 7,  col: 4 },
  { id: 'd8', name: 'Can I Use',   fileId: null, iconUrl: 'https://caniuse.com/favicon.ico',          url: 'https://caniuse.com/?search=%s',         search: true,  row: 8,  col: 4 },
  { id: 'd9', name: 'Regex101',    fileId: null, iconUrl: 'https://regex101.com/favicon.ico',         url: 'https://regex101.com/',                  search: false, row: 9,  col: 4 },
  { id: 'd10', name: 'CodePen',    fileId: null, iconUrl: 'https://codepen.io/favicon.ico',           url: 'https://codepen.io/',                    search: false, row: 10, col: 4 },

  { id: 'd11', name: 'JSFiddle',   fileId: null, iconUrl: 'https://jsfiddle.net/favicon.ico',        url: 'https://jsfiddle.net/',                  search: false, row: 0,  col: 5 },

  // ====== Browser 内置 ======
  { id: 'b0', name: 'Settings',    fileId: null, iconUrl: '⚙️', url: 'edge://settings',     search: false, row: 0, col: 24 },
  { id: 'b1', name: 'Extensions',  fileId: null, iconUrl: '🧩', url: 'edge://extensions',   search: false, row: 1, col: 24 },
  { id: 'b2', name: 'New Tab',     fileId: null, iconUrl: '📋', url: 'edge://newtab',        search: false, row: 2, col: 24 },
  { id: 'b3', name: 'Downloads',   fileId: null, iconUrl: '⚓', url: 'edge://downloads',     search: false, row: 3, col: 24 },
  { id: 'b4', name: 'Bookmarks',   fileId: null, iconUrl: '⭐', url: 'edge://bookmarks',     search: false, row: 4, col: 24 },
  { id: 'b5', name: 'History',     fileId: null, iconUrl: '🕒', url: 'edge://history',       search: false, row: 5, col: 24 },
  { id: 'b6', name: 'Apps',        fileId: null, iconUrl: '📦', url: 'edge://apps',          search: false, row: 6, col: 24 },
  { id: 'b7', name: 'Blank',       fileId: null, iconUrl: '📄', url: 'about:blank',          search: false, row: 7, col: 24 }
]