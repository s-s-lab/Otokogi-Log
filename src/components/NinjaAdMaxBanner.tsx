import { useEffect, useState } from 'react'

const DESKTOP_ADMAX_ID = 'f251189216e46735cbcc0698ba83fbd1'
const MOBILE_ADMAX_ID = '69f4320d3db2a8252d23b6ed9d726e24'
const ADMAX_SCRIPT_ID = 'ninja-admax-async-sdk'
const ADMAX_SCRIPT_SRC = 'https://adm.shinobi.jp/st/t.js'
const DESKTOP_BANNER_MEDIA = '(min-width: 780px)'

interface AdMaxRequest {
  admax_id: string
  type: 'banner'
}

interface AdMaxWindow extends Window {
  admaxads?: AdMaxRequest[]
}

export function NinjaAdMaxBanner() {
  const [isDesktop] = useState(() =>
    window.matchMedia(DESKTOP_BANNER_MEDIA).matches,
  )
  const admaxId = isDesktop ? DESKTOP_ADMAX_ID : MOBILE_ADMAX_ID
  const deviceClass = isDesktop ? 'desktop' : 'mobile'

  useEffect(() => {
    const adWindow = window as AdMaxWindow
    adWindow.admaxads ??= []

    if (!adWindow.admaxads.some((request) => request.admax_id === admaxId)) {
      adWindow.admaxads.push({ admax_id: admaxId, type: 'banner' })
    }

    if (document.getElementById(ADMAX_SCRIPT_ID)) return

    const script = document.createElement('script')
    script.id = ADMAX_SCRIPT_ID
    script.src = ADMAX_SCRIPT_SRC
    script.async = true
    script.charset = 'utf-8'
    document.head.appendChild(script)
  }, [admaxId])

  return (
    <aside
      className={`ninja-admax-banner ninja-admax-banner--${deviceClass}`}
      aria-label="広告"
      data-admax-tag-id={admaxId}
    >
      <span className="ninja-admax-label">ADVERTISEMENT</span>
      <div className="ninja-admax-banner-stage">
        <div className="admax-ads" data-admax-id={admaxId} />
      </div>
    </aside>
  )
}
