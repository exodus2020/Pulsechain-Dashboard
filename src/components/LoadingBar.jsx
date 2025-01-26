import { useEffect, useRef, memo } from 'react'
import styled, { keyframes, css } from 'styled-components'

const shimmer = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
`

const Container = styled.div`
  width: 100%;
  isolation: isolate;
`

const Bar = styled.div.attrs(props => ({
  'data-height': props.barheight,
  'data-color': props.barcolor,
  style: {
    height: props.barheight,
    background: props.barcolor,
    borderRadius: props.barheight
  }
}))`
  width: 100%;
  overflow: hidden;
  position: relative;
`

const ProgressBar = styled.div.attrs(props => ({
  'data-completed': props.completed,
  'data-fill': props.fillcolor,
  'data-complete-color': props.completecolor,
  'data-shimmer': props.shimmercolor,
}))`
  height: 100%;
  width: var(--progress);
  background: ${props => props.$completed ? props.$completecolor : props.$fillcolor};
  border-radius: inherit;
  transition: width 0.2s linear;
  position: relative;

  ${props => !props.$completed && css`
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${props.$shimmercolor};
      opacity: 0.2;
      animation: ${shimmer} 1.5s ease-in-out infinite;
    }
  `}
`

const DashedPattern = styled.div.attrs(props => ({
  'data-pattern': props.patterncolor,
  style: {
    backgroundImage: `repeating-linear-gradient(
      90deg,
      ${props.patterncolor} 0px,
      ${props.patterncolor} 4px,
      transparent 4px,
      transparent 8px
    )`
  }
}))`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.2;
  pointer-events: none;
`

const LoadingBarComponent = ({ 
    estTime = 60,
    completed = false,
    height = '4px',
    backgroundColor = 'rgb(40, 40, 40)',
    fillColor = 'rgb(255, 255, 255)',
    completedColor = 'rgb(130, 255, 130)',
    shimmerColor = 'rgb(200, 200, 200)',
    dashColor = 'rgb(30, 30, 30)'
}) => {
    const progressRef = useRef(null)
    const progressInterval = useRef(null)
    const startTime = useRef(Date.now())

    useEffect(() => {
        if (completed) {
            if (progressInterval.current) {
                clearInterval(progressInterval.current)
                progressInterval.current = null
            }
            if (progressRef.current) {
                progressRef.current.style.setProperty('--progress', '100%')
            }
            return
        }

        if (!progressInterval.current) {
            progressInterval.current = setInterval(() => {
                const elapsed = (Date.now() - startTime.current) / 1000
                const calculatedProgress = Math.min((elapsed / estTime) * 100, 98)
                
                if (elapsed >= estTime) {
                    clearInterval(progressInterval.current)
                    progressInterval.current = null
                }
                
                if (progressRef.current) {
                    progressRef.current.style.setProperty('--progress', `${calculatedProgress}%`)
                }
            }, 100)
        }

        return () => {
            if (progressInterval.current) {
                clearInterval(progressInterval.current)
                progressInterval.current = null
            }
        }
    }, [completed, estTime])

    return (
        <Container>
            <Bar 
                barheight={height}
                barcolor={backgroundColor}
            >
                <ProgressBar 
                    ref={progressRef}
                    $completed={completed}
                    $fillcolor={fillColor}
                    $completecolor={completedColor}
                    $shimmercolor={shimmerColor}
                    style={{ '--progress': '0%' }}
                />
                <DashedPattern patterncolor={dashColor} />
            </Bar>
        </Container>
    )
}

export const LoadingBar = memo(LoadingBarComponent)