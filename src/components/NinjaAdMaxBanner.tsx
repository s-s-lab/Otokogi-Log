import { useEffect } from 'react'

const ADMAX_ID = 'f251189216e46735cbcc0698ba83fbd1'
const ADMAX_SCRIPT_ID = 'ninja-admax-async-sdk'
const ADMAX_SCRIPT_SRC = 'https://adm.shinobi.jp/st/t.js'
const DESKTOP_BANNER_MEDIA = '(min-width: 780px)'

interface AdMaxRequest {
  admax_id: string
  type: 'b'
}

interface AdMaxWindow extends Window {
  admaxads?: AdMaxRequest[]
}

export function NinjaAdMaxBanner() {
  useEffect(() => {
    const desktopBanner = window.matchMedia(DESKTOP_BANNER_MEDIA)

    const requestAd = () => {
      if (!desktopBanner.matches) return

      const adWindow = window as AdMaxWindow
      adWindow.admaxads ??= []

      if (!adWindow.admaxads.some((request) => request.admax_id === ADMAX_ID)) {
        adWindow.admaxads.push({ admax_id: ADMAX_ID, type: 'b' })
      }

      if (document.getElementById(ADMAX_SCRIPT_ID)) return

      const script = document.createElement('script')
      script.id = ADMAX_SCRIPT_ID
      script.src = ADMAX_SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }

    requestAd()
    desktopBanner.addEventListener('change', requestAd)

    return () => desktopBanner.removeEventListener('change', requestAd)
  }, [])

  return (
    <aside
      className="ninja-admax-banner"
      aria-label="広告"
      data-admax-tag-id={ADMAX_ID}
    >
      <span className="ninja-admax-label">ADVERTISEMENT</span>
      <div className="ninja-admax-banner-stage">
        <div className="admax-ads" data-admax-id={ADMAX_ID} />
      </div>
    </aside>
  )
}
