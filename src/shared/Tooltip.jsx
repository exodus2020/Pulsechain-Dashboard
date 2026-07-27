//Tooltip.jsx
import styled from "styled-components"
import {
  useState,
  useEffect,
  useCallback,
  useRef
} from "react"
import { createPortal } from "react-dom"

// Create tooltip root once at module level
let tooltipRoot = null

function getTooltipRoot() {
  if (!tooltipRoot) {
    tooltipRoot = document.getElementById('tooltip-root')
    if (!tooltipRoot) {
      tooltipRoot = document.createElement('div')
      tooltipRoot.id = 'tooltip-root'
      document.body.appendChild(tooltipRoot)
    }
  }
  return tooltipRoot
}

const TooltipWrapper = styled.div`
  position: relative;
  display: inline-block;
  ${props => props.$customStyle && { ...props.$customStyle }}
`

const TooltipContent = styled.div`
  position: fixed;
  visibility: ${props => props.$visible ? 'visible' : 'hidden'};
  background-color: ${props => props.$dark ? 'rgba(26, 26, 26, 1)' : 'rgba(255, 255, 255, 1)'};
  color: ${props => props.$dark ? 'rgba(255, 255, 255, 1)' : 'rgba(26, 26, 26, 1)'};
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 2px 4px rgba(0,0,0,0.18);
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.3s ease;
  box-shadow: 0px 0px 2px 1px rgb(70,70,70);
  pointer-events: none;
  max-width: 350px;


  /* Arrow */
  &::after {
    content: '';
    position: absolute;
    border-style: solid;
    border-width: 6px;

    ${props => {
      const borderColor = props.$dark ? '#1a1a1a' : '#ffffff'
      switch (props.$placement) {
        case 'top':
          return `
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-color: ${borderColor} transparent transparent transparent;
          `
        case 'bottom':
          return `
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-color: transparent transparent ${borderColor} transparent;
          `
        case 'left':
          return `
            top: 50%;
            left: 100%;
            transform: translateY(-50%);
            border-color: transparent transparent transparent ${borderColor};
          `
        case 'right':
          return `
            top: 50%;
            right: 100%;
            transform: translateY(-50%);
            border-color: transparent ${borderColor} transparent transparent;
          `
        default:
          return `
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-color: ${borderColor} transparent transparent transparent;
          `
      }
    }}
  }
`

export default function Tooltip({ 
  children, 
  content, 
  placement = 'bottom', 
  dark = true,
  delay = 200,
  customStyle = {},
  followCursor = false,
  fitViewport = false,
  ...props 
}) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [scale, setScale] = useState(1)
  const tooltipRef = useRef(null)
  const timeoutRef = useRef(null)
  const portalRoot = useRef(getTooltipRoot())

const updatePosition = useCallback((rect, event = null) => {
  const tooltipOffset = 12

  if (followCursor && event) {
    const viewportPadding = 12
    const cursorGap = 14

    const mouseX = event.clientX
    const mouseY = event.clientY

    const tooltipElement =
      tooltipRef.current

    if (!tooltipElement) {
      setPosition({
        left: mouseX + cursorGap,
        top: mouseY
      })

      return
    }

    const tooltipWidth =
      tooltipElement.offsetWidth

    const tooltipHeight =
      tooltipElement.offsetHeight

    const availableHeight =
      window.innerHeight -
      viewportPadding * 2

    const nextScale =
      fitViewport &&
      tooltipHeight > availableHeight
        ? availableHeight / tooltipHeight
        : 1

    const scaledWidth =
      tooltipWidth * nextScale

    const scaledHeight =
      tooltipHeight * nextScale

    let left =
      mouseX + cursorGap

    let top =
      mouseY - scaledHeight / 2

    // Prefer the right side of the cursor.
    if (
      left + scaledWidth >
      window.innerWidth - viewportPadding
    ) {
      left =
        mouseX -
        scaledWidth -
        cursorGap
    }

    // Keep the entire tooltip inside the viewport.
    left = Math.max(
      viewportPadding,
      Math.min(
        left,
        window.innerWidth -
          scaledWidth -
          viewportPadding
      )
    )

    top = Math.max(
      viewportPadding,
      Math.min(
        top,
        window.innerHeight -
          scaledHeight -
          viewportPadding
      )
    )

    setScale(nextScale)

    setPosition({
      left,
      top
    })

    return
  }

  let top
  let left

  switch (placement) {
    case "top":
      top = rect.top - tooltipOffset
      left = rect.left + rect.width / 2
      break

    case "bottom":
      top = rect.bottom + tooltipOffset
      left = rect.left + rect.width / 2
      break

    case "left":
      top = rect.top + rect.height / 2
      left = rect.left - tooltipOffset
      break

    case "right":
      top = rect.top + rect.height / 2
      left = rect.right + tooltipOffset
      break

    default:
      top = rect.bottom + tooltipOffset
      left = rect.left + rect.width / 2
  }

  setScale(1)

  setPosition({
    top,
    left
  })
}, [
  followCursor,
  fitViewport,
  placement
])

  const showTooltip = useCallback((event) => {
    const rect =
      event.currentTarget.getBoundingClientRect()

    updatePosition(rect, event)

    timeoutRef.current = setTimeout(() => {
      setVisible(true)
    }, delay)
  }, [
    delay,
    updatePosition
  ])

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }, [])

  // Handle scroll events
  useEffect(() => {
    if (visible) {
      const handleScroll = () => {
        hideTooltip()
      }
      window.addEventListener('scroll', handleScroll, true)
      return () => window.removeEventListener('scroll', handleScroll, true)
    }
  }, [visible, hideTooltip])

  // Remove portal container management from component
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      setVisible(false)
    }
  }, [])

  return (
    <>
      <TooltipWrapper 
        {...props}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onMouseMove={event => {
          updatePosition(
            event.currentTarget.getBoundingClientRect(),
            event
          )
        }}
        $customStyle={customStyle}
      >
        {children}
      </TooltipWrapper>
      {portalRoot.current && createPortal(
        <TooltipContent
          ref={tooltipRef}
          $visible={visible}
          $placement={followCursor ? "right" : placement}
          $dark={dark}
          style={
            followCursor
              ? {
                  left: position.left,
                  top: position.top,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left"
                }
              : {
                  transform:
                    `translate(${position.left}px, ${position.top}px)`,

                  ...(placement === "top" && {
                    transform:
                      `translate(${position.left}px, ${position.top}px) ` +
                      `translateY(-100%) translateX(-50%)`
                  }),

                  ...(placement === "bottom" && {
                    transform:
                      `translate(${position.left}px, ${position.top}px) ` +
                      `translateX(-50%)`
                  }),

                  ...(placement === "left" && {
                    transform:
                      `translate(${position.left}px, ${position.top}px) ` +
                      `translateX(-100%) translateY(-50%)`
                  }),

                  ...(placement === "right" && {
                    transform:
                      `translate(${position.left}px, ${position.top}px) ` +
                      `translateY(-50%)`
                  })
                }
          }
        >
          {content}
        </TooltipContent>,
        portalRoot.current
      )}
    </>
  )
}