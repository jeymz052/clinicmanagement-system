'use client'

import {
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
} from 'react'

type RevealDirection = 'up' | 'left' | 'right' | 'none'

type ScrollRevealProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  children: ReactNode
  className?: string
  delayMs?: number
  direction?: RevealDirection
}

export default function ScrollReveal({
  as: Component = 'div',
  children,
  className,
  delayMs = 0,
  direction = 'up',
  style,
  ...props
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      element.classList.add('scroll-reveal-ready')
    })

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return
        }

        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      },
    )

    observer.observe(element)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer.disconnect()
    }
  }, [])

  return (
    <Component
      ref={ref}
      className={[
        'scroll-reveal',
        direction === 'none' ? '' : `scroll-reveal-${direction}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          ...style,
          '--reveal-delay': `${delayMs}ms`,
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </Component>
  )
}
