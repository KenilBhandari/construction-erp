'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './orange-logo.module.css'

/* eslint-disable @next/next/no-img-element -- static SVGs, next/image adds nothing */

// Intro: pause so the collapsed mark registers, then timings mirror the CSS
const INTRO_DELAY = 500 // ms before auto-expanding
const EXPAND_MS = 300 // must match the .slider transition duration
const HOLD_MS = 1000 // ms the full lockup stays open

export default function OrangeLogo() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLAnchorElement>(null)
  const pathname = usePathname()
  const timers = useRef<number[]>([])

  const clearIntro = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  // topbar lives in the layout and survives navigation → collapse after we arrive
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Auto-play intro on a full load of exactly /dashboard: collapsed →
  // expand → hold → collapse. In-app navigation never remounts the layout,
  // so this naturally fires only on page loads.
  useEffect(() => {
    if (pathname !== '/dashboard') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    timers.current = [
      window.setTimeout(() => setOpen(true), INTRO_DELAY),
      window.setTimeout(() => setOpen(false), INTRO_DELAY + EXPAND_MS + HOLD_MS),
    ]
    return clearIntro
  }, [pathname])

  return (
    <Link
      ref={ref}
      href="/dashboard"
      className={styles.logo}
      data-open={open}
      aria-label="Orange ERP — dashboard"
      title="Orange ERP"
      draggable={false}
    >
      <img
        src="/logo/1-orange-fruit.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className={styles.fruit}
      />
      <span className={styles.slider} aria-hidden={!open}>
        <span className={styles.clip}>
          <img
            src="/logo/2-orange-text.svg"
            alt=""
            draggable={false}
            className={styles.word}
          />
        </span>
      </span>
      <img
        src="/logo/3-erp-text.svg"
        alt="ERP"
        draggable={false}
        className={styles.erp}
      />
    </Link>
  )
}