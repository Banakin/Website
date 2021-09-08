/* global Vue, axios */
/* eslint no-multi-str: 0 */

const _MOD_NOT_FOUND_MESSAGE = 'Found no thumbnail for this mod'
const _NO_LINK = undefined
const _NO_ICON = '/image/icon/compliance_mods.png'
const _NO_ATTACHMENTS = -1

Vue.component('minecraft-mod', {
  props: {
    mod: Object
  },
  template:
    '<li class="mod-bar" :class="{ \'selected-mod\': mod.selected }">\
      <label :for="repoName" class="mod-label">Select this mod</label>\
      <div :style="imageStyle" class="mod-bar-item mod-img">\
        <div class="mod-img-overlay"></div>\
      </div>\
      <div class="mod-bar-item">\
        <input :id="repoName" type="checkbox" v-model="mod.selected" class="mod-checkbox">\
        <span v-html="title"></span>\
        <br>\
        <div :class="{ \'mt-1\': true, modNotChosen: !mod.selected }" class="mod-radio-group">\
          <template v-for="(version, vindex) in minecraftVersions":key="modIds[vindex]">\
            <input :disabled="!mod.selected" type="radio" :id="modIds[vindex]" :name="modIds[vindex]"  v-model="mod.versionSelected" :value="version" class="mod-radio">\
            <label :for="modIds[vindex]" class="mod-radio">{{ version }}</label>\
          </template>\
        </div>\
      </div>\
    </li>',
  data() {
    return {
      searchPages: 3,
      imageSource: _NO_ICON,
      link: _NO_LINK
    }
  },
  methods: {
    modId: function (repoName, version) {
      return String(repoName + '-' + version.replace(/\./g, ''))
    },
    search (index, searchFilter, _fullName = false) {
      if(searchFilter === undefined) return Promise.reject(new Error('searchFilter is undefined'))

      return new Promise((resolve, reject) => {
        const size = index * 25
        const api_url = `https://addons-ecs.forgesvc.net/api/v2/addon/search?gameId=432&pageSize=${size}&sectionId=6&searchFilter=${searchFilter}`
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent(api_url)}`
        // get allows us to have better control over the content returned and the status code
        // here we sometimes have an 400 status code

        axios(url)
          .then(res => {
            if(res.status !== 200 || res.data.status.http_code !== 200) { // verify request if it went well
              reject(new Error(`Could not load url: ${ api_url }`))
              return
            }

            // parse content
            const json = JSON.parse(res.data.contents)

            const result = json.find(mod => {
              let found = false
              if (this.curseName !== _NO_LINK) {
                found = mod.websiteUrl.split('/').pop() === this.curseName
              }

              return found || mod.name.toLowerCase() === this.displayName.toLowerCase()
            })

            if (result) {
              resolve(result)
            } else {
              reject(result)
            }
          })
          .catch(err => {
            reject(new Error(err))
          })
      })
    },
    makeSearch: function (index = 1, fullName = false) {
      return new Promise((resolve, reject) => {
        const searchFilter = fullName ? this.displayName : this.curseName
        this.search(index, searchFilter)
          .then(results => {
            resolve(results)
          }).catch(err => {
            if (isNaN(err)) {
              if (index < this.searchPages) {
                this.makeSearch(index + 1, fullName).then(res => {
                  resolve(res)
                }).catch(err => {
                  reject(err)
                })
              } else {
                if (!fullName) {
                  this.makeSearch(1, true).then(res => {
                    resolve(res)
                  }).catch(err => {
                    reject(err)
                  })
                } else {
                  // no mod was found
                  reject(new Error(_MOD_NOT_FOUND_MESSAGE))
                }
              }
            } else {
              // Axios error
              reject(new Error(err))
            }
          })
      })
    },
    updateThumbnail: function () {
      const result = this.$parent.searchCache(this.displayName)

      if (result) {
        this.imageSource = result.imageSource
        this.link = result.link
        return
      }

      this.makeSearch().then(result => {
        const attachments = result.attachments

        // set icon with default attachment
        let index = _NO_ATTACHMENTS
        if (attachments.length > 0) {
          index = Math.max(0, attachments.findIndex(att => att.isDefault))
          this.imageSource = attachments[index].thumbnailUrl
        }

        // set link
        this.link = result.websiteUrl

        // add image to cache
        this.$parent.thumbnailCache.push({
          modName: this.displayName,
          imageSource: this.imageSource,
          link: this.link
        })
      }).catch(err => {
        if (err.message !== _MOD_NOT_FOUND_MESSAGE) {
          console.error(err)
          console.error(this.curseName || this.displayName)
        } else {
          this.$parent.thumbnailCache.push({
            modName: this.dispatch,
            imageSource: this.imageSource,
            link: _NO_LINK
          })
        }
      })
    }
  },
  computed: {
    aliases: function () {
      return '<span class="advice">' + this.$props.mod.name.aliases.join(', ') + '</span>'
    },
    curseName: function () {
      return this.$props.mod.curse || _NO_LINK
    },
    info: function () {
      const link = 'https://www.curseforge.com/minecraft/mc-mods/' + this.curseName

      if (link === _NO_LINK) return ''

      return '<a href="' + link + '" target="_blank" rel="noopener" title="' + link + '" class="ml-2 mod-info"><i class="fas fa-info-circle"></i></a>'
    },
    displayName: function () {
      return this.$props.mod.name.displayName
    },
    imageStyle: function () {
      if (this.imageSource !== _NO_ICON) {
        return 'background-image: url(' + this.imageSource + ')'
      }

      return 'opacity: 1'
    },
    minecraftVersions: function () {
      return this.$props.mod.versions
    },
    repoName: function () {
      return this.$props.mod.extRepo || this.$props.mod.orgRepo
    },
    modIds: function () {
      return this.minecraftVersions.map(v => this.modId(this.repoName, v))
    },
    title: function () {
      return this.displayName + ' ' + this.aliases + ' ' + this.info
    }
  },
  watch: {
    mod: function (newValue, oldValue) {
      if (oldValue !== newValue) {
        this.updateThumbnail()
      }
    }
  },
  created: function () {
    this.updateThumbnail()
  }
})
