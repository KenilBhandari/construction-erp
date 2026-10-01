'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './orange-logo.module.css'

/* eslint-disable @next/next/no-img-element -- static SVGs, next/image adds nothing */
export default function OrangeLogo() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLAnchorElement>(null)
  const pathname = usePathname()

  // topbar lives in the layout and survives navigation → collapse after we arrive
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // close on outside tap/click or Escape
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // 1st click expands (cancel navigation), 2nd click follows the link
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!open) {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <Link
      ref={ref}
      href="/dashboard"
      className={styles.logo}
      data-open={open}
      aria-label="Orange ERP — dashboard"
      title="Orange ERP"
      onClick={handleClick}
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